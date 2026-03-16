const mongoose = require("mongoose");

const evidenceSchema = new mongoose.Schema({

  caseId: {
    type: String,
    required: true,
  },

  fileName: {
    type: String,
    required: true,
  },

  fileType: {
    type: String,
    default: "",
  },

  fileSize: {
    type: Number,
    default: 0,
  },

  fileHash: {
    type: String,
    required: true,
  },

  // Firebase Storage path: evidence/{caseId}/{filename}
  storagePath: {
    type: String,
    required: true,
  },

  // Public download URL from Firebase Storage
  downloadURL: {
    type: String,
    default: "",
  },

  uploadedBy: {
    type: String,   // Firebase UID
    required: true,
  },

  description: {
    type: String,
    default: "",
  },

  evidenceType: {
    type: String,
    enum: ["image", "video", "audio", "document", "other"],
    default: "document",
  },

  // ── Blockchain ─────────────────────────────────────────
  blockchainTxHash: {
    type: String,
    default: null,
  },

  blockchainStatus: {
    type: String,
    enum: ["pending", "anchored", "failed"],
    default: "pending",
  },

  anchoredAt: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Evidence", evidenceSchema);