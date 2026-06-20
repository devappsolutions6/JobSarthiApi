const mongoose = require("mongoose");
const { Job, User, UserPreference, ConfigMaster } = require("../models");
const {
  normalizeDegreeToLevelCode,
  normalizeUserLevelToCode,
  JOB_DOMAINS,
  SELECTION_STAGES,
  EDUCATION_LEVEL_CODES
} = require("./educationHelper");

// Master configuration data to seed
const SEED_CONFIGS = [
  {
    key: "jobDomains",
    value: JOB_DOMAINS,
    description: "Standard job classification categories / domains."
  },
  {
    key: "educationLevels",
    value: {
      "EDU_10TH": { rank: 1, label: "10th Pass", keywords: ["10th", "matric", "ssc", "secondary"] },
      "EDU_12TH": { rank: 2, label: "12th Pass", keywords: ["12th", "intermediate", "hsc", "higher secondary"] },
      "EDU_DIPLOMA": { rank: 3, label: "Diploma / ITI", keywords: ["diploma", "iti", "polytechnic"] },
      "EDU_GRAD": { rank: 4, label: "Graduate (B.Tech, B.Sc, B.A, B.Com, etc.)", keywords: ["degree", "bachelor", "graduation"] },
      "EDU_POSTGRAD": { rank: 5, label: "Post Graduate (Master, M.Tech, MBA, etc.)", keywords: ["master", "postgraduate"] }
    },
    description: "Standardized educational tier ranks and search keyword mapping."
  },
  {
    key: "selectionStages",
    value: SELECTION_STAGES,
    description: "Standard selection process workflow stages."
  }
];

// ── ONE-TIME EDUCATION CODE STANDARDIZATION MIGRATION ──────────────────────
// Upgrades all stored legacy strings ("graduate", "12th") to standard codes
// ("EDU_GRAD", "EDU_12TH") across User, UserPreference, and Job collections.
// Run once on deploy — idempotent, safe to re-run.
async function runEducationCodeMigration() {
  console.log("📚 [EduMigration] Standardizing education level codes across all collections...");

  let totalUpdated = 0;

  // 1. USERS — education.levels
  const allUsers = await User.find({ "education.levels.0": { $exists: true } }).lean();
  let usersUpdated = 0;
  for (const user of allUsers) {
    const original = user.education?.levels || [];
    const upgraded = [...new Set(
      original.map(lvl => normalizeUserLevelToCode(lvl)).filter(Boolean)
    )];
    const hasChanges = upgraded.some((code, i) => code !== original[i]) || upgraded.length !== original.length;
    if (hasChanges) {
      await User.updateOne({ _id: user._id }, { $set: { "education.levels": upgraded } });
      usersUpdated++;
    }
  }
  totalUpdated += usersUpdated;
  console.log(`  ✅ Users: ${usersUpdated}/${allUsers.length} records upgraded.`);

  // 2. USER PREFERENCES — education.levels
  const allPrefs = await UserPreference.find({ "education.levels.0": { $exists: true } }).lean();
  let prefsUpdated = 0;
  for (const pref of allPrefs) {
    const original = pref.education?.levels || [];
    const upgraded = [...new Set(
      original.map(lvl => normalizeUserLevelToCode(lvl)).filter(Boolean)
    )];
    const hasChanges = upgraded.some((code, i) => code !== original[i]) || upgraded.length !== original.length;
    if (hasChanges) {
      await UserPreference.updateOne({ _id: pref._id }, { $set: { "education.levels": upgraded } });
      prefsUpdated++;
    }
  }
  totalUpdated += prefsUpdated;
  console.log(`  ✅ UserPreferences: ${prefsUpdated}/${allPrefs.length} records upgraded.`);

  // 3. JOBS — eligibility.posts[].education[].levelCode
  // Ensure every levelCode on every post is a standard code (fills in missing ones too)
  
  // 3.0. RESTORE ORIGINAL ELIGIBILITY FROM LEGACY JOBS COLLECTION
  // Since 'degree' was missing in Mongoose schema, it got stripped out in earlier runs.
  // We restore the original degrees from legacy 'jobs' collection before normalizing.
  try {
    const legacyCol = mongoose.connection.db.collection("jobs");
    const count = await legacyCol.countDocuments().catch(() => 0);
    if (count > 0) {
      console.log("📦 [EduMigration] Restoring original degree fields from legacy 'jobs' collection...");
      const legacyDocs = await legacyCol.find({}, { projection: { _id: 1, "eligibility.posts": 1 } }).toArray();
      let restoredCount = 0;
      for (const doc of legacyDocs) {
        if (doc.eligibility?.posts) {
          const res = await mongoose.connection.db.collection("jobschemas").updateOne(
            { _id: doc._id },
            { $set: { "eligibility.posts": doc.eligibility.posts } }
          );
          if (res.modifiedCount > 0) restoredCount++;
        }
      }
      console.log(`  ✅ Restored degree fields for ${restoredCount} jobs.`);
    }
  } catch (restoreErr) {
    console.warn("⚠️ [EduMigration] Error restoring legacy eligibility:", restoreErr.message);
  }

  const allJobs = await Job.find({
    $or: [
      { "eligibility.posts.0": { $exists: true } },
      { "eligibility.education.0": { $exists: true } }
    ]
  }).lean();
  let jobEduUpdated = 0;
  for (const job of allJobs) {
    let modified = false;
    
    let posts = undefined;
    if (job.eligibility?.posts) {
      posts = (job.eligibility.posts || []).map(post => {
        const education = (post.education || []).map(edu => {
          const currentCode = edu.levelCode;
          const newCode = normalizeDegreeToLevelCode(edu.level || edu.degree || currentCode);
          if (currentCode !== newCode) {
            modified = true;
            return { ...edu, levelCode: newCode };
          }
          return edu;
        });
        return { ...post, education };
      });
    }

    let education = undefined;
    if (job.eligibility?.education) {
      education = (job.eligibility.education || []).map(edu => {
        const currentCode = edu.levelCode;
        const newCode = normalizeDegreeToLevelCode(edu.level || edu.degree || currentCode);
        if (currentCode !== newCode) {
          modified = true;
          return { ...edu, levelCode: newCode };
        }
        return edu;
      });
    }

    if (modified) {
      const updateFields = {};
      if (posts) updateFields["eligibility.posts"] = posts;
      if (education) updateFields["eligibility.education"] = education;
      await Job.updateOne({ _id: job._id }, { $set: updateFields });
      jobEduUpdated++;
    }
  }
  totalUpdated += jobEduUpdated;
  console.log(`  ✅ Jobs (levelCodes): ${jobEduUpdated}/${allJobs.length} records upgraded.`);

  console.log(`📚 [EduMigration] Complete! ${totalUpdated} total records standardized.`);
}

