require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const { runSeedingAndMigration } = require('../utils/migration');

console.log("⚡ [Clean DB] Connecting to database...");
mongoose.connect(process.env.DBURL, {
  serverSelectionTimeoutMS: 5000,
}).then(async () => {
  console.log("✅ [Clean DB] Database connected. Starting data normalization & cleanup...");
  
  // Set FORCE_MIGRATIONS=true in memory so the version guard is bypassed
  process.env.FORCE_MIGRATIONS = "true";
  
  await runSeedingAndMigration();
  
  console.log("🎉 [Clean DB] Database successfully cleaned and normalized!");
  process.exit(0);
}).catch(err => {
  console.error("❌ [Clean DB] Critical error:", err.message);
  process.exit(1);
});
