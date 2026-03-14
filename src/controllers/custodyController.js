const Custody  = require("../models/Custody");
const Evidence = require("../models/Evidence");

/**
 * POST /api/custody/transfer
 * Record an evidence transfer from one user to another.
 *
 * Body: { evidenceId, toUser, reason }
 * fromUser is taken from the Firebase token (req.user.uid)
 */
exports.transferEvidence = async (req, res) => {
  try {
    const { evidenceId, toUser, reason } = req.body;

    if (!evidenceId || !toUser || !reason) {
      return res.status(400).json({
        message: "evidenceId, toUser and reason are required"
      });
    }

    // Confirm evidence exists
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: "Evidence not found" });
    }

    const transfer = new Custody({
      evidenceId,
      fromUser: req.user.uid,   // from Firebase token — no spoofing possible
      toUser,
      reason
    });

    await transfer.save();

    res.status(201).json({
      message: "Evidence transferred",
      transfer
    });

  } catch (err) {
    console.error("transferEvidence error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

/**
 * GET /api/custody/history/:evidenceId
 * Get full chain-of-custody timeline for a piece of evidence.
 * Returns transfers sorted oldest → newest.
 */
exports.getCustodyHistory = async (req, res) => {
  try {
    const history = await Custody
      .find({ evidenceId: req.params.evidenceId })
      .sort({ timestamp: 1 });

    res.json({
      evidenceId: req.params.evidenceId,
      totalTransfers: history.length,
      history
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
