/**
 * Recommendation Cron Scheduler
 *
 * Two background jobs — no external libraries, pure Node.js setTimeout loops.
 *
 * ┌──────────────────────┬──────────────────┬────────────────────────────────────────────────┐
 * │ Job                  │ Schedule         │ What it does                                   │
 * ├──────────────────────┼──────────────────┼────────────────────────────────────────────────┤
 * │ Incremental Push     │ Every 5 min      │ Processes new jobs (dirty flag), pushes to     │
 * │                      │                  │ affected users only via bulkWrite               │
 * ├──────────────────────┼──────────────────┼────────────────────────────────────────────────┤
 * │ Full Rebuild         │ Every 4 hours    │ Expires jobs, purges dead jobIds from caches,  │
 * │                      │                  │ full forced rebuild of all user feeds,         │
 * │                      │                  │ flushes homepage cache                         │
 * └──────────────────────┴──────────────────┴────────────────────────────────────────────────┘
 */

const mongoose = require("mongoose");

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

// ══════════════════════════════════════════════════════════════════════════════
//  JOB 1 — INCREMENTAL PUSH (every 5 minutes)
//  Finds jobs with isRecommendationProcessed=false, scores them against
//  affected user segments only, pushes via bulkWrite. Fast and lightweight.
// ══════════════════════════════════════════════════════════════════════════════
async function runIncrementalRecommendationPush() {
  console.log("⚡ [RecCron:Incremental] Running incremental recommendation push...");
  try {
    const RecommendationService = require("../services/recommendationService");
    // Delegate to the existing incremental path in recommendationService (force=false)
    await RecommendationService.recomputeAllUsersRecommendations(false);
  } catch (err) {
    console.error("❌ [RecCron:Incremental] Error during incremental push:", err.message);
  }
}

function scheduleIncrementalPush() {
  console.log(`⏰ [RecCron:Incremental] Next incremental push in 5 minutes.`);
  setTimeout(async () => {
    await runIncrementalRecommendationPush();
    scheduleIncrementalPush(); // reschedule
  }, FIVE_MINUTES_MS);
}

// ══════════════════════════════════════════════════════════════════════════════
//  JOB 2 — FULL REBUILD (Every 4 hours)
//  1. Mark expired jobs isActive=false
//  2. Purge dead jobIds from all user recommendation caches
//  3. Full forced rebuild — recomputes ALL user feeds from scratch (drift correction)
//  4. Flush homepage/listing cache
//
//  Running a full rebuild every 4 hours keeps all feeds fresh and self-correcting,
//  ensuring expired/closed jobs are removed from personalized recommendations promptly.
// ══════════════════════════════════════════════════════════════════════════════
async function runFullRebuild() {
  console.log("🔄 [RecCron:FullRebuild] Starting full rebuild...");
  try {
    const { Job, UserRecommendation } = require("../models");
    const RecommendationService = require("../services/recommendationService");

    // Step 1: Auto-deactivate expired jobs
    const deactivated = await Job.updateMany(
      { isActive: true, "importantDates.applyEnd.date": { $lt: new Date() } },
      { $set: { isActive: false } }
    );
    if (deactivated.modifiedCount > 0) {
      console.log(`🔒 [RecCron:FullRebuild] Deactivated ${deactivated.modifiedCount} expired jobs.`);
    }

    // Step 2: Collect all older/expired/inactive jobs (full documents)
    const deadJobs = await Job.find({
      $or: [
        { status: "expired" },
        { "importantDates.applyEnd.date": { $lt: new Date() } },
      ],
    }).lean();

    if (deadJobs.length > 0) {
      const deadIds = deadJobs.map((j) => j._id);

      // Step 2.1: Purge dead jobIds from all user recommendation caches
      const purgeResult = await UserRecommendation.updateMany(
        {},
        { $pull: { recommendations: { jobId: { $in: deadIds } } } }
      );
      console.log(
        `🗑️  [RecCron:FullRebuild] Purged ${deadIds.length} dead job refs from ${purgeResult.modifiedCount} user caches.`
      );

      // Step 2.2: Move all older/expired jobs to 'oldjobs' collection
      console.log(`📦 [RecCron:FullRebuild] Moving ${deadJobs.length} older jobs to 'oldjobs' collection...`);
      const oldJobsCol = mongoose.connection.db.collection("oldjobs");
      
      try {
        await oldJobsCol.insertMany(deadJobs, { ordered: false });
        console.log(`  Successfully inserted older jobs into 'oldjobs'.`);
      } catch (insertErr) {
        if (insertErr.code === 11000 || (insertErr.writeErrors && insertErr.writeErrors.some(e => e.code === 11000))) {
          console.log(`  Inserted some jobs. Ignored duplicate keys for already moved jobs.`);
        } else {
          console.error("  Error copying to oldjobs:", insertErr.message);
        }
      }

      // Step 2.3: Delete from 'jobschemas'
      const deleteRes = await Job.deleteMany({ _id: { $in: deadIds } });
      console.log(`  Successfully deleted ${deleteRes.deletedCount} older jobs from 'jobschemas'.`);

    } else {
      console.log("ℹ️  [RecCron:FullRebuild] No expired/inactive jobs to move or purge.");
    }

    // Step 3: Full forced rebuild — clears all UserRecommendation docs and rebuilds from scratch.
    // This reconciliation corrects any drift, stale entries, or inconsistencies.
    // force=true guarantees a clean slate every 4 hours.
    console.log("🔄 [RecCron:FullRebuild] Running full recommendation rebuild (force=true)...");
    await RecommendationService.recomputeAllUsersRecommendations(true);

    // Step 4: Flush homepage/job listing caches so fresh data is served immediately after rebuild
    try {
      const { clearAllCache } = require("./cache");
      await clearAllCache();
      console.log("🗂️  [RecCron:FullRebuild] Flushed all listing caches.");
    } catch (cacheErr) {
      console.warn("⚠️  [RecCron:FullRebuild] Cache flush failed:", cacheErr.message);
    }

    console.log("✅ [RecCron:FullRebuild] Full rebuild complete.");
  } catch (err) {
    console.error("❌ [RecCron:FullRebuild] Fatal error during full rebuild:", err);
  }
}

function scheduleFullRebuild() {
  console.log(`⏰ [RecCron:FullRebuild] Next full rebuild in 4 hours.`);
  setTimeout(async () => {
    await runFullRebuild();
    scheduleFullRebuild(); // reschedule for next 4-hour cycle
  }, FOUR_HOURS_MS);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN INITIALIZER — called once from config/db.js after DB connects
// ══════════════════════════════════════════════════════════════════════════════
async function startRecommendationCron() {
  console.log("🚀 [RecCron] Initializing recommendation cron scheduler...");

  try {
    // Run incremental push immediately on startup to catch any jobs added while
    // the server was down — then schedule recurring 5-min runs.
    await runIncrementalRecommendationPush();
    scheduleIncrementalPush();

    // Run full rebuild immediately on startup, then schedule recurring 4-hour runs
    await runFullRebuild();
    scheduleFullRebuild();

    console.log("✅ [RecCron] All recommendation cron jobs scheduled successfully.");
  } catch (err) {
    console.error("❌ [RecCron] Failed to initialize recommendation cron:", err);
  }
}

module.exports = {
  startRecommendationCron,
  runIncrementalRecommendationPush,
  runFullRebuild,
};
