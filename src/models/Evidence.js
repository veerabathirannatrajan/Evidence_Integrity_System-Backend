// src/models/Evidence.js
const mongoose = require("mongoose");

const evidenceSchema = new mongoose.Schema({
  caseId:       { type: String, required: true },
  fileName:     { type: String, required: true },
  fileType:     { type: String, default: "" },
  fileSize:     { type: Number, default: 0 },
  fileHash:     { type: String, required: true },   // original SHA-256
  storagePath:  { type: String, required: true },
  downloadURL:  { type: String, default: "" },
  uploadedBy:   { type: String, required: true },
  description:  { type: String, default: "" },
  evidenceType: {
    type: String,
    enum: ["image", "video", "audio", "document", "other"],
    default: "document",
  },

  // ── Blockchain ───────────────────────────────────────────
  blockchainTxHash: { type: String, default: null },
  blockchainStatus: {
    type: String,
    enum: ["pending", "anchored", "failed"],
    default: "pending",
  },
  anchoredAt: { type: Date, default: null },

  // ── Tamper tracking ──────────────────────────────────────
  isTampered:   { type: Boolean, default: false },
  tamperedAt:   { type: Date,    default: null },
  tamperSource: { type: String,  default: null },   // "manual_verify" | "auto_monitor"
  tamperedHash: { type: String,  default: null },   // hash of the modified file

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Evidence", evidenceSchema);