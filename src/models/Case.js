const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
  // ── New fields ─────────────────────────────────────────────
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },

  caseType: {
    type: String,
    enum: ["criminal", "civil", "cyber", "fraud", "narcotics", "other"],
    default: "criminal",
  },

  location: {
    type: String,
    default: "",
    trim: true,
  },

  caseRef: {
    type: String,
    default: "",
    trim: true,
  },

  incidentDate: {
    type: Date,
    default: Date.now,
  },

  // ── Existing fields (enhanced) ─────────────────────────────
  title: {
    type: String,
    required: true,
    trim: true,  // Added trim
  },

  description: {
    type: String,
    default: "",
    trim: true,  // Added trim
  },

  createdBy: {
    type: String,   // Firebase UID
    required: true,
  },

  status: {
    type: String,
    enum: ["open", "closed", "under_review"],
    default: "open",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Case", caseSchema);