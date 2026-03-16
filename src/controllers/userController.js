// src/controllers/userController.js
const { admin }     = require("../config/firebase");
const User          = require("../models/User");

/**
 * POST /api/user/create
 * Called after Firebase signup.
 * Saves user to MongoDB AND sets custom claim role in Firebase.
 */
exports.createUser = async (req, res) => {
  try {
    const { uid, name, email, role } = req.body;

    if (!uid || !email || !role) {
      return res.status(400).json({
        message: "uid, email and role are required",
      });
    }

    const validRoles = [
      "police", "forensic", "prosecutor", "defense", "court",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    // ── Step 1: Set Firebase custom claim ────────────────────
    // This is what the Flutter app reads from the ID token
    await admin.auth().setCustomUserClaims(uid, { role });
    console.log(`✅ Set custom claim role="${role}" for uid=${uid}`);

    // ── Step 2: Save/update in MongoDB ───────────────────────
    const user = await User.findOneAndUpdate(
      { uid },
      { uid, name: name || email.split("@")[0], email, role },
      { upsert: true, new: true }
    );

    // ── Step 3: Revoke existing tokens so claim takes effect ──
    // This forces the user to get a new token with the role claim
    await admin.auth().revokeRefreshTokens(uid);

    res.status(201).json({
      message: "User created successfully",
      user: { uid, name: user.name, email, role },
    });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/user/me
 * Returns current user's profile + role from MongoDB.
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      // User exists in Firebase but not MongoDB — create record
      return res.json({
        uid:   req.user.uid,
        email: req.user.email || "",
        role:  req.user.role  || "police",
        name:  req.user.name  || "",
      });
    }
    res.json({
      uid:   user.uid,
      email: user.email,
      role:  user.role,
      name:  user.name,
    });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * PATCH /api/user/role
 * Update a user's role (admin use).
 * Body: { uid, role }
 */
exports.updateRole = async (req, res) => {
  try {
    const { uid, role } = req.body;
    const validRoles = [
      "police", "forensic", "prosecutor", "defense", "court",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Update Firebase custom claim
    await admin.auth().setCustomUserClaims(uid, { role });
    await admin.auth().revokeRefreshTokens(uid);

    // Update MongoDB
    await User.findOneAndUpdate({ uid }, { role });

    res.json({ message: "Role updated", uid, role });
  } catch (err) {
    console.error("updateRole error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};