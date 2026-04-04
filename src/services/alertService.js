// src/services/alertService.js
// FIXED:
//  1. Uses https/http built-in modules instead of node-fetch (no import errors)
//  2. Proper error logging with full details
//  3. Retry logic — tries up to 3 times before giving up
//  4. Payload includes all fields n8n needs
//  5. Timeout so it never hangs the server

const https = require("https");
const http  = require("http");
const url   = require("url");

/**
 * Send an HTTP POST request using Node built-ins (no external deps).
 * Works in all Node versions.
 */
function httpPost(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    const parsed = new url.URL(webhookUrl);
    const body   = JSON.stringify(payload);

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
        "User-Agent":     "EvidenceChain-Backend/1.0",
      },
    };

    const transport = parsed.protocol === "https:" ? https : http;

    const req = transport.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    // Timeout after 10 seconds
    req.setTimeout(10000, () => {
      req.destroy(new Error("Request timed out after 10s"));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Send a tamper alert to n8n webhook with retry logic.
 *
 * @param {object} data
 * @param {string} data.evidenceId
 * @param {string} data.fileName
 * @param {string} data.originalHash
 * @param {string} data.newHash
 * @param {string} data.detectedBy  - Firebase UID of the user who verified
 * @param {string} data.caseId
 */
async function sendTamperAlert(data) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.includes("your-n8n-instance")) {
    console.warn("⚠️  N8N_WEBHOOK_URL not configured — skipping tamper alert");
    return { skipped: true, reason: "N8N_WEBHOOK_URL not set" };
  }

  const payload = {
    // Core fields
    evidenceId:   data.evidenceId   || "unknown",
    fileName:     data.fileName     || "unknown",
    originalHash: data.originalHash || "",
    newHash:      data.newHash      || "",
    detectedBy:   data.detectedBy   || "system",
    caseId:       data.caseId       || "unknown",
    status:       "TAMPERED",
    detectedAt:   new Date().toISOString(),

    // Extra context for n8n workflow
    alertType:    "EVIDENCE_TAMPER",
    severity:     "CRITICAL",
    message:      `⚠️ Evidence "${data.fileName}" has been tampered! Hash mismatch detected.`,
    actionRequired: "Immediately review the evidence chain of custody and suspend access.",

    // Links (for email template)
    polygonscanUrl: data.blockchainTxHash
      ? `https://amoy.polygonscan.com/tx/${data.blockchainTxHash}`
      : null,
  };

  let lastError;
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await httpPost(webhookUrl, payload);
      console.log(`✅ Tamper alert sent to n8n (attempt ${attempt}) — evidence: ${data.evidenceId}`);
      return { sent: true, attempt };
    } catch (err) {
      lastError = err;
      console.error(`❌ Tamper alert attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);

      if (attempt < MAX_RETRIES) {
        // Wait before retry: 1s, 2s, 3s
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  console.error("❌ All tamper alert retries failed. Last error:", lastError?.message);
  // Don't throw — tamper alert failure must not crash the verify endpoint
  return { sent: false, error: lastError?.message };
}

/**
 * Send a risk alert to n8n webhook (for high-risk custody events).
 */
async function sendRiskAlert(data) {
  const webhookUrl = process.env.N8N_RISK_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.includes("your-n8n-instance")) {
    return { skipped: true };
  }

  const payload = {
    alertType:         "RISK_EVENT",
    evidenceId:        data.evidenceId,
    evidenceName:      data.evidenceName,
    riskLevel:         data.riskLevel,
    ruleCode:          data.ruleCode,
    explanation:       data.explanation,
    recommendedAction: data.recommendedAction,
    triggeredBy:       data.triggeredBy,
    caseId:            data.caseId,
    detectedAt:        new Date().toISOString(),
    severity:          data.riskLevel === "VIOLATION" ? "CRITICAL" : data.riskLevel === "HIGH" ? "HIGH" : "MEDIUM",
    message:           `🚨 Risk Event: ${data.ruleCode} detected on evidence "${data.evidenceName}"`,
  };

  try {
    await httpPost(webhookUrl, payload);
    console.log(`✅ Risk alert sent to n8n — ${data.ruleCode} on ${data.evidenceId}`);
    return { sent: true };
  } catch (err) {
    console.error("❌ Risk alert failed:", err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendTamperAlert, sendRiskAlert };