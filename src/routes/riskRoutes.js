// ═══════════════════════════════════════════════════════════════
// FILE 1: src/routes/riskRoutes.js
// ═══════════════════════════════════════════════════════════════
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const ctrl    = require("../controllers/riskController");
router.get("/dashboard",                 auth, ctrl.getDashboard);
router.get("/stats",                     auth, ctrl.getStats);
router.get("/evidence/:evidenceId",      auth, ctrl.getRiskByEvidence);
router.get("/audit/:evidenceId",         auth, ctrl.getAuditReport);
router.patch("/:eventId/review",         auth, ctrl.reviewEvent);
router.post("/simulate",                 auth, ctrl.simulate);
module.exports = router;
// ═══════════════════════════════════════════════════════════════