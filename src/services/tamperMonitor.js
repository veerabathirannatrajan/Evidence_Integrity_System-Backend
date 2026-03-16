const Evidence       = require("../models/Evidence");
const { verifyOnChain } = require("./blockchainService");
const { sendTamperAlert } = require("./alertService");

let _isRunning = false;

/**
 * Runs every 5 minutes.
 * For every anchored evidence, re-verifies its hash on-chain.
 * If mismatch found → marks as tampered + sends n8n alert.
 */
async function runTamperCheck() {
  if (_isRunning) return;
  _isRunning = true;

  console.log(`🔍 [${new Date().toISOString()}] Running tamper check...`);

  try {
    const anchored = await Evidence.find({
      blockchainStatus: "anchored",
      isTampered: { $ne: true },        // skip already flagged
    }).select("_id fileHash blockchainTxHash fileName caseId uploadedBy");

    let checked = 0, flagged = 0;

    for (const ev of anchored) {
      try {
        const result = await verifyOnChain(
          ev._id.toString(), ev.fileHash
        );

        if (!result.valid) {
          // Flag as tampered
          await Evidence.findByIdAndUpdate(ev._id, {
            isTampered:      true,
            tamperedAt:      new Date(),
            tamperSource:    "auto_monitor",
          });

          // Send alert
          await sendTamperAlert({
            evidenceId:   ev._id.toString(),
            fileName:     ev.fileName,
            originalHash: ev.fileHash,
            newHash:      "blockchain_mismatch",
            detectedBy:   "system_monitor",
          });

          flagged++;
          console.warn(`🚨 Tamper detected (auto): ${ev._id} — ${ev.fileName}`);
        }

        checked++;
      } catch (err) {
        console.error(`Monitor check error for ${ev._id}:`, err.message);
      }
    }

    console.log(
      `✅ Tamper check done. Checked: ${checked}, Flagged: ${flagged}`
    );
  } catch (err) {
    console.error("Tamper monitor error:", err);
  } finally {
    _isRunning = false;
  }
}

/**
 * Start the monitor — call once from server.js
 */
function startTamperMonitor() {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  console.log("🛡️  Tamper monitor started (every 5 minutes)");

  // Run immediately on startup
  runTamperCheck();

  // Then every 5 minutes
  setInterval(runTamperCheck, INTERVAL_MS);
}

module.exports = { startTamperMonitor, runTamperCheck };