const mongoose = require("mongoose");

const evidenceSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,   // e.g. image/jpeg, video/mp4, application/pdf
    default: ""
  },
  fileSize: {
    type: Number,   // bytes
    default: 0
  },
  fileHash: {
    type: String,   // SHA-256 hex
    required: true
  },
  storagePath: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: String,   // Firebase UID
    required: true
  },

  // ─── Blockchain fields ─────────────────────────────────────────────────
  blockchainTxHash: {
    type: String,   // transaction hash returned after anchoring
    default: null
  },
  blockchainStatus: {
    type: String,
    enum: ["pending", "anchored", "failed"],
    default: "pending"
  },
  anchoredAt: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Evidence", evidenceSchema);
