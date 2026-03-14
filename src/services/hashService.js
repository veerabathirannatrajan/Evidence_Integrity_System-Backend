const crypto = require("crypto");

/**
 * Generate SHA-256 hash from a file buffer.
 * @param {Buffer} buffer - file buffer from multer memoryStorage
 * @returns {string} hex string hash
 */
function generateHash(buffer) {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

module.exports = generateHash;