// ── ONE-TIME TOKEN CASING MIGRATION ────────────────────────────────────────
// Lowercases all free-form token fields that are compared at runtime so the
// recommendation engine can do direct equality checks with zero normalization.
// Idempotent — already-lowercase values are skipped.
async function runTokenCasingMigration() {
  console.log("🔡 [TokenMigration] Normalizing free-form token casing across all collections...");
  const lc = v => (v && typeof v === "string" ? v.toLowerCase().trim() : v);
  const lcArr = arr => (Array.isArray(arr) ? arr.map(lc).filter(Boolean) : []);

  // 1. USER PREFERENCES — organizationTypes, interests, preferredLocations, stream, specialization
  const prefs = await UserPreference.find({}).lean();
  let prefsFixed = 0;
  for (const p of prefs) {
    const update = {};
    const orgLC   = lcArr(p.organizationTypes);
    const intLC   = lcArr(p.interests);
    const locLC   = lcArr(p.preferredLocations);
    const strLC   = lcArr(p.education?.stream);
    const specLC  = lcArr(p.education?.specialization);
    if (JSON.stringify(orgLC)  !== JSON.stringify(p.organizationTypes))  update.organizationTypes = orgLC;
    if (JSON.stringify(intLC)  !== JSON.stringify(p.interests))          update.interests = intLC;
    if (JSON.stringify(locLC)  !== JSON.stringify(p.preferredLocations)) update.preferredLocations = locLC;
    if (JSON.stringify(strLC)  !== JSON.stringify(p.education?.stream))  update["education.stream"] = strLC;
    if (JSON.stringify(specLC) !== JSON.stringify(p.education?.specialization)) update["education.specialization"] = specLC;
    if (Object.keys(update).length > 0) {
      await UserPreference.updateOne({ _id: p._id }, { $set: update });
      prefsFixed++;
    }
  }
  console.log(`  ✅ UserPreferences: ${prefsFixed}/${prefs.length} records normalized.`);

  // 2. USERS — education.stream, education.specialization, preferredLocations, organizationTypes, interests
  const users = await User.find({}).lean();
  let usersFixed = 0;
  for (const u of users) {
    const update = {};
    const orgLC  = lcArr(u.organizationTypes);
    const intLC  = lcArr(u.interests);
    const locLC  = lcArr(u.preferredLocations);
    const strLC  = lcArr(u.education?.stream);
    const specLC = lcArr(u.education?.specialization);
    if (JSON.stringify(orgLC)  !== JSON.stringify(u.organizationTypes))  update.organizationTypes = orgLC;
    if (JSON.stringify(intLC)  !== JSON.stringify(u.interests))          update.interests = intLC;
    if (JSON.stringify(locLC)  !== JSON.stringify(u.preferredLocations)) update.preferredLocations = locLC;
    if (JSON.stringify(strLC)  !== JSON.stringify(u.education?.stream))  update["education.stream"] = strLC;
    if (JSON.stringify(specLC) !== JSON.stringify(u.education?.specialization)) update["education.specialization"] = specLC;
    if (Object.keys(update).length > 0) {
      await User.updateOne({ _id: u._id }, { $set: update });
      usersFixed++;
    }
  }
  console.log(`  ✅ Users: ${usersFixed}/${users.length} records normalized.`);

  // 3. JOBS — tags, searchKeywords, jobDomains (matching tokens), location, stream, specialization
  const jobs = await Job.find({}).lean();
  let jobsFixed = 0;
  for (const j of jobs) {
    const update = {};
    const tagsLC  = lcArr(j.tags);
    const kwLC    = lcArr(j.searchKeywords);
    const locLC   = lc(j.location);
    // jobDomains are matched by contains — lowercase for consistent comparison
    const domLC   = lcArr(j.jobDomains);
    // Eligibility stream/specialization for scoring
    let eduModified = false;
    let posts = undefined;
    if (j.eligibility?.posts) {
      posts = (j.eligibility.posts || []).map(post => {
        const education = (post.education || []).map(edu => {
          const strLC  = lc(edu.stream);
          const specLC = lc(edu.specialization);
          if (strLC !== edu.stream || specLC !== edu.specialization) {
            eduModified = true;
            return { ...edu, stream: strLC, specialization: specLC };
          }
          return edu;
        });
        return { ...post, education };
      });
    }

    let education = undefined;
    if (j.eligibility?.education) {
      education = (j.eligibility.education || []).map(edu => {
        const strLC  = lc(edu.stream);
        const specLC = lc(edu.specialization);
        if (strLC !== edu.stream || specLC !== edu.specialization) {
          eduModified = true;
          return { ...edu, stream: strLC, specialization: specLC };
        }
        return edu;
      });
    }

    if (JSON.stringify(tagsLC) !== JSON.stringify(j.tags))            update.tags = tagsLC;
    if (JSON.stringify(kwLC)   !== JSON.stringify(j.searchKeywords))  update.searchKeywords = kwLC;
    if (locLC !== j.location)                                          update.location = locLC;
    if (JSON.stringify(domLC)  !== JSON.stringify(j.jobDomains))      update.jobDomains = domLC;
    if (eduModified) {
      if (posts) update["eligibility.posts"] = posts;
      if (education) update["eligibility.education"] = education;
    }
    if (Object.keys(update).length > 0) {
      await Job.updateOne({ _id: j._id }, { $set: update });
      jobsFixed++;
    }
  }
  console.log(`  ✅ Jobs: ${jobsFixed}/${jobs.length} records normalized.`);
  console.log("🔡 [TokenMigration] Complete! All free-form token fields are now lowercase.");
}

