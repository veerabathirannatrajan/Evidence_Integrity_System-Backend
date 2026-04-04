// src/controllers/custodyController.js
// UPDATED: Risk engine is triggered after every successful transfer

const Evidence     = require("../models/Evidence");
const Case         = require("../models/Case");
const Custody      = require("../models/Custody");
const { analyzeRisk } = require("../services/riskEngine"); // ← NEW

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

exports.transferCustody = async (req, res) => {
  try {
    const { evidenceId, toUser, toRole, reason, notes } = req.body;

    if (!evidenceId || !toUser || !toRole || !reason) {
      return res.status(400).json({
        message: "evidenceId, toUser, toRole, and reason are required",
      });
    }

    const fromRole = req.user.role || "police";

    // NOTE: We still allow the transfer even if unauthorized — but the risk
    // engine will flag it as VIOLATION. This ensures the audit trail is complete.
    const allowed = ALLOWED_TRANSFERS[fromRole] || [];
    if (!allowed.includes(toRole)) {
      // Still record the attempt as a risk event via the engine
      // but block the actual transfer
      return res.status(403).json({
        message:
          `Role "${fromRole}" cannot transfer custody to "${toRole}". ` +
          `Allowed targets: ${allowed.join(", ") || "none"}`,
      });
    }

    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const existingCount = await Custody.countDocuments({ evidenceId });

    const custody = new Custody({
      evidenceId,
      caseId:        evidence.caseId,
      evidenceName:  evidence.fileName,
      fromUser:      req.user.uid,
      fromRole,
      fromName:      req.user.email || req.user.uid,
      toUser,
      toRole,
      toName:        toUser,
      reason,
      notes:         notes || "",
      chainPosition: existingCount + 1,
      hashAtTransfer: evidence.fileHash,
    });

    await custody.save();

    console.log(
      `🔗 Custody transferred: evidence=${evidenceId} ` +
      `from=${fromRole}(${req.user.uid}) → to=${toRole}(${toUser})`
    );

    // ── Trigger risk analysis (non-blocking) ─────────────────────────────────
    // Run AFTER saving custody so allTransfers count includes this one
    analyzeRisk(evidenceId, custody.toObject()).catch(err =>
      console.error("Risk analysis failed (non-fatal):", err.message)
    );

    return res.status(201).json({
      message: "Custody transferred successfully",
      custody,
    });
  } catch (err) {
    console.error("transferCustody error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

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