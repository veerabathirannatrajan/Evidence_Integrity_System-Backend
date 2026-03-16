// src/middleware/authMiddleware.js
const { admin } = require("../config/firebase");

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // checkRevoked: true — ensures revoked tokens after role update are rejected
    const decoded = await admin.auth().verifyIdToken(token, true);

    req.user = {
      uid:   decoded.uid,
      email: decoded.email || "",
      role:  decoded.role  || "police", // role from custom claims
      name:  decoded.name  || "",
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    if (err.code === "auth/id-token-revoked") {
      return res.status(401).json({
        message: "Token revoked. Please log in again.",
        code: "TOKEN_REVOKED",
      });
    }
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};