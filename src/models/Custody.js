const mongoose = require("mongoose");

const custodySchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true
  },
  fromUser: {
    type: String,   // Firebase UID
    required: true
  },
  toUser: {
    type: String,   // Firebase UID
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Custody", custodySchema);
