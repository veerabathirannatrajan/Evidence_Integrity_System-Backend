// src/models/RiskEvent.js
const mongoose = require("mongoose");

const riskEventSchema = new mongoose.Schema({
  evidenceId:   { type: String, required: true, index: true },
  caseId:       { type: String, required: true, index: true },
  evidenceName: { type: String, default: "" },

  // Risk classification
  riskLevel: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH", "VIOLATION", "SUSPICIOUS", "ANOMALY"],
    required: true,
  },

  // Which rule fired
  ruleCode: {
    type: String,
    enum: [
      "RAPID_TRANSFERS",
      "UNAUTHORIZED_ROLE",
      "CUSTODY_LOOPBACK",
      "OFF_HOURS_ACCESS",
      "EXCESSIVE_CHAIN",
      "BACKDATED_TRANSFER",
      "SIMULATION",
    ],
    required: true,
  },

  // Human-readable explanation for court
  explanation: { type: String, required: true },

  // Supporting data (flexible)
  details: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Who triggered it
  triggeredBy:   { type: String, default: "system" },  // Firebase UID
  triggeredByRole: { type: String, default: "system" },

  // Judicial action recommended
  recommendedAction: { type: String, default: "" },

  // Has a judge reviewed this?
  reviewed:    { type: Boolean, default: false },
  reviewedBy:  { type: String, default: null },
  reviewedAt:  { type: Date,   default: null },
  reviewNotes: { type: String, default: "" },

  // Is this from simulation mode?
  isSimulation: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
});

riskEventSchema.index({ evidenceId: 1, createdAt: -1 });
riskEventSchema.index({ caseId: 1,    riskLevel: 1 });
riskEventSchema.index({ reviewed: 1,  riskLevel: 1 });

module.exports = mongoose.model("RiskEvent", riskEventSchema);