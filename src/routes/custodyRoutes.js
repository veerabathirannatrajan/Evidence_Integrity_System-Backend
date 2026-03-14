const express           = require("express");
const router            = express.Router();
const custodyController = require("../controllers/custodyController");
const auth              = require("../middleware/authMiddleware");

// All custody routes are protected
router.post("/transfer",          auth, custodyController.transferEvidence);
router.get("/history/:evidenceId", auth, custodyController.getCustodyHistory);

module.exports = router;