// ── REDUNDANT INDEX CLEANUP ────────────────────────────────────────────────
// Drops unused or redundant single-field indexes that impact write performance.
async function runIndexCleanup() {
  console.log("🧹 [IndexCleanup] Checking for redundant indexes in the 'jobschemas' collection...");
  try {
    const dbIndexes = await Job.collection.indexes().catch(() => []);
    const existingIndexNames = dbIndexes.map(idx => idx.name);

    const REDUNDANT_INDEXES = [
      "title_1",
      "conductingBody_1",
      "department_1",
      "organization_1",
      "location_1",
      "isActive_1",
      "status_1",
      "isFeatured_1",
      "isPinned_1",
      "tags_1",
      "searchKeywords_1",
      "jobDomains_1"
    ];

    let droppedCount = 0;
    for (const indexName of REDUNDANT_INDEXES) {
      if (existingIndexNames.includes(indexName)) {
        console.log(`  🗑️ Dropping redundant index: ${indexName}`);
        await Job.collection.dropIndex(indexName).catch(err => {
          console.warn(`  ⚠️ Failed to drop index ${indexName}:`, err.message);
        });
        droppedCount++;
      }
    }

    if (droppedCount > 0) {
      console.log(`✅ [IndexCleanup] Successfully dropped ${droppedCount} redundant indexes.`);
    } else {
      console.log("ℹ️ [IndexCleanup] No redundant indexes found to drop.");
    }
  } catch (error) {
    console.error("⚠️ [IndexCleanup] Error while cleaning up redundant indexes:", error);
  }
}

