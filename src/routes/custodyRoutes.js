// src/routes/custodyRoutes.js
const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/authMiddleware");
const ctrl    = require("../controllers/custodyController");

router.post("/transfer",           auth, ctrl.transferCustody);
router.get("/history/:evidenceId", auth, ctrl.getCustodyHistory);
router.get("/case/:caseId",        auth, ctrl.getCustodyByCase);
router.get("/allowed-roles",       auth, ctrl.getAllowedRoles);

module.exports = router;