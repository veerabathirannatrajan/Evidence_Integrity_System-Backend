const admin = require("firebase-admin");

// Load service account from the JSON file you downloaded from Firebase Console
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? require("path").resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : "../../serviceAccountKey.json"
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin initialized");
}

module.exports = admin;