async function runSeedingAndMigration() {
  const CURRENT_MIGRATION_VERSION = 4;

  try {
    // ── 0. NORMALIZE ALL EDUCATION RECORDS TO STANDARD CODES ON EVERY STARTUP ──
    // Ensures newly scraped or inserted raw degree strings are standardized instantly on restart.
    await runEducationCodeMigration();

    // Check if optimizations and migrations have already completed for this database version
    const migrationFlag = await ConfigMaster.findOne({ key: "migrationsCompleted" });
    const completedVersion = migrationFlag?.value?.version || 0;

    // Safety check: if jobschemas collection is completely empty, we MUST run migrations/seeding regardless of the flag to prevent empty production DB
    const jobsCount = await Job.countDocuments().catch(() => 0);

    if (completedVersion >= CURRENT_MIGRATION_VERSION && jobsCount > 0 && process.env.FORCE_MIGRATIONS !== "true") {
      console.log(`ℹ️ [Migration] Database optimizations (v${completedVersion}) are already up to date. Skipping startup migrations.`);
      return;
    }

    console.log("⚡ [Migration] Starting seeding and database optimization...");

    try {
      // ── 0. CLEANUP REDUNDANT INDEXES ─────────────────────────────────────────
      await runIndexCleanup();

      // ── 0.5. COPY LEGACY JOBS TO JOBSCHEMAS ──────────────────────────────────
      const collections = await mongoose.connection.db.listCollections().toArray();
      const legacyJobsExists = collections.some(c => c.name === "jobs");
      
      if (legacyJobsExists) {
        const legacyJobsCol = mongoose.connection.db.collection("jobs");
        const count = await legacyJobsCol.countDocuments().catch(() => 0);
        
        if (count > 0) {
          console.log(`📦 [Migration] Legacy 'jobs' collection found with ${count} records. Syncing to 'jobschemas'...`);
          const legacyDocs = await legacyJobsCol.find({}).toArray();
          
          // Safety fix: Clean up any already-copied documents in jobschemas that have null/missing urlTitle or jobCode
          const badDocs = await Job.collection.find({
            $or: [
              { urlTitle: { $in: [null, ""] } },
              { urlTitle: { $exists: false } },
              { jobCode: { $in: [null, ""] } },
              { jobCode: { $exists: false } }
            ]
          }).toArray();

          if (badDocs.length > 0) {
            console.log(`🧹 [Migration] Found ${badDocs.length} existing records in 'jobschemas' with invalid or missing urlTitle/jobCode. Repairing...`);
            for (const badDoc of badDocs) {
              const update = {};
              if (!badDoc.jobCode) {
                update.jobCode = String(badDoc.JobId || `JC-${badDoc._id}`).toUpperCase();
              }
              if (!badDoc.urlTitle) {
                const slug = (badDoc.title || "job")
                  .toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, "")
                  .replace(/\s+/g, "-")
                  .replace(/-+/g, "-")
                  .trim();
                const uniqueSuffix = badDoc.JobId || String(badDoc._id).substring(String(badDoc._id).length - 6);
                update.urlTitle = `${slug}-${uniqueSuffix}`.toLowerCase();
              }
              await Job.collection.updateOne({ _id: badDoc._id }, { $set: update });
            }
            console.log("🧹 [Migration] Repair of existing job schemas completed.");
          }

          let copiedCount = 0;
          for (const doc of legacyDocs) {
            // Check if already exists in jobschemas (Job model collection)
            const exists = await Job.collection.findOne({ _id: doc._id });
            if (!exists) {
              // Ensure jobCode is present and unique (unique constraint)
              if (!doc.jobCode) {
                doc.jobCode = doc.JobId || `JC-${doc._id}`;
              }
              doc.jobCode = String(doc.jobCode).toUpperCase();

              // Ensure urlTitle is present and unique (unique constraint)
              if (!doc.urlTitle) {
                const slug = (doc.title || "job")
                  .toLowerCase()
                  .replace(/[^a-z0-9\s-]/g, "") // remove special chars
                  .replace(/\s+/g, "-")         // replace spaces with -
                  .replace(/-+/g, "-")          // deduplicate dashes
                  .trim();
                const uniqueSuffix = doc.JobId || String(doc._id).substring(String(doc._id).length - 6);
                doc.urlTitle = `${slug}-${uniqueSuffix}`.toLowerCase();
              } else {
                doc.urlTitle = String(doc.urlTitle).toLowerCase().trim();
              }

              await Job.collection.insertOne(doc);
              copiedCount++;
            }
          }
          if (copiedCount > 0) {
            console.log(`✅ [Migration] Successfully copied ${copiedCount} new jobs from legacy 'jobs' to 'jobschemas'.`);
          } else {
            console.log("ℹ️ [Migration] All legacy jobs are already present in 'jobschemas'.");
          }
        }
      }
    } catch (copyErr) {
      console.warn("⚠️ [Migration] Error copying legacy jobs collection:", copyErr.message);
    }

    // ── 1. SEED MASTER CONFIGS ──────────────────────────────────────────────
    for (const config of SEED_CONFIGS) {
      const exists = await ConfigMaster.findOne({ key: config.key });
      if (!exists) {
        await ConfigMaster.create(config);
        console.log(`✅ [Migration] Config Master seeded: "${config.key}"`);
      } else {
        console.log(`ℹ️ [Migration] Config Master exists: "${config.key}"`);
      }
    }



    // ── 2. PRE-COMPUTE JOB STATUSES & NORMALIZE JOB EDUCATION ───────────────
    const today = new Date();
    const allJobs = await Job.find({});
    console.log(`🔍 [Migration] Analyzing ${allJobs.length} jobs for schema alignment...`);

    let jobsUpdated = 0;
    for (const job of allJobs) {
      let isModified = false;

      // A. Pre-compute status
      let calculatedStatus = "active";
      const applyEnd = job.importantDates?.applyEnd;
      
      if (applyEnd) {
        if (applyEnd.date && new Date(applyEnd.date) < today) {
          calculatedStatus = "expired";
        } else if (applyEnd instanceof Date && applyEnd < today) {
          calculatedStatus = "expired";
        }
      }
      
      if (job.status !== calculatedStatus || !job._doc.status) {
        job.status = calculatedStatus;
        isModified = true;
      }

      // B. Normalize educational levelCodes
      if (job.eligibility) {
        if (job.eligibility.posts && job.eligibility.posts.length > 0) {
          for (const post of job.eligibility.posts) {
            if (post.education && post.education.length > 0) {
              for (const edu of post.education) {
                if (!edu.levelCode) {
                  edu.levelCode = normalizeDegreeToLevelCode(edu.level || edu.degree);
                  isModified = true;
                }
              }
            }
          }
        }
        if (job.eligibility.education && job.eligibility.education.length > 0) {
          for (const edu of job.eligibility.education) {
            if (!edu.levelCode) {
              edu.levelCode = normalizeDegreeToLevelCode(edu.level || edu.degree);
              isModified = true;
            }
          }
        }
      }

      // C. Remove legacy `posts` array to keep DB clean
      if (job.get("posts")) {
        job.set("posts", undefined);
        isModified = true;
      }

      if (isModified) {
        await job.save();
        jobsUpdated++;
      }
    }
    console.log(`✅ [Migration] Pre-computed status & education codes for ${jobsUpdated}/${allJobs.length} jobs.`);

    // ── 4. NORMALIZE ALL FREE-FORM TOKENS TO LOWERCASE ────────────────────────
    await runTokenCasingMigration();

    // ── 5. CLEAN OLD PROPERTY CASING IN ADMITCARDS & RESULTS ──────────────────
    console.log("🧹 [Migration] Sanitizing old property casings in AdmitCards and ResultCards...");
    const AdmitCard = require("../models/AdmitCard");
    const ResultCard = require("../models/ResultCard");

    const admitCardRes = await AdmitCard.updateMany(
      { DownloadLink: { $exists: true } },
      { $rename: { DownloadLink: "downloadLink" } }
    );
    if (admitCardRes.modifiedCount > 0) {
      console.log(`🧹 [Migration] Sanitized DownloadLink -> downloadLink for ${admitCardRes.modifiedCount} AdmitCards.`);
    }

    const resultCardRes = await ResultCard.updateMany(
      { $or: [{ DownloadLink: { $exists: true } }, { ReleaseDate: { $exists: true } }] },
      { $rename: { DownloadLink: "downloadLink", ReleaseDate: "releaseDate" } }
    );
    if (resultCardRes.modifiedCount > 0) {
      console.log(`🧹 [Migration] Sanitized fields for ${resultCardRes.modifiedCount} ResultCards.`);
    }

    // ── 6. STRIP ILLEGAL monthYear FIELD FROM importantDates.applyEnd ────────
    // Caused by manual DB inserts that included a non-schema `monthYear` field.
    // Converts { date, tentative, monthYear } → { date, tentative, note } per schema.
    // Idempotent — only touches documents that still have the bad field.
    const applyEndBadDocs = await Job.collection.find(
      { "importantDates.applyEnd.monthYear": { $exists: true } },
      { projection: { jobCode: 1, "importantDates.applyEnd": 1 } }
    ).toArray();

    if (applyEndBadDocs.length > 0) {
      console.log(`🧹 [Migration] Found ${applyEndBadDocs.length} jobs with non-schema 'applyEnd.monthYear' field. Fixing...`);
      for (const doc of applyEndBadDocs) {
        const ae = doc.importantDates?.applyEnd || {};
        await Job.collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              "importantDates.applyEnd": {
                date: ae.date ?? null,
                tentative: ae.tentative ?? true,
                note: ae.monthYear ?? ""
              }
            }
          }
        );
      }
      console.log(`✅ [Migration] Fixed ${applyEndBadDocs.length} applyEnd.monthYear violations.`);
    } else {
      console.log("ℹ️ [Migration] No applyEnd.monthYear violations found.");
    }

    // NOTE: Recommendation pre-computation has moved to the cron scheduler (utils/recommendationCron.js).
    // The incremental push cron runs immediately on startup and every 30 minutes thereafter,
    // while the weekly full reconciliation cron (Sunday 3 AM) handles drift correction.
    // This avoids the O(N×M) blocking rebuild that previously ran on every server restart.
    
    // Flush all stale caches (homepage, admit cards, results) so they immediately fetch migrated and optimized data
    try {
      const { clearAllCache } = require("./cache");
      await clearAllCache();
    } catch (cacheError) {
      console.warn("⚠️ [Migration] Failed to flush cache during startup:", cacheError.message);
    }

    // Save migration completion flag to prevent redundant runs on subsequent hot-reloads/restarts
    await ConfigMaster.findOneAndUpdate(
      { key: "migrationsCompleted" },
      {
        value: { version: CURRENT_MIGRATION_VERSION },
        description: "Tracks the completed migration version to prevent redundant startup runs."
      },
      { upsert: true, new: true }
    );

    console.log("🎉 [Migration] Database optimization completed successfully!");
  } catch (error) {
    console.error("❌ [Migration] Critical error running seeding and migration:", error);
  }
}

module.exports = {
  runSeedingAndMigration,
  runEducationCodeMigration,
  runTokenCasingMigration,
  runIndexCleanup,
};
