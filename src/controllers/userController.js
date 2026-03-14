const admin = require("../config/firebase");
const User  = require("../models/User");

/**
 * POST /api/user/create
 * Called once after Flutter registers the user with Firebase Auth.
 * Saves user to MongoDB and sets role as a Firebase custom claim.
 *
 * Body: { uid, name, email, role }
 * Auth: Bearer token required (user must be logged in)
 */
exports.createUser = async (req, res) => {
  try {
    const { uid, name, email, role } = req.body;

    // Validate role
    const validRoles = ["police", "forensic", "prosecutor", "defense", "court"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Check if user already exists
    const existing = await User.findOne({ uid });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Set role as Firebase custom claim
    // After this, req.user.role will be available in every protected request
    await admin.auth().setCustomUserClaims(uid, { role });

    // Save to MongoDB
    const user = new User({ uid, name, email, role });
    await user.save();

    res.status(201).json({
      message: "User created successfully",
      user: { uid, name, email, role }
    });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/user/me
 * Returns the current logged-in user's profile from MongoDB.
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid }).select("-__v");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
