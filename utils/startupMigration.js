const mongoose = require("mongoose");
const { Job } = require("../models");

/**
 * Auto-migration script that runs in the background on server startup.
 * It scans the `jobs` and `oldjobs` collections for any documents that are missing
 * the new `searchTokens` flat array and updates them.
 * 
 * This ensures that if the production database has legacy data, or if an admin 
 * directly inserted a document bypassing Mongoose hooks, it gets cleaned automatically.
 */
async function runStartupMigration() {
  try {
    console.log("🔄 [StartupMigration] Checking for legacy job records...");
    
    // We access the raw db collections to ensure we can fix even broken documents
    const db = mongoose.connection.db;
    if (!db) {
      console.warn("⚠️ [StartupMigration] Database not fully connected yet, skipping.");
      return;
    }

    const collectionsToMigrate = ["jobs", "oldjobs"];

    // 0. Sync Mongoose Indexes to drop unused/legacy indexes in Atlas
    console.log("🔄 [StartupMigration] Syncing MongoDB Indexes to clean up unused indices...");
    await Job.syncIndexes();
    console.log("✅ [StartupMigration] Index sync complete.");

    for (const collName of collectionsToMigrate) {
      const collection = db.collection(collName);
      
      // 1. Force fix broken correctionWindow string fields (unset if it's a string)
      await collection.updateMany(
        { "importantDates.correctionWindow": { $type: "string" } },
        { $unset: { "importantDates.correctionWindow": "" } }
      );
      
      // 2. Force fix legacy levelCodes
      await collection.updateMany(
        { "eligibility.posts.education.levelCode": "GRADUATION" },
        { $set: { "eligibility.posts.$[].education.$[].levelCode": "EDU_GRAD" } }
      );
      await collection.updateMany(
        { "eligibility.posts.education.levelCode": "POST_GRADUATION" },
        { $set: { "eligibility.posts.$[].education.$[].levelCode": "EDU_POSTGRAD" } }
      );
      await collection.updateMany(
        { "eligibility.posts.education.levelCode": "INTERMEDIATE" },
        { $set: { "eligibility.posts.$[].education.$[].levelCode": "EDU_12TH" } }
      );
      await collection.updateMany(
        { "eligibility.posts.education.levelCode": "MATRICULATION" },
        { $set: { "eligibility.posts.$[].education.$[].levelCode": "EDU_10TH" } }
      );
      await collection.updateMany(
        { "eligibility.posts.education.levelCode": "DIPLOMA" },
        { $set: { "eligibility.posts.$[].education.$[].levelCode": "EDU_DIPLOMA" } }
      );

      // 3. Find jobs that are missing the new arrays (or have them empty) and need flat compilation
      // 3. Find jobs that are missing the new arrays, or have extended JSON $date bugs
      const jobsToUpdate = await collection.find({
        $or: [
          { searchTokens: { $exists: false } },
          { searchTokens: { $size: 0 } },
          { streams: { $exists: false } },
          { "createdAt.$date": { $exists: true } },
          { "updatedAt.$date": { $exists: true } },
          // Catch common importantDates with $date (MongoDB extended JSON import artifact)
          { "importantDates.applicationStart.date.$date": { $exists: true } },
          { "importantDates.lastDate.date.$date": { $exists: true } }
        ]
      }).toArray();

      if (jobsToUpdate.length === 0) {
        continue;
      }

      console.log(`🔄 [StartupMigration] Found ${jobsToUpdate.length} legacy records in '${collName}'. Applying Data Flattening...`);

      let updateCount = 0;
      for (const job of jobsToUpdate) {
        let hasChanges = true; // Since they matched the query, we assume they need updates
        let setQuery = {};
        
        // --- Fix Extended JSON $date issues ---
        if (job.createdAt && typeof job.createdAt === "object" && job.createdAt.$date) {
          setQuery.createdAt = new Date(job.createdAt.$date);
        }
        if (job.updatedAt && typeof job.updatedAt === "object" && job.updatedAt.$date) {
          setQuery.updatedAt = new Date(job.updatedAt.$date);
        }
        
        if (job.importantDates) {
          let datesFixed = false;
          for (const key of Object.keys(job.importantDates)) {
            const dateObj = job.importantDates[key]?.date;
            if (dateObj && typeof dateObj === "object" && dateObj.$date) {
              job.importantDates[key].date = new Date(dateObj.$date);
              datesFixed = true;
            }
          }
          if (datesFixed) {
            setQuery.importantDates = job.importantDates;
          }
        }

        // --- Auto-compile Streams and Specializations ---
        const streamsSet = new Set();
        const specSet = new Set();
        
        if (job.eligibility && job.eligibility.posts) {
          job.eligibility.posts.forEach((p) => {
            if (p.education) {
              p.education.forEach((e) => {
                if (e.stream && e.stream.trim().toLowerCase() !== "any") {
                  streamsSet.add(e.stream.trim().toLowerCase());
                }
                if (e.specialization && e.specialization.trim().toLowerCase() !== "any") {
                  specSet.add(e.specialization.trim().toLowerCase());
                }
              });
            }
          });
        }
        setQuery.streams = Array.from(streamsSet);
        setQuery.specializations = Array.from(specSet);

        // --- Auto-compile Search Tokens ---
        const tokenSet = new Set();
        if (Array.isArray(job.jobDomains)) {
          job.jobDomains.forEach((t) => t && tokenSet.add(t.trim().toLowerCase()));
        }
        if (Array.isArray(job.tags)) {
          job.tags.forEach((t) => t && tokenSet.add(t.trim().toLowerCase()));
        }
        if (Array.isArray(job.searchKeywords)) {
          job.searchKeywords.forEach((t) => t && tokenSet.add(t.trim().toLowerCase()));
        }
        if (job.conductingBody) {
          tokenSet.add(job.conductingBody.trim().toLowerCase());
        }
        if (job.department) {
          tokenSet.add(job.department.trim().toLowerCase());
        }
        setQuery.searchTokens = Array.from(tokenSet).filter(Boolean);

        // Update in DB
        await collection.updateOne(
          { _id: job._id },
          { $set: setQuery }
        );
        updateCount++;
      }

      if (updateCount > 0) {
        console.log(`✅ [StartupMigration] Successfully auto-migrated ${updateCount} jobs in '${collName}'.`);
      }
    }
  } catch (err) {
    console.error("❌ [StartupMigration] Auto-migration failed:", err.message);
  }
}

module.exports = {
  runStartupMigration
};
