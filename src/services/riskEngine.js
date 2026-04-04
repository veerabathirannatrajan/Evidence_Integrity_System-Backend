// src/services/riskEngine.js
// Core anomaly detection engine for Evidence Risk Intelligence
// Called after every custody transfer — runs all rules, saves flagged events

const Custody   = require("../models/Custody");
const Evidence  = require("../models/Evidence");
const RiskEvent = require("../models/RiskEvent");

// ─── Constants ────────────────────────────────────────────────────────────────

const RAPID_TRANSFER_WINDOW_MINUTES = 30;
const RAPID_TRANSFER_THRESHOLD      = 3;   // 3+ transfers in window = HIGH RISK
const EXCESSIVE_CHAIN_THRESHOLD     = 6;   // 6+ total transfers = MEDIUM
const PERMITTED_HOURS_START         = 6;   // 6:00 AM
const PERMITTED_HOURS_END           = 22;  // 10:00 PM

const ALLOWED_TRANSFERS = {
  police:     ["forensic", "prosecutor"],
  forensic:   ["prosecutor", "court"],
  prosecutor: ["court", "defense"],
  defense:    ["court"],
  court:      [],
};

const RECOMMENDED_ACTIONS = {
  RAPID_TRANSFERS:    "Freeze evidence transfers pending judicial review. Request written justification for each transfer.",
  UNAUTHORIZED_ROLE:  "Immediately suspend access. Initiate disciplinary review of the offending officer.",
  CUSTODY_LOOPBACK:   "Review full custody history. Summon involved parties for explanation. Consider evidence inadmissibility.",
  OFF_HOURS_ACCESS:   "Verify authorization for off-hours transfer. Review CCTV footage for the relevant time window.",
  EXCESSIVE_CHAIN:    "Review necessity of each transfer. High transfer count increases risk of contamination.",
  BACKDATED_TRANSFER: "Immediately halt transfer. Flag for forensic timestamp analysis. Possible evidence tampering.",
  SIMULATION:         "This is a simulated risk event for demonstration purposes.",
};

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run all risk rules for a given evidence item after a custody event.
 * @param {string} evidenceId
 * @param {object} latestTransfer - the Custody record just saved
 * @param {boolean} isSimulation
 * @returns {Promise<RiskEvent[]>} - array of fired risk events
 */
async function analyzeRisk(evidenceId, latestTransfer, isSimulation = false) {
  const fired = [];

  try {
    const [evidence, allTransfers] = await Promise.all([
      Evidence.findById(evidenceId).lean(),
      Custody.find({ evidenceId }).sort({ timestamp: 1 }).lean(),
    ]);

    if (!evidence) return fired;

    const meta = {
      evidenceId,
      caseId:       evidence.caseId?.toString() || latestTransfer.caseId,
      evidenceName: evidence.fileName || "Unknown",
      triggeredBy:  latestTransfer.fromUser,
      triggeredByRole: latestTransfer.fromRole,
      isSimulation,
    };

    // ── Rule 1: Unauthorized Role ──────────────────────────────────────────
    const unauthorizedEvent = checkUnauthorizedRole(latestTransfer, meta);
    if (unauthorizedEvent) fired.push(await saveEvent(unauthorizedEvent));

    // ── Rule 2: Rapid Transfers ────────────────────────────────────────────
    const rapidEvent = checkRapidTransfers(allTransfers, latestTransfer, meta);
    if (rapidEvent) fired.push(await saveEvent(rapidEvent));

    // ── Rule 3: Custody Loopback ───────────────────────────────────────────
    const loopbackEvent = checkCustodyLoopback(allTransfers, latestTransfer, meta);
    if (loopbackEvent) fired.push(await saveEvent(loopbackEvent));

    // ── Rule 4: Off-Hours Access ───────────────────────────────────────────
    const offHoursEvent = checkOffHoursAccess(latestTransfer, meta);
    if (offHoursEvent) fired.push(await saveEvent(offHoursEvent));

    // ── Rule 5: Excessive Chain ────────────────────────────────────────────
    const chainEvent = checkExcessiveChain(allTransfers, meta);
    if (chainEvent) fired.push(await saveEvent(chainEvent));

  } catch (err) {
    console.error("riskEngine.analyzeRisk error:", err.message);
  }

  if (fired.length > 0) {
    console.log(`🚨 Risk engine fired ${fired.length} event(s) for evidence ${evidenceId}`);
  }

  return fired;
}

// ─── Rule implementations ─────────────────────────────────────────────────────

