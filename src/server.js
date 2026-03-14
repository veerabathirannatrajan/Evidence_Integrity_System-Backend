require("dotenv").config();

const app       = require("./app");
const connectDB = require("./config/db");

// Initialize Firebase Admin (import triggers initialization)
require("./config/firebase");

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
