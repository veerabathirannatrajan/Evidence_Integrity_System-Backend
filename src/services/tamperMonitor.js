// src/services/tamperMonitor.js
// FIXED:
//  1. _isRunning flag now ALWAYS resets in finally block (was not resetting on error)
//  2. Individual evidence check errors are isolated — one failure doesn't kill the loop
//  3. RPC errors don't crash the server — they just log and continue
//  4. Batch size limit to avoid overwhelming the RPC node
//  5. Graceful shutdown support

const Evidence        = require("../models/Evidence");
const { verifyOnChain } = require("./blockchainService");
const { sendTamperAlert } = require("./alertService");

let _isRunning  = false;
let _intervalId = null;
const BATCH_SIZE    = 10;  // Process max 10 at a time to avoid RPC rate limits
const INTERVAL_MS   = 5 * 60 * 1000;  // 5 minutes
const RPC_DELAY_MS  = 500;            // 500ms between RPC calls to avoid rate limits

/**
 * Runs every 5 minutes.
 * For every anchored evidence, re-verifies its hash on-chain.
 * If mismatch found → marks as tampered + sends n8n alert.
 */
async function runTamperCheck() {
  if (_isRunning) {
    console.log("⏭️  Tamper check already running, skipping this cycle");
    return;
  }

  _isRunning = true;
  const startTime = Date.now();
  console.log(`🔍 [${new Date().toISOString()}] Tamper check started...`);

  try {
    // Only check anchored, non-tampered evidence
    const anchored = await Evidence.find({
      blockchainStatus: "anchored",
      isTampered: { $ne: true },
    })
      .select("_id fileHash blockchainTxHash fileName caseId uploadedBy")
      .limit(50)  // Safety limit per run
      .lean();

    if (anchored.length === 0) {
      console.log("✅ Tamper check: no anchored evidence to check");
      return;
    }

    console.log(`🔍 Checking ${anchored.length} anchored evidence items...`);

    let checked = 0;
    let flagged  = 0;
    let errors   = 0;

    // Process in batches to respect RPC rate limits
    for (let i = 0; i < anchored.length; i += BATCH_SIZE) {
      const batch = anchored.slice(i, i + BATCH_SIZE);

      for (const ev of batch) {
        try {
          // Add delay between RPC calls to avoid rate limiting
          if (checked > 0) {
            await new Promise((r) => setTimeout(r, RPC_DELAY_MS));
          }

          const result = await Promise.race([
            verifyOnChain(ev._id.toString(), ev.fileHash),
            // Timeout after 15 seconds per evidence check
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("RPC timeout")), 15000)
            ),
          ]);

          if (!result.valid) {
            // Flag as tampered
            await Evidence.findByIdAndUpdate(ev._id, {
              isTampered:   true,
              tamperedAt:   new Date(),
              tamperSource: "auto_monitor",
            });

            // Send alert — non-blocking, errors are handled inside
            sendTamperAlert({
              evidenceId:        ev._id.toString(),
              fileName:          ev.fileName,
              originalHash:      ev.fileHash,
              newHash:           "blockchain_mismatch",
              detectedBy:        "system_monitor",
              blockchainTxHash:  ev.blockchainTxHash,
              caseId:            ev.caseId,
            }).catch((alertErr) =>
              console.error("Tamper alert error (non-fatal):", alertErr.message)
            );

            flagged++;
            console.warn(`🚨 Tamper detected (auto): ${ev._id} — "${ev.fileName}"`);
          }

          checked++;
        } catch (evErr) {
          // One evidence failing must NOT stop the rest
          errors++;
          if (evErr.message === "RPC timeout") {
            console.warn(`⏱️  RPC timeout for evidence ${ev._id} — skipping`);
          } else {
            console.error(`Monitor check error for ${ev._id}:`, evErr.message);
          }
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `✅ Tamper check done in ${elapsed}s — ` +
      `Checked: ${checked}, Flagged: ${flagged}, Errors: ${errors}`
    );

  } catch (err) {
    // Top-level error (e.g. MongoDB connection issue)
    console.error("❌ Tamper monitor top-level error:", err.message);
  } finally {
    // CRITICAL: Always reset the flag, even if the check crashed
    _isRunning = false;
  }
}

/**
 * Start the monitor — call once from server.js after DB connects.
 */
function startTamperMonitor() {
  if (_intervalId) {
    console.warn("⚠️  Tamper monitor already started");
    return;
  }

  console.log("🛡️  Tamper monitor started (every 5 minutes)");

  // Run first check after a 30-second delay on startup
  // (gives the server time to fully initialize)
  setTimeout(() => {
    runTamperCheck();
    _intervalId = setInterval(runTamperCheck, INTERVAL_MS);
  }, 30000);
}

/**
 * Stop the monitor (for graceful shutdown).
 */
function stopTamperMonitor() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    console.log("🛑 Tamper monitor stopped");
  }
}

module.exports = { startTamperMonitor, stopTamperMonitor, runTamperCheck };