function checkUnauthorizedRole(transfer, meta) {
  const { fromRole, toRole } = transfer;
  const allowed = ALLOWED_TRANSFERS[fromRole] || [];

  if (!allowed.includes(toRole)) {
    return {
      ...meta,
      riskLevel:  "VIOLATION",
      ruleCode:   "UNAUTHORIZED_ROLE",
      explanation:
        `Role "${fromRole}" attempted to transfer evidence to "${toRole}", ` +
        `which is not permitted. Allowed targets for ${fromRole}: ` +
        `[${allowed.join(", ") || "none"}].`,
      details: { fromRole, toRole, allowedRoles: allowed },
      recommendedAction: RECOMMENDED_ACTIONS.UNAUTHORIZED_ROLE,
    };
  }
  return null;
}

function checkRapidTransfers(allTransfers, latestTransfer, meta) {
  const windowStart = new Date(
    new Date(latestTransfer.timestamp).getTime() -
    RAPID_TRANSFER_WINDOW_MINUTES * 60 * 1000
  );

  const recentTransfers = allTransfers.filter(
    (t) => new Date(t.timestamp) >= windowStart
  );

  if (recentTransfers.length >= RAPID_TRANSFER_THRESHOLD) {
    return {
      ...meta,
      riskLevel: "HIGH",
      ruleCode:  "RAPID_TRANSFERS",
      explanation:
        `${recentTransfers.length} custody transfers occurred within a ` +
        `${RAPID_TRANSFER_WINDOW_MINUTES}-minute window. This is highly unusual ` +
        `and may indicate evidence manipulation or unauthorized chain-of-custody bypassing.`,
      details: {
        transferCount: recentTransfers.length,
        windowMinutes: RAPID_TRANSFER_WINDOW_MINUTES,
        threshold:     RAPID_TRANSFER_THRESHOLD,
        recentTimestamps: recentTransfers.map(t => t.timestamp),
      },
      recommendedAction: RECOMMENDED_ACTIONS.RAPID_TRANSFERS,
    };
  }
  return null;
}

function checkCustodyLoopback(allTransfers, latestTransfer, meta) {
  // Check if this user has previously held custody of this evidence
  const previouslyHeld = allTransfers.filter(
    (t) =>
      t.toUser === latestTransfer.toUser &&
      t._id.toString() !== latestTransfer._id?.toString()
  );

  if (previouslyHeld.length > 0) {
    return {
      ...meta,
      riskLevel: "SUSPICIOUS",
      ruleCode:  "CUSTODY_LOOPBACK",
      explanation:
        `Handler "${latestTransfer.toUser}" (${latestTransfer.toRole}) is ` +
        `regaining custody of evidence they previously held. This loopback pattern ` +
        `(${previouslyHeld.length} prior custody instance(s)) may indicate ` +
        `unauthorized re-examination or evidence substitution.`,
      details: {
        handler:           latestTransfer.toUser,
        handlerRole:       latestTransfer.toRole,
        priorCustodyCount: previouslyHeld.length,
        priorTimestamps:   previouslyHeld.map(t => t.timestamp),
      },
      recommendedAction: RECOMMENDED_ACTIONS.CUSTODY_LOOPBACK,
    };
  }
  return null;
}

function checkOffHoursAccess(transfer, meta) {
  const hour = new Date(transfer.timestamp).getHours();
  const isOffHours = hour < PERMITTED_HOURS_START || hour >= PERMITTED_HOURS_END;

  if (isOffHours) {
    const timeStr = new Date(transfer.timestamp).toLocaleTimeString();
    return {
      ...meta,
      riskLevel: "ANOMALY",
      ruleCode:  "OFF_HOURS_ACCESS",
      explanation:
        `Custody transfer occurred at ${timeStr}, which is outside permitted ` +
        `hours (${PERMITTED_HOURS_START}:00–${PERMITTED_HOURS_END}:00). ` +
        `Off-hours access may indicate unauthorized handling of evidence.`,
      details: {
        transferTime:    transfer.timestamp,
        hour,
        permittedStart:  PERMITTED_HOURS_START,
        permittedEnd:    PERMITTED_HOURS_END,
        fromRole:        transfer.fromRole,
        toRole:          transfer.toRole,
      },
      recommendedAction: RECOMMENDED_ACTIONS.OFF_HOURS_ACCESS,
    };
  }
  return null;
}

