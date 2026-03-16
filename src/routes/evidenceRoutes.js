// src/routes/evidenceRoutes.js
const express  = require("express");
const multer   = require("multer");
const router   = express.Router();
const auth     = require("../middleware/authMiddleware");
const ctrl     = require("../controllers/evidenceController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// ── Fixed routes MUST come before /:id ──────────────────────
router.get("/stats",                auth, ctrl.getStats);
router.get("/summary",              auth, ctrl.getSummary);
router.get("/recent-activity",      auth, ctrl.getRecentActivity);
router.get("/recent/:limit",        auth, ctrl.getRecentEvidence);
router.get("/cases-with-evidence",  auth, ctrl.getCasesWithEvidence);

// Public QR
router.get("/public/:id", ctrl.getEvidenceById);

// Upload + Verify (multer required)
router.post("/upload", auth, upload.single("file"), ctrl.uploadEvidence);
router.post("/verify", auth, upload.single("file"), ctrl.verifyEvidence);

// By case
router.get("/case/:caseId", auth, ctrl.getEvidenceByCase);

// Single — ALWAYS last
router.get("/:id", auth, ctrl.getEvidenceById);

// ── File proxy — streams Firebase Storage files through backend ────
// Bypasses CORS since browser requests same-origin backend URL
// GET /api/evidence/image-proxy?path=evidence/caseId/filename
// No auth needed — files are public (Storage rules: allow read: if true)
router.get("/image-proxy", async (req, res) => {
  try {
    const { bucket } = require("../config/firebase");
    const filePath = decodeURIComponent(req.query.path || "");
    if (!filePath) return res.status(400).json({ message: "path required" });

    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ message: "File not found" });

    const [meta] = await file.getMetadata();
    const contentType = meta.contentType || "application/octet-stream";
    const fileName = (meta.metadata && meta.metadata.originalFileName)
        || filePath.split("/").pop() || "file";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition",
        `inline; filename="${encodeURIComponent(fileName)}"`);
    // CORS headers for browser
    res.setHeader("Access-Control-Allow-Origin", "*");

    file.createReadStream()
      .on("error", (err) => {
        if (!res.headersSent) res.status(500).end();
      })
      .pipe(res);
  } catch (err) {
    console.error("image-proxy error:", err);
    if (!res.headersSent) res.status(500).json({ message: err.message });
  }
});

module.exports = router;