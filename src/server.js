// src/server.js
// FIXED:
//  1. Graceful shutdown — stops tamper monitor before closing
//  2. Uncaught exception handler — prevents server crash on unhandled errors
//  3. Firebase init error is caught — won't crash server
//  4. Tamper monitor only starts after DB is confirmed connected

require("dotenv").config();

const app       = require("./app");
const connectDB = require("./config/db");
const { startTamperMonitor, stopTamperMonitor } = require("./services/tamperMonitor");

// ── Handle uncaught exceptions (prevents crashes) ──────────────────────────
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err.message);
  console.error(err.stack);
  // Don't exit — keep server running for non-critical errors
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ UNHANDLED REJECTION at:", promise);
  console.error("Reason:", reason);
  // Don't exit
});

// ── Init Firebase Admin ───────────────────────────────────────────────────
try {
  require("./config/firebase");
} catch (fbErr) {
  console.error("❌ Firebase init error:", fbErr.message);
  console.error("Server will continue but Firebase features may not work.");
}

// ── Connect DB then start server ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    // Start tamper monitor only after DB is ready
    startTamperMonitor();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
    });

    // ── Graceful shutdown ───────────────────────────────────────────────
    function shutdown(signal) {
      console.log(`\n${signal} received — shutting down gracefully...`);
      stopTamperMonitor();
      server.close(() => {
        console.log("✅ Server closed");
        process.exit(0);
      });
      // Force exit after 10s if something hangs
      setTimeout(() => {
        console.error("⚠️  Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });