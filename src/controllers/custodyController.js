// src/controllers/custodyController.js
const Custody  = require("../models/Custody");
const Evidence = require("../models/Evidence");
const Case     = require("../models/Case");
const { admin } = require("../config/firebase");

// ── Role display labels ───────────────────────────────────────────────
const ROLE_LABELS = {
  police:     "Police Officer",
  forensic:   "Forensic Expert",
  prosecutor: "Prosecutor",
  defense:    "Defense Attorney",
  court:      "Court Official",
};

// ── Which roles can transfer to which roles ───────────────────────────
const ALLOWED_TRANSFERS = {
  police:     ["forensic", "prosecutor"],
  forensic:   ["prosecutor", "police"],
  prosecutor: ["defense", "court"],
  defense:    ["court"],
  court:      [],
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/custody/transfer
// ─────────────────────────────────────────────────────────────────────
exports.transferCustody = async (req, res) => {
  try {
    const {
      evidenceId,
      toUser,    // target user UID or email
      toRole,    // target role
      reason,
      notes,
    } = req.body;

    if (!evidenceId || !toUser || !toRole || !reason) {
      return res.status(400).json({
        message: "evidenceId, toUser, toRole, and reason are required",
      });
    }

    // Check evidence exists
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const fromRole = req.user.role || "police";

    // Check transfer is allowed
    const allowed = ALLOWED_TRANSFERS[fromRole] || [];
    if (!allowed.includes(toRole)) {
      return res.status(403).json({
        message: `${ROLE_LABELS[fromRole]} cannot transfer to ${ROLE_LABELS[toRole]}`,
        allowedRoles: allowed,
      });
    }

    // Get chain position (count existing transfers + 1)
    const existingCount = await Custody.countDocuments({ evidenceId });

    // Get sender info
    const fromName = req.user.email || req.user.uid;

    // Get receiver display name
    let toName = toUser;
    try {
      // Try to look up by UID first
      const userRecord = await admin.auth().getUser(toUser).catch(() => null);
      if (userRecord) {
        toName = userRecord.email || userRecord.displayName || toUser;
      }
    } catch (_) {}

    // Create custody record
    const custody = await Custody.create({
      evidenceId,
      caseId:         evidence.caseId,
      evidenceName:   evidence.fileName,
      fromUser:       req.user.uid,
      fromRole,
      fromName,
      toUser,
      toRole,
      toName,
      reason,
      notes:          notes || "",
      chainPosition:  existingCount + 1,
      hashAtTransfer: evidence.fileHash,
    });

    res.status(201).json({
      message:   "Custody transferred successfully",
      custodyId: custody._id,
      from:      { uid: req.user.uid, role: fromRole, name: fromName },
      to:        { uid: toUser, role: toRole, name: toName },
      timestamp: custody.timestamp,
      chainPosition: custody.chainPosition,
    });
  } catch (err) {
    console.error("transferCustody error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/custody/history/:evidenceId
// Full chain of custody for one evidence item
// ─────────────────────────────────────────────────────────────────────
exports.getCustodyHistory = async (req, res) => {
  try {
    const { evidenceId } = req.params;

    const [evidence, records] = await Promise.all([
      Evidence.findById(evidenceId).lean(),
      Custody.find({ evidenceId }).sort({ timestamp: 1 }).lean(),
    ]);

    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    // Build the full chain starting from upload
    const chain = [
      {
        type:      "upload",
        actor:     evidence.uploadedBy,
        actorRole: "police",
        action:    "Evidence uploaded & registered",
        hash:      evidence.fileHash,
        timestamp: evidence.createdAt,
        txHash:    evidence.blockchainTxHash,
        status:    evidence.blockchainStatus,
        position:  0,
      },
      ...records.map((r, i) => ({
        type:         "transfer",
        custodyId:    r._id,
        fromUser:     r.fromUser,
        fromRole:     r.fromRole,
        fromName:     r.fromName,
        toUser:       r.toUser,
        toRole:       r.toRole,
        toName:       r.toName,
        reason:       r.reason,
        notes:        r.notes,
        hash:         r.hashAtTransfer,
        timestamp:    r.timestamp,
        position:     r.chainPosition,
      })),
    ];

    // Add tamper info if applicable
    const tamperInfo = evidence.isTampered
      ? {
          isTampered:   true,
          tamperedAt:   evidence.tamperedAt,
          tamperSource: evidence.tamperSource,
          tamperedHash: evidence.tamperedHash,
        }
      : { isTampered: false };

    res.json({
      evidence: {
        id:              evidence._id,
        fileName:        evidence.fileName,
        fileHash:        evidence.fileHash,
        blockchainStatus: evidence.blockchainStatus,
        blockchainTxHash: evidence.blockchainTxHash,
        uploadedBy:      evidence.uploadedBy,
        caseId:          evidence.caseId,
        createdAt:       evidence.createdAt,
        ...tamperInfo,
      },
      chain,
      totalTransfers: records.length,
      currentCustodian: records.length > 0
        ? {
            user: records[records.length - 1].toUser,
            role: records[records.length - 1].toRole,
            name: records[records.length - 1].toName,
          }
        : {
            user: evidence.uploadedBy,
            role: "police",
            name: evidence.uploadedBy,
          },
    });
  } catch (err) {
    console.error("getCustodyHistory error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/custody/case/:caseId
// All custody transfers for all evidence in a case
// ─────────────────────────────────────────────────────────────────────
exports.getCustodyByCase = async (req, res) => {
  try {
    const { caseId } = req.params;

    const [caseData, records] = await Promise.all([
      Case.findById(caseId).lean(),
      Custody.find({ caseId }).sort({ timestamp: -1 }).lean(),
    ]);

    if (!caseData) {
      return res.status(404).json({ message: "Case not found" });
    }

    res.json({
      case:    caseData,
      records,
      total:   records.length,
    });
  } catch (err) {
    console.error("getCustodyByCase error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────
// GET /api/custody/allowed-roles
// Returns which roles the current user can transfer to
// ─────────────────────────────────────────────────────────────────────
exports.getAllowedRoles = async (req, res) => {
  const role    = req.user.role || "police";
  const allowed = ALLOWED_TRANSFERS[role] || [];
  res.json({
    currentRole:  role,
    allowedRoles: allowed.map((r) => ({
      value: r,
      label: ROLE_LABELS[r],
    })),
  });
};