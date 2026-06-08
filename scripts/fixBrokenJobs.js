require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Don't import the model directly because Mongoose validation will block us from fetching/saving.
// We will use the raw MongoDB driver collection to perform an un-validated mass update.

async function fixBrokenJobs() {
  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(process.env.DBURL || "mongodb://localhost:27017/jobsarthi");
    console.log(`Connected to MongoDB: ${conn.connection.host}`);

    const collection = conn.connection.db.collection("jobs");
    
    console.log("Fetching jobs to fix...");
    const jobs = await collection.find({}).toArray();
    let fixCount = 0;

    for (const job of jobs) {
      let needsUpdate = false;

      // 1. Fix Correction Window string error
      if (typeof job.importantDates?.correctionWindow === "string") {
        job.importantDates.correctionWindow = { tentative: false };
        needsUpdate = true;
      }

      // 2. Fix Important Dates $date Extended JSON issue
      if (job.importantDates) {
        for (const key of Object.keys(job.importantDates)) {
          const dateObj = job.importantDates[key]?.date;
          if (dateObj && typeof dateObj === "object" && dateObj.$date) {
            job.importantDates[key].date = new Date(dateObj.$date);
            needsUpdate = true;
          }
        }
      }
      
      // Fix createdAt $date issue
      if (job.createdAt && typeof job.createdAt === "object" && job.createdAt.$date) {
        job.createdAt = new Date(job.createdAt.$date);
        needsUpdate = true;
      }

      // 3. Fix levelCode Enum mapping
      if (job.eligibility && Array.isArray(job.eligibility.posts)) {
        for (const post of job.eligibility.posts) {
          if (Array.isArray(post.education)) {
            for (const edu of post.education) {
              if (edu.levelCode) {
                const oldCode = edu.levelCode.toUpperCase();
                let newCode = oldCode;
                
                if (oldCode === "GRADUATION") newCode = "EDU_GRAD";
                else if (oldCode === "POST_GRADUATION") newCode = "EDU_POSTGRAD";
                else if (oldCode === "INTERMEDIATE") newCode = "EDU_12TH";
                else if (oldCode === "MATRICULATION") newCode = "EDU_10TH";
                else if (oldCode === "DIPLOMA") newCode = "EDU_DIPLOMA";

                if (newCode !== oldCode) {
                  edu.levelCode = newCode;
                  needsUpdate = true;
                }
              }
            }
          }
        }
      }

      if (needsUpdate) {
        await collection.updateOne({ _id: job._id }, { $set: job });
        fixCount++;
        console.log(`Fixed validation errors for job: ${job._id}`);
      }
    }

    console.log(`Successfully fixed ${fixCount} jobs in the database!`);
    console.log("We can now re-run the migrateJobTokens.js script to fully apply the flat arrays.");

  } catch (err) {
    console.error("Fix failed:", err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

fixBrokenJobs();
