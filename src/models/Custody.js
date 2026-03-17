// src/models/Custody.js
const mongoose = require("mongoose");

const custodySchema = new mongoose.Schema({
  evidenceId:   { type: String, required: true },
  caseId:       { type: String, required: true },
  evidenceName: { type: String, default: "" },

  // Who sent and who received
  fromUser:     { type: String, required: true }, // Firebase UID
  fromRole:     { type: String, required: true }, // police/forensic/prosecutor/defense/court
  fromName:     { type: String, default: "" },    // display name/email

  toUser:       { type: String, required: true }, // Firebase UID or email
  toRole:       { type: String, required: true }, // target role
  toName:       { type: String, default: "" },    // display name/email

  reason:       { type: String, required: true },
  notes:        { type: String, default: "" },

  // Chain position (1 = first transfer, 2 = second, etc.)
  chainPosition: { type: Number, default: 1 },

  // Verification hash at time of transfer (confirms no tampering before handoff)
  hashAtTransfer: { type: String, default: "" },

  timestamp: { type: Date, default: Date.now },
});

// Index for fast lookup
custodySchema.index({ evidenceId: 1, timestamp: 1 });
custodySchema.index({ caseId: 1, timestamp: -1 });

module.exports = mongoose.model("Custody", custodySchema);