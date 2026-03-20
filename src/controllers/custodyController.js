// src/controllers/custodyController.js
// FIXED:
//  1. ALLOWED_TRANSFERS and ROLE_LABELS constants are now defined here
//  2. getCustodyHistory, getCustodyByCase, getAllowedRoles moved from
//     evidenceController.js (where they were incorrectly placed) to here
//  3. transferCustody is complete

const Evidence = require("../models/Evidence");
const Case     = require("../models/Case");
const Custody  = require("../models/Custody");

// ─────────────────────────────────────────────────────────────
// Role transfer rules
// ─────────────────────────────────────────────────────────────
const ALLOWED_TRANSFERS = {
  police:     ["forensic", "prosecutor"],
  forensic:   ["prosecutor", "court"],
  prosecutor: ["court", "defense"],
  defense:    ["court"],
  court:      [],
};

const ROLE_LABELS = {
  police:     "Police Officer",
  forensic:   "Forensic Expert",
  prosecutor: "Prosecutor",
  defense:    "Defense Attorney",
  court:      "Court Official",
};

// ─────────────────────────────────────────────────────────────
// POST /api/custody/transfer
// Transfer evidence custody to another role
// Body: { evidenceId, toUser, toRole, reason, notes }
// ─────────────────────────────────────────────────────────────
exports.transferCustody = async (req, res) => {
  try {
    const { evidenceId, toUser, toRole, reason, notes } = req.body;

    if (!evidenceId || !toUser || !toRole || !reason) {
      return res.status(400).json({
        message: "evidenceId, toUser, toRole, and reason are required",
      });
    }

    const fromRole = req.user.role || "police";

    // Validate transfer is allowed
    const allowed = ALLOWED_TRANSFERS[fromRole] || [];
    if (!allowed.includes(toRole)) {
      return res.status(403).json({
        message: `Role "${fromRole}" cannot transfer custody to "${toRole}". ` +
                 `Allowed targets: ${allowed.join(", ") || "none"}`,
      });
    }

    // Find evidence
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    // Count existing transfers to set chain position
    const existingCount = await Custody.countDocuments({ evidenceId });

    // Build custody record
    const custody = new Custody({
      evidenceId,
      caseId:        evidence.caseId,
      evidenceName:  evidence.fileName,
      fromUser:      req.user.uid,
      fromRole,
      fromName:      req.user.email || req.user.uid,
      toUser,
      toRole,
      toName:        toUser,            // will be display name if provided
      reason,
      notes:         notes || "",
      chainPosition: existingCount + 1,
      hashAtTransfer: evidence.fileHash, // snapshot hash at handoff time
    });

    await custody.save();

    console.log(
      `🔗 Custody transferred: evidence=${evidenceId} ` +
      `from=${fromRole}(${req.user.uid}) → to=${toRole}(${toUser})`
    );

    return res.status(201).json({
      message:  "Custody transferred successfully",
      custody,
    });
  } catch (err) {
    console.error("transferCustody error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/custody/history/:evidenceId
// Full chain of custody for one evidence item
// ─────────────────────────────────────────────────────────────
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
      ...records.map((r) => ({
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

    const tamperInfo = evidence.isTampered
      ? {
          isTampered:   true,
          tamperedAt:   evidence.tamperedAt,
          tamperSource: evidence.tamperSource,
          tamperedHash: evidence.tamperedHash,
        }
      : { isTampered: false };

    return res.json({
      evidence: {
        id:               evidence._id,
        fileName:         evidence.fileName,
        fileHash:         evidence.fileHash,
        blockchainStatus: evidence.blockchainStatus,
        blockchainTxHash: evidence.blockchainTxHash,
        uploadedBy:       evidence.uploadedBy,
        caseId:           evidence.caseId,
        createdAt:        evidence.createdAt,
        ...tamperInfo,
      },
      chain,
      totalTransfers: records.length,
      currentCustodian:
        records.length > 0
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

// ─────────────────────────────────────────────────────────────
// GET /api/custody/case/:caseId
// All custody transfers for all evidence in a case
// ─────────────────────────────────────────────────────────────
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

    return res.json({
      case:    caseData,
      records,
      total:   records.length,
    });
  } catch (err) {
    console.error("getCustodyByCase error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/custody/allowed-roles
// Returns which roles the current user can transfer to
// ─────────────────────────────────────────────────────────────
exports.getAllowedRoles = async (req, res) => {
  try {
    const role    = req.user.role || "police";
    const allowed = ALLOWED_TRANSFERS[role] || [];

    return res.json({
      currentRole:  role,
      allowedRoles: allowed.map((r) => ({
        value: r,
        label: ROLE_LABELS[r] || r,
      })),
    });
  } catch (err) {
    console.error("getAllowedRoles error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};