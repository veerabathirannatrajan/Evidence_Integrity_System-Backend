const express            = require("express");
const multer             = require("multer");
const router             = express.Router();
const evidenceController = require("../controllers/evidenceController");
const auth               = require("../middleware/authMiddleware");

// Store file in memory so we can hash the buffer before saving
const upload = multer({ storage: multer.memoryStorage() });

// All evidence routes are protected

router.post("/upload",       auth, upload.single("file"), evidenceController.uploadEvidence);
router.post("/verify",       auth, upload.single("file"), evidenceController.verifyEvidence);
router.get("/case/:caseId",  auth, evidenceController.getEvidenceByCase);
router.get("/:id",           auth, evidenceController.getEvidenceById);


// router.post("/upload", upload.single("file"), evidenceController.uploadEvidence);
// router.post("/verify", upload.single("file"), evidenceController.verifyEvidence);
// router.get("/case/:caseId", evidenceController.getEvidenceByCase);
// router.get("/:id", evidenceController.getEvidenceById);

module.exports = router;
