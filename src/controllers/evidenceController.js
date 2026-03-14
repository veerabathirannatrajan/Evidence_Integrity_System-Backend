const Evidence        = require("../models/Evidence");
const generateHash    = require("../services/hashService");
const { anchorHash, verifyOnChain } = require("../services/blockchainService");
const { sendTamperAlert }           = require("../services/alertService");

/**
 * POST /api/evidence/upload
 * 1. Receive file via multer
 * 2. Generate SHA-256 hash
 * 3. Save evidence metadata to MongoDB
 * 4. Anchor hash on Polygon blockchain
 * 5. Update MongoDB with tx hash
 */
exports.uploadEvidence = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { caseId } = req.body;
    if (!caseId) {
      return res.status(400).json({ message: "caseId is required" });
    }

    // Step 1 — Generate SHA-256 hash from file buffer
    const hash = generateHash(file.buffer);

    // Step 2 — Save evidence record to MongoDB (status: pending)
    const evidence = new Evidence({
      caseId,
      fileName:         file.originalname,
      fileType:         file.mimetype,
      fileSize:         file.size,
      fileHash:         hash,
      storagePath:      file.originalname,   // replace with Firebase Storage URL when integrated
      //uploadedBy:       req.user.uid,
      uploadedBy: "test-user",
      blockchainStatus: "pending"
    });

    await evidence.save();

    // Step 3 — Anchor hash on Polygon blockchain (async, non-blocking for speed)
    // We save to DB first so the user gets a response immediately,
    // then anchor in the background and update the record.
    anchorHash(evidence._id.toString(), hash)
      .then(async (txHash) => {
        evidence.blockchainTxHash  = txHash;
        evidence.blockchainStatus  = "anchored";
        evidence.anchoredAt        = new Date();
        await evidence.save();
        console.log(`✅ Evidence ${evidence._id} anchored. TX: ${txHash}`);
      })
      .catch(async (err) => {
        evidence.blockchainStatus = "failed";
        await evidence.save();
        console.error(`❌ Blockchain anchoring failed for ${evidence._id}:`, err.message);
      });

    res.status(201).json({
      message:          "Evidence uploaded. Blockchain anchoring in progress.",
      evidenceId:       evidence._id,
      fileHash:         hash,
      blockchainStatus: "pending"
    });

  } catch (err) {
    console.error("uploadEvidence error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * POST /api/evidence/verify
 * 1. Receive file
 * 2. Generate hash
 * 3. Compare with stored hash in MongoDB
 * 4. Verify on blockchain
 * 5. If tampered → trigger n8n alert
 */
exports.verifyEvidence = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { evidenceId } = req.body;
    if (!evidenceId) {
      return res.status(400).json({ message: "evidenceId is required" });
    }

    // Step 1 — Find stored evidence
    const storedEvidence = await Evidence.findById(evidenceId);
    if (!storedEvidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    // Step 2 — Generate hash from uploaded file
    const newHash = generateHash(file.buffer);

    // Step 3 — Compare hashes
    const hashMatch = newHash === storedEvidence.fileHash;

    // Step 4 — Also verify on blockchain (if anchored)
    let blockchainVerification = null;
    if (storedEvidence.blockchainStatus === "anchored") {
      try {
        blockchainVerification = await verifyOnChain(evidenceId, newHash);
      } catch (err) {
        console.error("Blockchain verify error:", err.message);
        blockchainVerification = { valid: null, error: "Blockchain check failed" };
      }
    }

    // Step 5 — If tampered, trigger n8n alert
    if (!hashMatch) {
      await sendTamperAlert({
        evidenceId,
        fileName:     storedEvidence.fileName,
        originalHash: storedEvidence.fileHash,
        newHash,
        detectedBy:   req.user.uid
      });

      return res.json({
        status:      "TAMPERED",
        message:     "⚠️ Evidence has been tampered!",
        originalHash: storedEvidence.fileHash,
        newHash,
        blockchain:   blockchainVerification
      });
    }

    return res.json({
      status:      "VERIFIED",
      message:     "✅ Evidence integrity verified",
      hash:         newHash,
      anchoredAt:   storedEvidence.anchoredAt,
      blockchain:   blockchainVerification
    });

  } catch (err) {
    console.error("verifyEvidence error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/evidence/case/:caseId
 * Get all evidence for a case.
 */
exports.getEvidenceByCase = async (req, res) => {
  try {
    const evidence = await Evidence.find({ caseId: req.params.caseId }).sort({ createdAt: -1 });
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/evidence/:id
 * Get single evidence record with on-chain data.
 */
exports.getEvidenceById = async (req, res) => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence) return res.status(404).json({ message: "Evidence not found" });
    res.json(evidence);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
