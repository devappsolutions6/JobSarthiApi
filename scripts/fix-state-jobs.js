require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function fixStateJobs() {
  const uri = "mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority";

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    const jobsCollection = db.collection("jobschemas");

    const jobs = await jobsCollection.find({}).toArray();
    console.log(`Analyzing ${jobs.length} jobs...`);

    let updatedCount = 0;

    for (const job of jobs) {
      let needsUpdate = false;
      const updateFields = {};

      const jobDomains = job.jobDomains || [];
      const locationCodes = job.locationCodes || [];
      const hasStateDomain = jobDomains.some(d => d && d.toLowerCase() === "state");

      // Rule 1: If locationCodes indicates a specific state (not ALL_INDIA) and it's not already marked as a "state" domain
      const singleStateCode = locationCodes.length === 1 && locationCodes[0] !== "ALL_INDIA" ? locationCodes[0] : null;

      if (singleStateCode && !hasStateDomain) {
        console.log(`Job ${job.jobCode} ("${job.title}") is located in a single state (${singleStateCode}) but missing 'state' domain. Adding 'state'...`);
        const newDomains = [...jobDomains.filter(d => d && d.toLowerCase() !== "state"), "state"];
        updateFields.jobDomains = newDomains;
        needsUpdate = true;
      }

      // Rule 2: If it's a state job (has 'state' domain or specific state code) and missing domicileRequired, populate it
      const isStateJob = hasStateDomain || !!singleStateCode;
      if (isStateJob) {
        const targetState = singleStateCode || (locationCodes.find(loc => loc !== "ALL_INDIA") || null);
        if (targetState && (!job.domicileRequired || job.domicileRequired === "ALL_INDIA")) {
          console.log(`Job ${job.jobCode} ("${job.title}") is a state-level job but missing domicileRequired. Setting to ${targetState}...`);
          updateFields.domicileRequired = targetState;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await jobsCollection.updateOne(
          { _id: job._id },
          { $set: updateFields }
        );
        updatedCount++;
      }
    }

    console.log(`\nMigration complete. Updated ${updatedCount} jobs.`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

fixStateJobs();