function checkExcessiveChain(allTransfers, meta) {
  if (allTransfers.length >= EXCESSIVE_CHAIN_THRESHOLD) {
    return {
      ...meta,
      riskLevel: "MEDIUM",
      ruleCode:  "EXCESSIVE_CHAIN",
      explanation:
        `This evidence has been transferred ${allTransfers.length} times, ` +
        `exceeding the recommended maximum of ${EXCESSIVE_CHAIN_THRESHOLD - 1}. ` +
        `An unusually long custody chain increases the risk of contamination, ` +
        `mishandling, or intentional interference.`,
      details: {
        totalTransfers: allTransfers.length,
        threshold:      EXCESSIVE_CHAIN_THRESHOLD,
      },
      recommendedAction: RECOMMENDED_ACTIONS.EXCESSIVE_CHAIN,
    };
  }
  return null;
}

// ─── Save a risk event ────────────────────────────────────────────────────────

async function saveEvent(eventData) {
  const event = new RiskEvent(eventData);
  await event.save();
  console.log(`  ↳ [${event.riskLevel}] ${event.ruleCode} — evidence: ${event.evidenceId}`);
  return event;
}

// ─── Simulation helpers ───────────────────────────────────────────────────────

/**
 * Simulate a specific risk scenario and save a risk event.
 * Called by the simulation endpoint.
 */
async function simulateRiskScenario(scenario, evidenceId, userId) {
  const evidence = await Evidence.findById(evidenceId).lean();
  if (!evidence) throw new Error("Evidence not found");

  const meta = {
    evidenceId,
    caseId:       evidence.caseId?.toString(),
    evidenceName: evidence.fileName,
    triggeredBy:  userId,
    triggeredByRole: "simulation",
    isSimulation: true,
    recommendedAction: RECOMMENDED_ACTIONS.SIMULATION,
  };

  let eventData;

  switch (scenario) {
    case "RAPID_TRANSFERS":
      eventData = {
        ...meta,
        riskLevel:   "HIGH",
        ruleCode:    "RAPID_TRANSFERS",
        explanation: "[SIMULATION] Simulated rapid transfers: 5 custody transfers within 10 minutes detected.",
        details:     { simulated: true, transferCount: 5, windowMinutes: 10 },
      };
      break;

    case "UNAUTHORIZED_ROLE":
      eventData = {
        ...meta,
        riskLevel:   "VIOLATION",
        ruleCode:    "UNAUTHORIZED_ROLE",
        explanation: "[SIMULATION] Simulated unauthorized access: Defense attorney attempted direct transfer to Police, bypassing court.",
        details:     { simulated: true, fromRole: "defense", toRole: "police" },
      };
      break;

    case "CUSTODY_LOOPBACK":
      eventData = {
        ...meta,
        riskLevel:   "SUSPICIOUS",
        ruleCode:    "CUSTODY_LOOPBACK",
        explanation: "[SIMULATION] Simulated custody loopback: Same forensic examiner has regained custody 3 times.",
        details:     { simulated: true, priorCustodyCount: 3 },
      };
      break;

    case "OFF_HOURS_ACCESS":
      eventData = {
        ...meta,
        riskLevel:   "ANOMALY",
        ruleCode:    "OFF_HOURS_ACCESS",
        explanation: "[SIMULATION] Simulated off-hours access: Transfer attempted at 02:34 AM without authorization.",
        details:     { simulated: true, hour: 2 },
      };
      break;

    case "BACKDATED_TRANSFER":
      eventData = {
        ...meta,
        riskLevel:   "VIOLATION",
        ruleCode:    "BACKDATED_TRANSFER",
        explanation: "[SIMULATION] Simulated backdated transfer: Timestamp on transfer record predates evidence upload by 72 hours.",
        details:     { simulated: true, backdatedByHours: 72 },
        recommendedAction: RECOMMENDED_ACTIONS.BACKDATED_TRANSFER,
      };
      break;

    default:
      throw new Error(`Unknown simulation scenario: ${scenario}`);
  }

  return await saveEvent(eventData);
}

// ─── Risk summary for a single evidence item ──────────────────────────────────

async function getRiskSummary(evidenceId) {
  const events = await RiskEvent.find({ evidenceId })
    .sort({ createdAt: -1 })
    .lean();

  if (events.length === 0) return { riskLevel: "LOW", eventCount: 0, events: [] };

  // Determine highest risk level
  const levels = ["LOW", "MEDIUM", "ANOMALY", "SUSPICIOUS", "HIGH", "VIOLATION"];
  let maxLevel = "LOW";
  for (const e of events) {
    if (levels.indexOf(e.riskLevel) > levels.indexOf(maxLevel)) {
      maxLevel = e.riskLevel;
    }
  }

  return {
    riskLevel:    maxLevel,
    eventCount:   events.length,
    unreviewedCount: events.filter(e => !e.reviewed).length,
    events,
  };
}

module.exports = {
  analyzeRisk,
  simulateRiskScenario,
  getRiskSummary,
  ALLOWED_TRANSFERS,
};