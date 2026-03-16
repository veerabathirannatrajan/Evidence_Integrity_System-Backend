require("dotenv").config();

const app       = require("./app");
const connectDB = require("./config/db");
const { startTamperMonitor } = require("./services/tamperMonitor");

// Init Firebase Admin
require("./config/firebase");

connectDB().then(() => {
  // Start auto tamper monitor after DB is ready
  startTamperMonitor();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});