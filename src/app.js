const express       = require("express");
const cors          = require("cors");

const userRoutes     = require("./routes/userRoutes");
const caseRoutes     = require("./routes/caseRoutes");
const evidenceRoutes = require("./routes/evidenceRoutes");
const custodyRoutes  = require("./routes/custodyRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// ─── Health check ──────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "Evidence Backend Running ✅", version: "1.0.0" });
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/api/user",     userRoutes);
app.use("/api/cases",    caseRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/custody",  custodyRoutes);

// ─── Global error handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

module.exports = app;
