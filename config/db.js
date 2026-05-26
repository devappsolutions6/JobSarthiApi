const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDb = async () => {
  try {
    const conn = await mongoose.connect(process.env.DBURL, {
      maxPoolSize: process.env.MONGO_MAX_POOL_SIZE ? parseInt(process.env.MONGO_MAX_POOL_SIZE) : 100, 
      serverSelectionTimeoutMS: 5000, // fail fast if DB is unreachable
      socketTimeoutMS: 45000,         // close idle sockets after 45s
    });
    console.log(`Database connected: ${conn.connection.host}`);

    // Asynchronously trigger dynamic configs seeding & database optimization
    const { runSeedingAndMigration } = require("../utils/migration");
    runSeedingAndMigration().catch((err) => {
      console.error("⚠️ [Migration] Error during background startup execution:", err);
    });

    // Start background Job Expiry Scheduler (runs independently of migration.js to survive prod deployment)
    try {
      const { startJobExpiryScheduler } = require("../utils/jobScheduler");
      startJobExpiryScheduler();
    } catch (schedErr) {
      console.error("⚠️ [Scheduler] Failed to start background job expiry scheduler:", schedErr.message);
    }

    // Start recommendation cron scheduler (incremental push every 30 min, nightly GC, weekly reconciliation)
    try {
      const { startRecommendationCron } = require("../utils/recommendationCron");
      startRecommendationCron();
    } catch (recCronErr) {
      console.error("⚠️ [RecCron] Failed to start recommendation cron scheduler:", recCronErr.message);
    }

    // Start admin campaign broadcast scheduler (30s poll interval)
    try {
      const { startCampaignScheduler } = require("../utils/campaignScheduler");
      startCampaignScheduler();
    } catch (campSchedErr) {
      console.error("⚠️ [CampaignScheduler] Failed to start broadcast campaign scheduler:", campSchedErr.message);
    }

  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDb;
