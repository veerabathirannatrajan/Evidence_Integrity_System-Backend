const express        = require("express");
const router         = express.Router();
const caseController = require("../controllers/caseController");
const auth           = require("../middleware/authMiddleware");

// All case routes are protected
router.post("/",           auth, caseController.createCase);
router.get("/",            auth, caseController.getAllCases);
router.get("/stats",       auth, caseController.getCaseStats);    // 👈 NEW
router.get("/:id",         auth, caseController.getCaseById);
router.patch("/:id",       auth, caseController.updateCase);      // 👈 NEW
router.patch("/:id/status", auth, caseController.updateCaseStatus);
router.delete("/:id",      auth, caseController.deleteCase);      // 👈 NEW

module.exports = router;