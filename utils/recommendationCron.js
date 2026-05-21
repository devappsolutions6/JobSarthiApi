/**
 * Recommendation Cron Scheduler
 *
 * Two background jobs — no external libraries, pure Node.js setTimeout loops.
 *
 * ┌──────────────────────┬──────────────────┬────────────────────────────────────────────────┐
 * │ Job                  │ Schedule         │ What it does                                   │
 * ├──────────────────────┼──────────────────┼────────────────────────────────────────────────┤
 * │ Incremental Push     │ Every 30 min     │ Processes new jobs (dirty flag), pushes to     │
 * │                      │                  │ affected users only via bulkWrite               │
 * ├──────────────────────┼──────────────────┼────────────────────────────────────────────────┤
 * │ Nightly Full Rebuild │ 2:00 AM daily    │ Expires jobs, purges dead jobIds from caches,  │
 * │                      │                  │ full forced rebuild of all user feeds,         │
 * │                      │                  │ flushes homepage cache                         │
 * └──────────────────────┴──────────────────┴────────────────────────────────────────────────┘
 */

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

// ── HELPER: milliseconds until next occurrence of a specific time (HH:MM) ───
function msUntilNextTime(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1); // roll over to tomorrow if already past
  }
  return next - now;
}

// ══════════════════════════════════════════════════════════════════════════════
//  JOB 1 — INCREMENTAL PUSH (every 30 minutes)
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
  console.log(`⏰ [RecCron:Incremental] Next incremental push in 30 minutes.`);
  setTimeout(async () => {
    await runIncrementalRecommendationPush();
    scheduleIncrementalPush(); // reschedule
  }, THIRTY_MINUTES_MS);
}

// ══════════════════════════════════════════════════════════════════════════════
//  JOB 2 — NIGHTLY FULL REBUILD (2:00 AM daily)
//  1. Mark expired jobs isActive=false
//  2. Purge dead jobIds from all user recommendation caches
//  3. Full forced rebuild — recomputes ALL user feeds from scratch (drift correction)
//  4. Flush homepage/listing cache
//
//  Running a full rebuild nightly (not just weekly) keeps all feeds fresh and
//  self-correcting without any observable performance cost at current scale.
// ══════════════════════════════════════════════════════════════════════════════
async function runNightlyFullRebuild() {
  console.log("🌙 [RecCron:Nightly] Starting nightly full rebuild...");
  try {
    const { Job, UserRecommendation } = require("../models");
    const RecommendationService = require("../services/recommendationService");

    // Step 1: Auto-deactivate expired jobs
    const deactivated = await Job.updateMany(
      { isActive: true, "importantDates.applyEnd.date": { $lt: new Date() } },
      { $set: { isActive: false } }
    );
    if (deactivated.modifiedCount > 0) {
      console.log(`🔒 [RecCron:Nightly] Deactivated ${deactivated.modifiedCount} expired jobs.`);
    }

    // Step 2: Collect all inactive/expired job IDs and purge from caches
    const deadJobs = await Job.find(
      {
        $or: [
          { isActive: false },
          { "importantDates.applyEnd.date": { $lt: new Date() } },
        ],
      },
      { _id: 1 }
    ).lean();

    if (deadJobs.length > 0) {
      const deadIds = deadJobs.map((j) => j._id);
      const purgeResult = await UserRecommendation.updateMany(
        {},
        { $pull: { recommendations: { jobId: { $in: deadIds } } } }
      );
      console.log(
        `🗑️  [RecCron:Nightly] Purged ${deadIds.length} dead job refs from ${purgeResult.modifiedCount} user caches.`
      );
    } else {
      console.log("ℹ️  [RecCron:Nightly] No expired/inactive jobs to purge.");
    }

    // Step 3: Full forced rebuild — clears all UserRecommendation docs and rebuilds from scratch.
    // This is the daily reconciliation: corrects any drift, stale entries, or inconsistencies
    // that accumulated during the day. force=true guarantees a clean slate every night.
    console.log("🔄 [RecCron:Nightly] Running full recommendation rebuild (force=true)...");
    await RecommendationService.recomputeAllUsersRecommendations(true);

    // Step 4: Flush homepage/job listing caches so fresh data is served immediately after rebuild
    try {
      const { clearAllCache } = require("./cache");
      await clearAllCache();
      console.log("🗂️  [RecCron:Nightly] Flushed all listing caches.");
    } catch (cacheErr) {
      console.warn("⚠️  [RecCron:Nightly] Cache flush failed:", cacheErr.message);
    }

    console.log("✅ [RecCron:Nightly] Nightly full rebuild complete.");
  } catch (err) {
    console.error("❌ [RecCron:Nightly] Fatal error during nightly rebuild:", err);
  }
}

function scheduleNightlyRebuild() {
  const ms = msUntilNextTime(2, 0); // 2:00 AM
  const minutesAway = Math.round(ms / 60000);
  console.log(`⏰ [RecCron:Nightly] Full rebuild scheduled for 2:00 AM (in ${minutesAway} minutes).`);
  setTimeout(async () => {
    await runNightlyFullRebuild();
    scheduleNightlyRebuild(); // reschedule for next day
  }, ms);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN INITIALIZER — called once from config/db.js after DB connects
// ══════════════════════════════════════════════════════════════════════════════
async function startRecommendationCron() {
  console.log("🚀 [RecCron] Initializing recommendation cron scheduler...");

  try {
    // Run incremental push immediately on startup to catch any jobs added while
    // the server was down — then schedule recurring 30-min runs.
    await runIncrementalRecommendationPush();
    scheduleIncrementalPush();

    // Schedule nightly full rebuild at 2:00 AM every day
    scheduleNightlyRebuild();

    console.log("✅ [RecCron] All recommendation cron jobs scheduled successfully.");
  } catch (err) {
    console.error("❌ [RecCron] Failed to initialize recommendation cron:", err);
  }
}

module.exports = {
  startRecommendationCron,
  runIncrementalRecommendationPush,
  runNightlyFullRebuild,
};
