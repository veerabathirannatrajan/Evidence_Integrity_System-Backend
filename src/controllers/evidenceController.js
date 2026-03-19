// src/controllers/evidenceController.js
// FIX: anchorHash is now AWAITED synchronously before res.json()
//      so it works on Vercel (serverless functions are killed after response).
// NEW: exports.retryAnchor — POST /api/evidence/anchor/:id
//      retries anchoring for pending/failed records from the Flutter app.

const Evidence     = require("../models/Evidence");
const Case         = require("../models/Case");
const Custody      = require("../models/Custody");
const generateHash = require("../services/hashService");
const { anchorHash, verifyOnChain } = require("../services/blockchainService");
const { sendTamperAlert }           = require("../services/alertService");
const { bucket }                    = require("../config/firebase");
const path                          = require("path");
const { v4: uuidv4 }               = require("uuid");

// ─────────────────────────────────────────────────────────────
// POST /api/evidence/upload
// ─────────────────────────────────────────────────────────────
exports.uploadEvidence = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const { caseId, description, evidenceType } = req.body;
    if (!caseId) return res.status(400).json({ message: "caseId is required" });

    const existingCase = await Case.findById(caseId);
    if (!existingCase) return res.status(404).json({ message: "Case not found" });

    // ── 1. Hash ───────────────────────────────────────────────
    const hash         = generateHash(file.buffer);
    const fileExt      = path.extname(file.originalname);
    const safeFileName = `${Date.now()}_${uuidv4().slice(0, 8)}${fileExt}`;
    const storagePath  = `evidence/${caseId}/${safeFileName}`;
    const fileUpload   = bucket.file(storagePath);

    // ── 2. Upload to Firebase Storage ────────────────────────
    await new Promise((resolve, reject) => {
      const stream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: {
            evidenceCaseId:   caseId,
            uploadedBy:       req.user.uid,
            sha256Hash:       hash,
            originalFileName: file.originalname,
          },
        },
        resumable: false,
      });
      stream.on("error", reject);
      stream.on("finish", resolve);
      stream.end(file.buffer);
    });

    // ── 3. Download URL ───────────────────────────────────────
    const encodedPath = encodeURIComponent(storagePath);
    const downloadURL =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

    // ── 4. Save evidence record (pending) ────────────────────
    const evidence = new Evidence({
      caseId,
      fileName:         file.originalname,
      fileType:         file.mimetype,
      fileSize:         file.size,
      fileHash:         hash,
      storagePath,
      downloadURL,
      uploadedBy:       req.user.uid,
      description:      description || "",
      evidenceType:     evidenceType || _detectType(file.mimetype),
      blockchainStatus: "pending",
      isTampered:       false,
    });

    await evidence.save();

    // ── 5. Anchor on blockchain — NOW AWAITED ─────────────────
    // Previously used fire-and-forget .then() which Vercel kills
    // as soon as res.json() is called. Now we await before responding.
    let blockchainTxHash = null;
    let blockchainStatus = "pending";

    try {
      const txHash = await anchorHash(evidence._id.toString(), hash);

      blockchainTxHash = txHash;
      blockchainStatus = "anchored";

      await Evidence.findByIdAndUpdate(evidence._id, {
        blockchainTxHash: txHash,
        blockchainStatus: "anchored",
        anchoredAt:       new Date(),
      });

      console.log(`✅ Anchored ${evidence._id}  TX: ${txHash}`);
    } catch (anchorErr) {
      // Anchoring failed — mark DB, still return 201 so file is saved.
      // Flutter can call POST /api/evidence/anchor/:id to retry.
      blockchainStatus = "failed";

      await Evidence.findByIdAndUpdate(evidence._id, {
        blockchainStatus: "failed",
      });

      console.error(`❌ Anchor failed for ${evidence._id}:`, anchorErr.message);
    }

    // ── 6. Respond ────────────────────────────────────────────
    return res.status(201).json({
      message:
        blockchainStatus === "anchored"
          ? "Evidence uploaded and anchored on blockchain"
          : "Evidence uploaded — blockchain anchor failed (use retry endpoint)",
      evidenceId:       evidence._id,
      fileName:         evidence.fileName,
      fileHash:         hash,
      downloadURL,
      blockchainStatus,
      blockchainTxHash,
    });
  } catch (err) {
    console.error("uploadEvidence error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/evidence/anchor/:id          ← NEW ENDPOINT
// Retry blockchain anchoring for a pending/failed evidence record.
// Flutter calls this when blockchainStatus is "pending" or "failed".
// ─────────────────────────────────────────────────────────────
exports.retryAnchor = async (req, res) => {
  try {
    const ev = await Evidence.findById(req.params.id);
    if (!ev) return res.status(404).json({ message: "Evidence not found" });

    // Already done — just return the existing tx
    if (ev.blockchainStatus === "anchored") {
      return res.json({
        message:          "Already anchored",
        evidenceId:       ev._id,
        blockchainStatus: "anchored",
        blockchainTxHash: ev.blockchainTxHash,
        anchoredAt:       ev.anchoredAt,
      });
    }

    console.log(`🔄 Retrying anchor for evidence ${ev._id} …`);

    const txHash = await anchorHash(ev._id.toString(), ev.fileHash);

    await Evidence.findByIdAndUpdate(ev._id, {
      blockchainTxHash: txHash,
      blockchainStatus: "anchored",
      anchoredAt:       new Date(),
    });

    console.log(`✅ Retry anchored ${ev._id}  TX: ${txHash}`);

    return res.json({
      message:          "Anchored successfully",
      evidenceId:       ev._id,
      blockchainStatus: "anchored",
      blockchainTxHash: txHash,
    });
  } catch (err) {
    console.error("retryAnchor error:", err);
    res.status(500).json({ message: "Anchor failed", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/evidence/verify
// ─────────────────────────────────────────────────────────────
exports.verifyEvidence = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const { evidenceId } = req.body;
    if (!evidenceId) {
      return res.status(400).json({ message: "evidenceId is required" });
    }

    const stored = await Evidence.findById(evidenceId);
    if (!stored) {
      return res.status(404).json({ message: "Evidence record not found" });
    }

    const newHash  = generateHash(file.buffer);
    const dbMatch  = newHash === stored.fileHash;

    let chainResult = { valid: null };
    if (stored.blockchainStatus === "anchored") {
      try {
        chainResult = await verifyOnChain(evidenceId, newHash);
      } catch (e) {
        console.error("Chain verify error:", e.message);
      }
    }

    const isTampered = !dbMatch || chainResult.valid === false;

    if (isTampered) {
      await Evidence.findByIdAndUpdate(evidenceId, {
        isTampered:   true,
        tamperedAt:   new Date(),
        tamperSource: "manual_verify",
        tamperedHash: newHash,
      });

      await sendTamperAlert({
        evidenceId,
        fileName:     stored.fileName,
        originalHash: stored.fileHash,
        newHash,
        detectedBy:   req.user.uid,
        caseId:       stored.caseId,
      });

      console.warn(
        `🚨 TAMPER DETECTED: evidenceId=${evidenceId} ` +
        `file="${stored.fileName}" caseId=${stored.caseId}`
      );

      return res.json({
        status:          "TAMPERED",
        message:         "Evidence integrity COMPROMISED",
        evidenceId,
        fileName:        stored.fileName,
        caseId:          stored.caseId,
        originalHash:    stored.fileHash,
        newHash,
        hashMatch:       false,
        blockchainValid: chainResult.valid,
        detectedAt:      new Date().toISOString(),
        dbUpdated:       true,
      });
    }

    if (stored.isTampered) {
      await Evidence.findByIdAndUpdate(evidenceId, {
        isTampered:   false,
        tamperedAt:   null,
        tamperSource: null,
        tamperedHash: null,
      });
    }

    return res.json({
      status:           "VERIFIED",
      message:          "Evidence integrity CONFIRMED",
      evidenceId,
      fileName:         stored.fileName,
      caseId:           stored.caseId,
      hash:             newHash,
      hashMatch:        true,
      blockchainValid:  chainResult.valid,
      anchoredAt:       stored.anchoredAt,
      blockchainTxHash: stored.blockchainTxHash,
      dbUpdated:        stored.isTampered,
    });
  } catch (err) {
    console.error("verifyEvidence error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evidence/stats
// ─────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [totalCases, totalEvidence, anchored, tampered] =
      await Promise.all([
        Case.countDocuments(),
        Evidence.countDocuments(),
        Evidence.countDocuments({ blockchainStatus: "anchored" }),
        Evidence.countDocuments({ isTampered: true }),
      ]);

    res.json({
      totalCases, totalEvidence, anchored, tampered,
      successRate: totalEvidence > 0
        ? ((anchored / totalEvidence) * 100).toFixed(1) : "0.0",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evidence/cases-with-evidence
// ─────────────────────────────────────────────────────────────
exports.getCasesWithEvidence = async (req, res) => {
  try {
    const cases = await Case.find().sort({ createdAt: -1 }).lean();

    const evidenceGroups = await Evidence.aggregate([
      {
        $group: {
          _id:       "$caseId",
          total:     { $sum: 1 },
          anchored:  { $sum: { $cond: [{ $eq: ["$blockchainStatus","anchored"] }, 1, 0] } },
          tampered:  { $sum: { $cond: ["$isTampered", 1, 0] } },
          totalSize: { $sum: "$fileSize" },
          latest:    { $max: "$createdAt" },
        },
      },
    ]);

    const groupMap = {};
    for (const g of evidenceGroups) {
      groupMap[g._id] = g;
    }

    const result = cases.map((c) => ({
      ...c,
      evidenceStats: groupMap[c._id.toString()] || {
        total: 0, anchored: 0, tampered: 0,
        totalSize: 0, latest: null,
      },
    }));

    res.json(result);
  } catch (err) {
    console.error("getCasesWithEvidence error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evidence/case/:caseId
// ─────────────────────────────────────────────────────────────
exports.getEvidenceByCase = async (req, res) => {
  try {
    const evidence = await Evidence
      .find({ caseId: req.params.caseId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evidence/recent-activity
// ─────────────────────────────────────────────────────────────
exports.getRecentActivity = async (req, res) => {
  try {
    const recentEvidence = await Evidence
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select("fileName blockchainStatus blockchainTxHash fileHash createdAt caseId uploadedBy isTampered evidenceType fileSize")
      .lean();

    const recentCustody = await Custody
      .find()
      .sort({ timestamp: -1 })
      .limit(4)
      .select("evidenceId fromUser toUser reason timestamp")
      .lean();

    res.json({ recentEvidence, recentCustody });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evidence/summary
// ─────────────────────────────────────────────────────────────
exports.getSummary = async (req, res) => {
  try {
    const summary = await Evidence.aggregate([
      {
        $group: {
          _id:      "$caseId",
          total:    { $sum: 1 },
          anchored: { $sum: { $cond: [{ $eq: ["$blockchainStatus","anchored"] },1,0] } },
          pending:  { $sum: { $cond: [{ $eq: ["$blockchainStatus","pending"]  },1,0] } },
          failed:   { $sum: { $cond: [{ $eq: ["$blockchainStatus","failed"]   },1,0] } },
          tampered: { $sum: { $cond: ["$isTampered", 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evidence/recent/:limit
// ─────────────────────────────────────────────────────────────
exports.getRecentEvidence = async (req, res) => {
  try {
    const limit = parseInt(req.params.limit) || 10;
    const evidence = await Evidence
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/evidence/:id   (also used for public QR)
// ─────────────────────────────────────────────────────────────
exports.getEvidenceById = async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) return res.status(404).json({ message: "Not found" });
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────
function _detectType(mime) {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";
  return "document";
}