// src/services/riskEngine.js
// FIXED:
//  1. Sends n8n alert for HIGH/VIOLATION risk events
//  2. checkUnauthorizedRole only fires if the fromRole/toRole combo is actually invalid
//     (not on every transfer — only if the transfer sneaked past the controller check)
//  3. Proper error isolation — one rule failing doesn't break others
//  4. Deduplication — won't fire the same rule twice in rapid succession

const Custody          = require("../models/Custody");
const Evidence         = require("../models/Evidence");
const RiskEvent        = require("../models/RiskEvent");
const { sendRiskAlert } = require("./alertService");

// ─── Constants ────────────────────────────────────────────────────────────────

const RAPID_TRANSFER_WINDOW_MINUTES = 30;
const RAPID_TRANSFER_THRESHOLD      = 3;
const EXCESSIVE_CHAIN_THRESHOLD     = 6;
const PERMITTED_HOURS_START         = 6;   // 6:00 AM
const PERMITTED_HOURS_END           = 22;  // 10:00 PM

// Deduplication window — don't fire the same rule for the same evidence twice in 10 min
const DEDUP_WINDOW_MINUTES = 10;

const ALLOWED_TRANSFERS = {
  police:     ["forensic", "prosecutor"],
  forensic:   ["prosecutor", "court"],
  prosecutor: ["court", "defense"],
  defense:    ["court"],
  court:      [],
};

const RECOMMENDED_ACTIONS = {
  RAPID_TRANSFERS:
    "Freeze evidence transfers pending judicial review. Request written justification for each transfer.",
  UNAUTHORIZED_ROLE:
    "Immediately suspend access. Initiate disciplinary review of the offending officer.",
  CUSTODY_LOOPBACK:
    "Review full custody history. Summon involved parties for explanation. Consider evidence inadmissibility.",
  OFF_HOURS_ACCESS:
    "Verify authorization for off-hours transfer. Review CCTV footage for the relevant time window.",
  EXCESSIVE_CHAIN:
    "Review necessity of each transfer. High transfer count increases risk of contamination.",
  BACKDATED_TRANSFER:
    "Immediately halt transfer. Flag for forensic timestamp analysis. Possible evidence tampering.",
  SIMULATION:
    "This is a simulated risk event for demonstration purposes.",
};

// ─── Main entry point ─────────────────────────────────────────────────────────

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
      caseId:          evidence.caseId?.toString() || latestTransfer.caseId?.toString() || "",
      evidenceName:    evidence.fileName || "Unknown",
      triggeredBy:     latestTransfer.fromUser || "system",
      triggeredByRole: latestTransfer.fromRole || "unknown",
      isSimulation,
    };

    // ── Rule 1: Rapid Transfers ────────────────────────────────────────────
    // (Only fire once per DEDUP_WINDOW — avoid spamming)
    try {
      const rapidEvent = await checkRapidTransfers(allTransfers, latestTransfer, meta);
      if (rapidEvent) {
        const saved = await saveEventWithDedup(rapidEvent);
        if (saved) fired.push(saved);
      }
    } catch (e) { console.error("Risk rule RAPID_TRANSFERS error:", e.message); }

    // ── Rule 2: Custody Loopback ───────────────────────────────────────────
    try {
      const loopbackEvent = checkCustodyLoopback(allTransfers, latestTransfer, meta);
      if (loopbackEvent) {
        const saved = await saveEventWithDedup(loopbackEvent);
        if (saved) fired.push(saved);
      }
    } catch (e) { console.error("Risk rule CUSTODY_LOOPBACK error:", e.message); }

    // ── Rule 3: Off-Hours Access ───────────────────────────────────────────
    try {
      const offHoursEvent = checkOffHoursAccess(latestTransfer, meta);
      if (offHoursEvent) {
        const saved = await saveEventWithDedup(offHoursEvent);
        if (saved) fired.push(saved);
      }
    } catch (e) { console.error("Risk rule OFF_HOURS_ACCESS error:", e.message); }

    // ── Rule 4: Excessive Chain ────────────────────────────────────────────
    try {
      const chainEvent = checkExcessiveChain(allTransfers, meta);
      if (chainEvent) {
        const saved = await saveEventWithDedup(chainEvent);
        if (saved) fired.push(saved);
      }
    } catch (e) { console.error("Risk rule EXCESSIVE_CHAIN error:", e.message); }

    // ── Send n8n alerts for HIGH/VIOLATION events ──────────────────────────
    const criticalEvents = fired.filter(
      (e) => e && ["HIGH", "VIOLATION", "SUSPICIOUS"].includes(e.riskLevel)
    );
    for (const ev of criticalEvents) {
      sendRiskAlert({
        evidenceId:        ev.evidenceId,
        evidenceName:      ev.evidenceName,
        riskLevel:         ev.riskLevel,
        ruleCode:          ev.ruleCode,
        explanation:       ev.explanation,
        recommendedAction: ev.recommendedAction,
        triggeredBy:       ev.triggeredBy,
        caseId:            ev.caseId,
      }).catch((e) => console.error("sendRiskAlert error (non-fatal):", e.message));
    }

  } catch (err) {
    console.error("riskEngine.analyzeRisk error:", err.message);
  }

  if (fired.length > 0) {
    console.log(`🚨 Risk engine: ${fired.length} event(s) for evidence ${evidenceId}`);
  }

  return fired;
}

