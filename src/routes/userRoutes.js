const express        = require("express");
const router         = express.Router();
const userController = require("../controllers/userController");
const auth           = require("../middleware/authMiddleware");

// POST /api/user/create  — called once after Flutter Firebase registration
router.post("/create", auth, userController.createUser);

// GET  /api/user/me      — get logged-in user's profile
router.get("/me", auth, userController.getMe);

module.exports = router;
