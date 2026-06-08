require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const Job = require("../models/Job");

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(process.env.DBURL || "mongodb://localhost:27017/jobsarthi");
    console.log(`Connected to MongoDB: ${conn.connection.host}`);

    console.log("Fetching all jobs...");
    const jobs = await Job.find({}); // Don't use .lean() because we need Mongoose documents to call .save()
    console.log(`Found ${jobs.length} jobs to migrate.`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      try {
        // Trigger pre-save hooks which will populate the new flattened fields
        await job.save();
        successCount++;
        if (successCount % 100 === 0) {
          console.log(`Progress: Processed ${successCount}/${jobs.length} jobs.`);
        }
      } catch (err) {
        console.error(`Error saving job ${job._id}:`, err.message);
        errorCount++;
      }
    }

    console.log("-----------------------------------------");
    console.log("Migration Complete!");
    console.log(`Successfully updated: ${successCount} jobs`);
    console.log(`Errors: ${errorCount}`);
    console.log("-----------------------------------------");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

migrate();
