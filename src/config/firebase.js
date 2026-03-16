const admin = require("firebase-admin");
const path  = require("path");

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : path.resolve(__dirname, "../../serviceAccountKey.json");

const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential:    admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
  console.log("✅ Firebase Admin initialized");
  console.log(`📦 Storage bucket: ${admin.storage().bucket().name}`);
}

// Export both admin AND bucket
// evidenceController needs: const { bucket } = require("../config/firebase")
const bucket = admin.storage().bucket();

module.exports = { admin, bucket };