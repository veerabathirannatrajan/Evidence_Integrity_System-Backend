const admin = require("../config/firebase");

/**
 * Firebase Auth Middleware
 * Verifies the Firebase ID token sent in the Authorization header.
 * On success, attaches decoded token to req.user
 * (contains: uid, email, role if custom claim was set)
 */
module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;  // uid, email, role (custom claim)
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
};
