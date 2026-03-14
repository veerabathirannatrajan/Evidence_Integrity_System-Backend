const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  createdBy: {
    type: String,   // Firebase UID of the officer who created the case
    required: true
  },
  status: {
    type: String,
    enum: ["open", "closed", "under_review"],
    default: "open"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Case", caseSchema);
