const fetch = require("node-fetch");

/**
 * Send a tamper alert to n8n webhook.
 * n8n will forward it as WhatsApp + Email notification.
 *
 * @param {object} data
 * @param {string} data.evidenceId
 * @param {string} data.fileName
 * @param {string} data.originalHash
 * @param {string} data.newHash
 * @param {string} data.detectedBy  - Firebase UID of the user who verified
 */
async function sendTamperAlert(data) {
  if (!process.env.N8N_WEBHOOK_URL) {
    console.warn("N8N_WEBHOOK_URL not set — skipping alert");
    return;
  }

  try {
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidenceId:   data.evidenceId,
        fileName:     data.fileName,
        originalHash: data.originalHash,
        newHash:      data.newHash,
        detectedBy:   data.detectedBy,
        detectedAt:   new Date().toISOString(),
        status:       "TAMPERED"
      })
    });
    console.log("🚨 Tamper alert sent to n8n for evidence:", data.evidenceId);
  } catch (err) {
    console.error("Failed to send tamper alert:", err.message);
  }
}

module.exports = { sendTamperAlert };
