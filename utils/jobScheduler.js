const { Job } = require("../models");

// ── DYNAMIC DAILY JOB EXPIRY ROUTINE ───────────────────────────────────────
// Transitions status from "active" to "expired" for jobs that have hit their deadlines.
// Safe to re-run, idempotent.
async function runDynamicJobExpiry() {
  console.log("⏰ [JobExpiry] Running daily job deadline status transition check...");
  try {
    const today = new Date();
    
    // Find active jobs where the application deadline is in the past
    // Handles both nested applyEnd.date and direct applyEnd dates
    const result = await Job.updateMany(
      {
        status: "active",
        $or: [
          { "importantDates.applyEnd.date": { $lt: today } },
          { "importantDates.applyEnd": { $lt: today } }
        ]
      },
      { $set: { status: "expired" } }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ [JobExpiry] Successfully transitioned ${result.modifiedCount} jobs to 'expired'.`);
      
      // Since jobs transitioned, we invalidate the cache immediately
      try {
        const { clearCachePattern } = require("./cache");
        await clearCachePattern("homepage_jobs_*");
        await clearCachePattern("jobs_*");
      } catch (cacheErr) {
        console.warn("⚠️ [JobExpiry] Failed to invalidate cache after job status transition:", cacheErr.message);
      }
    } else {
      console.log("ℹ️ [JobExpiry] No jobs found with expired deadlines.");
    }
  } catch (error) {
    console.error("❌ [JobExpiry] Error during dynamic job expiry check:", error);
  }
}

// Schedules the expiry check to run once daily at midnight (12:01 AM)
function scheduleDailyExpiryJob() {
  const scheduleNext = () => {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 1, 0 // 12:01 AM
    );
    const msUntilMidnight = nextMidnight - now;

    console.log(`⏰ [JobExpiry] Daily deadline checker scheduled to run in ${Math.round(msUntilMidnight / 60000)} minutes (at 12:01 AM).`);

    setTimeout(async () => {
      await runDynamicJobExpiry();
      scheduleNext(); // Schedule the next occurrence
    }, msUntilMidnight);
  };

  scheduleNext();
}

// Main initializer function called at database connection startup
async function startJobExpiryScheduler() {
  console.log("⚡ [Scheduler] Initializing background Job Expiry Scheduler...");
  try {
    // Run an initial check immediately to catch any missed deadlines
    await runDynamicJobExpiry();
    // Schedule periodic daily runs
    scheduleDailyExpiryJob();
  } catch (err) {
    console.error("❌ [Scheduler] Failed to initialize job expiry scheduler:", err);
  }
}

module.exports = {
  runDynamicJobExpiry,
  scheduleDailyExpiryJob,
  startJobExpiryScheduler,
};
