// src/controllers/riskController.js
const RiskEvent  = require("../models/RiskEvent");
const Evidence   = require("../models/Evidence");
const Case       = require("../models/Case");
const Custody    = require("../models/Custody");
const { simulateRiskScenario, getRiskSummary } = require("../services/riskEngine");

// ─────────────────────────────────────────────────────────────
// GET /api/risk/dashboard
// Court-facing dashboard — all risk events with evidence + case context
// ─────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const filter = {};
    if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;
    if (req.query.reviewed === "false") filter.reviewed = false;
    if (req.query.caseId) filter.caseId = req.query.caseId;

    const events = await RiskEvent.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // Group by evidenceId for the dashboard view
    const evidenceMap = {};
    for (const ev of events) {
      const eid = ev.evidenceId;
      if (!evidenceMap[eid]) {
        evidenceMap[eid] = {
          evidenceId:   eid,
          evidenceName: ev.evidenceName,
          caseId:       ev.caseId,
          riskLevel:    ev.riskLevel,
          events:       [],
        };
      }
      // Escalate risk level if needed
      const levels = ["LOW","MEDIUM","ANOMALY","SUSPICIOUS","HIGH","VIOLATION"];
      if (levels.indexOf(ev.riskLevel) > levels.indexOf(evidenceMap[eid].riskLevel)) {
        evidenceMap[eid].riskLevel = ev.riskLevel;
      }
      evidenceMap[eid].events.push(ev);
    }

    // Attach current custodian from Custody collection
    const evidenceIds = Object.keys(evidenceMap);
    for (const eid of evidenceIds) {
      const lastTransfer = await Custody.findOne({ evidenceId: eid })
        .sort({ timestamp: -1 })
        .lean();
      evidenceMap[eid].currentCustodian = lastTransfer
        ? { user: lastTransfer.toUser, role: lastTransfer.toRole, name: lastTransfer.toName }
        : null;

      // Recommended judicial action = highest-priority unreviewed recommendation
      const unreviewed = evidenceMap[eid].events.filter(e => !e.reviewed);
      if (unreviewed.length > 0) {
        evidenceMap[eid].recommendedAction = unreviewed[0].recommendedAction || "";
      }
    }

    // Stats
    const totalEvents    = await RiskEvent.countDocuments({});
    const highRisk       = await RiskEvent.countDocuments({ riskLevel: { $in: ["HIGH", "VIOLATION"] } });
    const unreviewed     = await RiskEvent.countDocuments({ reviewed: false });
    const simulations    = await RiskEvent.countDocuments({ isSimulation: true });

    return res.json({
      stats: { totalEvents, highRisk, unreviewed, simulations },
      items: Object.values(evidenceMap),
      raw:   events,
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/risk/evidence/:evidenceId
// All risk events for a single evidence item
// ─────────────────────────────────────────────────────────────
exports.getRiskByEvidence = async (req, res) => {
  try {
    const { evidenceId } = req.params;
    const summary = await getRiskSummary(evidenceId);

    // Also get evidence metadata
    const evidence = await Evidence.findById(evidenceId).lean();
    const lastCustody = await Custody.findOne({ evidenceId })
      .sort({ timestamp: -1 }).lean();

    return res.json({
      ...summary,
      evidence: evidence || null,
      currentCustodian: lastCustody
        ? { user: lastCustody.toUser, role: lastCustody.toRole, name: lastCustody.toName }
        : null,
    });
  } catch (err) {
    console.error("getRiskByEvidence error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/risk/:eventId/review
// Mark a risk event as reviewed by a judge/court official
// Body: { reviewNotes }
// ─────────────────────────────────────────────────────────────
exports.reviewEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { reviewNotes } = req.body;

    const event = await RiskEvent.findByIdAndUpdate(
      eventId,
      {
        reviewed:    true,
        reviewedBy:  req.user.uid,
        reviewedAt:  new Date(),
        reviewNotes: reviewNotes || "",
      },
      { new: true }
    );

    if (!event) return res.status(404).json({ message: "Risk event not found" });

    return res.json({ message: "Risk event reviewed", event });
  } catch (err) {
    console.error("reviewEvent error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/risk/simulate
// Simulate an abnormal scenario
// Body: { scenario, evidenceId }
// Scenarios: RAPID_TRANSFERS | UNAUTHORIZED_ROLE | CUSTODY_LOOPBACK
//            | OFF_HOURS_ACCESS | BACKDATED_TRANSFER
// ─────────────────────────────────────────────────────────────
exports.simulate = async (req, res) => {
  try {
    const { scenario, evidenceId } = req.body;

    if (!scenario || !evidenceId) {
      return res.status(400).json({ message: "scenario and evidenceId are required" });
    }

    const validScenarios = [
      "RAPID_TRANSFERS",
      "UNAUTHORIZED_ROLE",
      "CUSTODY_LOOPBACK",
      "OFF_HOURS_ACCESS",
      "BACKDATED_TRANSFER",
    ];

    if (!validScenarios.includes(scenario)) {
      return res.status(400).json({
        message: `Invalid scenario. Valid options: ${validScenarios.join(", ")}`,
      });
    }

    const event = await simulateRiskScenario(scenario, evidenceId, req.user.uid);

    return res.status(201).json({
      message: `Simulation "${scenario}" executed successfully`,
      event,
    });
  } catch (err) {
    console.error("simulate error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/risk/stats
// Risk statistics for dashboard widgets
// ─────────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [total, violations, high, suspicious, anomalies, medium, unreviewed] =
      await Promise.all([
        RiskEvent.countDocuments({}),
        RiskEvent.countDocuments({ riskLevel: "VIOLATION" }),
        RiskEvent.countDocuments({ riskLevel: "HIGH" }),
        RiskEvent.countDocuments({ riskLevel: "SUSPICIOUS" }),
        RiskEvent.countDocuments({ riskLevel: "ANOMALY" }),
        RiskEvent.countDocuments({ riskLevel: "MEDIUM" }),
        RiskEvent.countDocuments({ reviewed: false }),
      ]);

    // Recent events (last 24h)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last24h = await RiskEvent.countDocuments({ createdAt: { $gte: since24h } });

    // Most risky evidence
    const topRisky = await RiskEvent.aggregate([
      { $group: { _id: "$evidenceId", count: { $sum: 1 }, evidenceName: { $first: "$evidenceName" }, latestLevel: { $last: "$riskLevel" } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    return res.json({
      total, violations, high, suspicious, anomalies, medium, unreviewed, last24h,
      topRisky,
    });
  } catch (err) {
    console.error("getStats error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/risk/audit/:evidenceId
// Generate audit explanation report for a specific evidence item
// ─────────────────────────────────────────────────────────────
exports.getAuditReport = async (req, res) => {
  try {
    const { evidenceId } = req.params;

    const [evidence, events, custodyChain] = await Promise.all([
      Evidence.findById(evidenceId).lean(),
      RiskEvent.find({ evidenceId }).sort({ createdAt: 1 }).lean(),
      Custody.find({ evidenceId }).sort({ timestamp: 1 }).lean(),
    ]);

    if (!evidence) return res.status(404).json({ message: "Evidence not found" });

    const levels = ["LOW","MEDIUM","ANOMALY","SUSPICIOUS","HIGH","VIOLATION"];
    let overallRisk = "LOW";
    for (const e of events) {
      if (levels.indexOf(e.riskLevel) > levels.indexOf(overallRisk)) {
        overallRisk = e.riskLevel;
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      evidence: {
        id:               evidence._id,
        fileName:         evidence.fileName,
        fileHash:         evidence.fileHash,
        blockchainStatus: evidence.blockchainStatus,
        uploadedBy:       evidence.uploadedBy,
        caseId:           evidence.caseId,
        createdAt:        evidence.createdAt,
      },
      overallRiskLevel: overallRisk,
      custodyChainLength: custodyChain.length,
      riskEventCount: events.length,
      riskBreakdown: {
        VIOLATION:  events.filter(e => e.riskLevel === "VIOLATION").length,
        HIGH:       events.filter(e => e.riskLevel === "HIGH").length,
        SUSPICIOUS: events.filter(e => e.riskLevel === "SUSPICIOUS").length,
        ANOMALY:    events.filter(e => e.riskLevel === "ANOMALY").length,
        MEDIUM:     events.filter(e => e.riskLevel === "MEDIUM").length,
      },
      riskEvents: events.map(e => ({
        riskLevel:         e.riskLevel,
        ruleCode:          e.ruleCode,
        explanation:       e.explanation,
        recommendedAction: e.recommendedAction,
        triggeredAt:       e.createdAt,
        reviewed:          e.reviewed,
        reviewNotes:       e.reviewNotes,
        isSimulation:      e.isSimulation,
      })),
      custodyTimeline: custodyChain.map(c => ({
        from:      `${c.fromName} (${c.fromRole})`,
        to:        `${c.toName} (${c.toRole})`,
        reason:    c.reason,
        timestamp: c.timestamp,
        position:  c.chainPosition,
      })),
      courtRecommendation: _getCourtRecommendation(overallRisk, events),
    };

    return res.json(report);
  } catch (err) {
    console.error("getAuditReport error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

function _getCourtRecommendation(riskLevel, events) {
  if (riskLevel === "VIOLATION") {
    return "IMMEDIATE ACTION REQUIRED: Critical violations detected. Evidence should be considered inadmissible until a full judicial investigation is completed. All involved parties must be summoned.";
  }
  if (riskLevel === "HIGH") {
    return "HIGH PRIORITY REVIEW: Suspicious transfer patterns detected. Recommend freezing further transfers and conducting a formal custody review before admitting evidence.";
  }
  if (riskLevel === "SUSPICIOUS") {
    return "JUDICIAL REVIEW RECOMMENDED: Loopback patterns detected in custody chain. Evidence integrity may be compromised. Request written justification from all custodians.";
  }
  if (riskLevel === "ANOMALY") {
    return "MONITOR AND VERIFY: Off-hours anomalies detected. Verify authorization documentation for flagged transfers.";
  }
  if (riskLevel === "MEDIUM") {
    return "REVIEW CHAIN LENGTH: Extended custody chain noted. Review necessity of each transfer and confirm no contamination occurred.";
  }
  return "CLEARED: No significant risk events detected. Evidence custody chain appears intact and within normal parameters.";
}