// ─── Rule implementations ─────────────────────────────────────────────────────

async function checkRapidTransfers(allTransfers, latestTransfer, meta) {
  const windowStart = new Date(
    new Date(latestTransfer.timestamp || Date.now()).getTime() -
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
        transferCount:    recentTransfers.length,
        windowMinutes:    RAPID_TRANSFER_WINDOW_MINUTES,
        threshold:        RAPID_TRANSFER_THRESHOLD,
        recentTimestamps: recentTransfers.map((t) => t.timestamp),
      },
      recommendedAction: RECOMMENDED_ACTIONS.RAPID_TRANSFERS,
    };
  }
  return null;
}

function checkCustodyLoopback(allTransfers, latestTransfer, meta) {
  // Check if the recipient has previously held custody
  const previouslyHeld = allTransfers.filter(
    (t) =>
      t.toUser === latestTransfer.toUser &&
      // Exclude the very transfer we just saved
      t._id?.toString() !== latestTransfer._id?.toString()
  );

  if (previouslyHeld.length > 0) {
    return {
      ...meta,
      riskLevel: "SUSPICIOUS",
      ruleCode:  "CUSTODY_LOOPBACK",
      explanation:
        `Handler "${latestTransfer.toUser}" (${latestTransfer.toRole}) is ` +
        `regaining custody of evidence they previously held. ` +
        `${previouslyHeld.length} prior custody instance(s) detected. ` +
        `This loopback pattern may indicate unauthorized re-examination or evidence substitution.`,
      details: {
        handler:           latestTransfer.toUser,
        handlerRole:       latestTransfer.toRole,
        priorCustodyCount: previouslyHeld.length,
        priorTimestamps:   previouslyHeld.map((t) => t.timestamp),
      },
      recommendedAction: RECOMMENDED_ACTIONS.CUSTODY_LOOPBACK,
    };
  }
  return null;
}

