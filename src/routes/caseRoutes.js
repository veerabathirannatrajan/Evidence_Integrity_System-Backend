const express        = require("express");
const router         = express.Router();
const caseController = require("../controllers/caseController");
const auth           = require("../middleware/authMiddleware");

// All case routes are protected
router.post("/",     auth, caseController.createCase);
router.get("/",      auth, caseController.getAllCases);
router.get("/:id",   auth, caseController.getCaseById);

module.exports = router;
