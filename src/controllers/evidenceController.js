// src/controllers/evidenceController.js
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
// Upload NEW evidence for a case (can upload multiple per case)
// ─────────────────────────────────────────────────────────────
exports.uploadEvidence = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const { caseId, description, evidenceType } = req.body;
    if (!caseId) return res.status(400).json({ message: "caseId is required" });

    const existingCase = await Case.findById(caseId);
    if (!existingCase) return res.status(404).json({ message: "Case not found" });

    // Hash from file bytes
    const hash         = generateHash(file.buffer);
    const fileExt      = path.extname(file.originalname);
    const safeFileName = `${Date.now()}_${uuidv4().slice(0, 8)}${fileExt}`;
    const storagePath  = `evidence/${caseId}/${safeFileName}`;
    const fileUpload   = bucket.file(storagePath);

    // Upload to Firebase Storage
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

    // Generate proper Firebase Storage download URL
    // Uses firebasestorage.googleapis.com format with encoded path
    // This is the correct URL that works in browsers with no CORS issues
    const encodedPath = encodeURIComponent(storagePath);
    const downloadURL =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media`;

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

    // Anchor on blockchain (background)
    anchorHash(evidence._id.toString(), hash)
      .then(async (txHash) => {
        await Evidence.findByIdAndUpdate(evidence._id, {
          blockchainTxHash: txHash,
          blockchainStatus: "anchored",
          anchoredAt:       new Date(),
        });
        console.log(`✅ Anchored ${evidence._id} TX: ${txHash}`);
      })
      .catch(async (err) => {
        await Evidence.findByIdAndUpdate(evidence._id, {
          blockchainStatus: "failed",
        });
        console.error(`❌ Anchor failed:`, err.message);
      });

    res.status(201).json({
      message:          "Evidence uploaded successfully",
      evidenceId:       evidence._id,
      fileName:         evidence.fileName,
      fileHash:         hash,
      downloadURL,
      blockchainStatus: "pending",
    });
  } catch (err) {
    console.error("uploadEvidence error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/evidence/verify
// Re-upload a file to check if it matches the stored hash.
// If tampered → update DB isTampered=true, send alert.
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

    // Compute hash of uploaded file
    const newHash  = generateHash(file.buffer);
    const dbMatch  = newHash === stored.fileHash;

    // Verify on blockchain if anchored
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
      // ── REFLECT TAMPER IN DATABASE ────────────────────────
      await Evidence.findByIdAndUpdate(evidenceId, {
        isTampered:   true,
        tamperedAt:   new Date(),
        tamperSource: "manual_verify",
        // Store the hash that was submitted (the modified one)
        tamperedHash: newHash,
      });

      // Send alert
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
        // Tell frontend to update the UI
        dbUpdated:       true,
      });
    }

    // ── FILE IS CLEAN ─────────────────────────────────────────
    // If previously tampered but now OK — clear the flag
    if (stored.isTampered) {
      await Evidence.findByIdAndUpdate(evidenceId, {
        isTampered:   false,
        tamperedAt:   null,
        tamperSource: null,
        tamperedHash: null,
      });
    }

    res.json({
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
      dbUpdated:        stored.isTampered, // true if we cleared a previous tamper
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
// Returns all cases with their evidence grouped — for Evidence List screen
// ─────────────────────────────────────────────────────────────
exports.getCasesWithEvidence = async (req, res) => {
  try {
    // Get all cases
    const cases = await Case.find().sort({ createdAt: -1 }).lean();

    // Get evidence counts and tamper info per case
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

    // Map for quick lookup
    const groupMap = {};
    for (const g of evidenceGroups) {
      groupMap[g._id] = g;
    }

    // Merge
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
// Get all evidence for a specific case — FULL data including downloadURL
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
// GET /api/evidence/stats-summary
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
// GET /api/evidence/:id
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

function _detectType(mime) {
  if (!mime) return "document";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "document";
  return "document";
}