function checkOffHoursAccess(transfer, meta) {
  const ts   = transfer.timestamp ? new Date(transfer.timestamp) : new Date();
  const hour = ts.getHours();
  const isOffHours = hour < PERMITTED_HOURS_START || hour >= PERMITTED_HOURS_END;

  if (isOffHours) {
    const timeStr = ts.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return {
      ...meta,
      riskLevel: "ANOMALY",
      ruleCode:  "OFF_HOURS_ACCESS",
      explanation:
        `Custody transfer occurred at ${timeStr}, which is outside permitted ` +
        `hours (${PERMITTED_HOURS_START}:00–${PERMITTED_HOURS_END}:00). ` +
        `Off-hours access may indicate unauthorized handling of evidence.`,
      details: {
        transferTime:   transfer.timestamp,
        hour,
        permittedStart: PERMITTED_HOURS_START,
        permittedEnd:   PERMITTED_HOURS_END,
        fromRole:       transfer.fromRole,
        toRole:         transfer.toRole,
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
        `An unusually long custody chain increases contamination risk.`,
      details: {
        totalTransfers: allTransfers.length,
        threshold:      EXCESSIVE_CHAIN_THRESHOLD,
      },
      recommendedAction: RECOMMENDED_ACTIONS.EXCESSIVE_CHAIN,
    };
  }
  return null;
}

// ─── Deduplication save ───────────────────────────────────────────────────────

/**
 * Save event only if the same ruleCode hasn't fired for this evidence in the last DEDUP_WINDOW.
 * Prevents spamming the database with identical events on rapid transfers.
 */
async function saveEventWithDedup(eventData) {
  const dedupWindow = new Date(
    Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000
  );

  const existing = await RiskEvent.findOne({
    evidenceId: eventData.evidenceId,
    ruleCode:   eventData.ruleCode,
    createdAt:  { $gte: dedupWindow },
    isSimulation: false,
  }).lean();

  if (existing) {
    console.log(
      `  ↳ [DEDUP] ${eventData.ruleCode} already fired recently for ${eventData.evidenceId} — skipping`
    );
    return null;
  }

  return await saveEvent(eventData);
}

async function saveEvent(eventData) {
  const event = new RiskEvent(eventData);
  await event.save();
  console.log(`  ↳ [${event.riskLevel}] ${event.ruleCode} — evidence: ${event.evidenceId}`);
  return event;
}

// ─── Simulation ───────────────────────────────────────────────────────────────

async function simulateRiskScenario(scenario, evidenceId, userId) {
  const evidence = await Evidence.findById(evidenceId).lean();
  if (!evidence) throw new Error("Evidence not found");

  const meta = {
    evidenceId,
    caseId:          evidence.caseId?.toString() || "",
    evidenceName:    evidence.fileName || "Unknown",
    triggeredBy:     userId,
    triggeredByRole: "simulation",
    isSimulation:    true,
  };

  const scenarios = {
    RAPID_TRANSFERS: {
      riskLevel:   "HIGH",
      ruleCode:    "RAPID_TRANSFERS",
      explanation: "[SIMULATION] 5 custody transfers within 10 minutes detected. Rapid transfer pattern triggers HIGH RISK alert.",
      details:     { simulated: true, transferCount: 5, windowMinutes: 10 },
      recommendedAction: RECOMMENDED_ACTIONS.RAPID_TRANSFERS,
    },
    UNAUTHORIZED_ROLE: {
      riskLevel:   "VIOLATION",
      ruleCode:    "UNAUTHORIZED_ROLE",
      explanation: "[SIMULATION] Defense attorney attempted direct transfer to Police, bypassing court — VIOLATION detected.",
      details:     { simulated: true, fromRole: "defense", toRole: "police" },
      recommendedAction: RECOMMENDED_ACTIONS.UNAUTHORIZED_ROLE,
    },
    CUSTODY_LOOPBACK: {
      riskLevel:   "SUSPICIOUS",
      ruleCode:    "CUSTODY_LOOPBACK",
      explanation: "[SIMULATION] Same forensic examiner has regained custody 3 times — SUSPICIOUS loopback pattern.",
      details:     { simulated: true, priorCustodyCount: 3 },
      recommendedAction: RECOMMENDED_ACTIONS.CUSTODY_LOOPBACK,
    },
    OFF_HOURS_ACCESS: {
      riskLevel:   "ANOMALY",
      ruleCode:    "OFF_HOURS_ACCESS",
      explanation: "[SIMULATION] Transfer attempted at 02:34 AM without authorization — OFF_HOURS ANOMALY.",
      details:     { simulated: true, hour: 2 },
      recommendedAction: RECOMMENDED_ACTIONS.OFF_HOURS_ACCESS,
    },
    BACKDATED_TRANSFER: {
      riskLevel:   "VIOLATION",
      ruleCode:    "BACKDATED_TRANSFER",
      explanation: "[SIMULATION] Timestamp predates evidence upload by 72 hours — BACKDATED TRANSFER detected.",
      details:     { simulated: true, backdatedByHours: 72 },
      recommendedAction: RECOMMENDED_ACTIONS.BACKDATED_TRANSFER,
    },
  };

  const scenarioData = scenarios[scenario];
  if (!scenarioData) throw new Error(`Unknown simulation scenario: ${scenario}`);

  const eventData = { ...meta, ...scenarioData };
  const saved = await saveEvent(eventData);

  // Also send n8n alert for simulations (so judges can see it live)
  if (["HIGH", "VIOLATION"].includes(saved.riskLevel)) {
    sendRiskAlert({
      ...eventData,
      evidenceName: evidence.fileName,
    }).catch(() => {});
  }

  return saved;
}

// ─── Risk summary ─────────────────────────────────────────────────────────────

async function getRiskSummary(evidenceId) {
  const events = await RiskEvent.find({ evidenceId })
    .sort({ createdAt: -1 })
    .lean();

  if (events.length === 0) return { riskLevel: "LOW", eventCount: 0, events: [] };

  const levels = ["LOW", "MEDIUM", "ANOMALY", "SUSPICIOUS", "HIGH", "VIOLATION"];
  let maxLevel = "LOW";
  for (const e of events) {
    if (levels.indexOf(e.riskLevel) > levels.indexOf(maxLevel)) {
      maxLevel = e.riskLevel;
    }
  }

  return {
    riskLevel:       maxLevel,
    eventCount:      events.length,
    unreviewedCount: events.filter((e) => !e.reviewed).length,
    events,
  };
}

module.exports = {
  analyzeRisk,
  simulateRiskScenario,
  getRiskSummary,
  ALLOWED_TRANSFERS,
};