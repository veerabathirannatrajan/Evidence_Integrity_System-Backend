const admin = require("firebase-admin");
const path  = require("path");

let serviceAccount;

// Check if service account is provided as JSON string (for Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  // Otherwise use file path
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : path.resolve(__dirname, "../../serviceAccountKey.json");
  
  serviceAccount = require(serviceAccountPath);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential:    admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  console.log("✅ Firebase Admin initialized");
}

// Use getter to ensure bucket is always available
module.exports = { 
  admin,
  get bucket() {
    return admin.storage().bucket();
  }
};
