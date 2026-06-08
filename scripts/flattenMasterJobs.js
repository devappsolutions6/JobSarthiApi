require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const Job = require("../models/Job");

async function runMigration() {
  const uri = "mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority";

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log("Connected to MongoDB.");

    // IMPORTANT: We need to use lean() to get the raw object because the Schema has changed
    // and Mongoose might strip out 'breakup' and 'posts' since they aren't in the schema anymore!
    const jobs = await mongoose.connection.db.collection("jobschemas").find({}).toArray();
    console.log(`Found ${jobs.length} total jobs to process.`);

    let expandedCount = 0;
    let singleCount = 0;
    let deletedCount = 0;

    for (const job of jobs) {
      // Check if it's an old schema job that needs processing
      const hasOldEligibilityPosts = job.eligibility && job.eligibility.posts && job.eligibility.posts.length > 0;
      
      if (!hasOldEligibilityPosts) {
        // Already flattened or weird state. Ensure notificationGroupId exists.
        if (!job.notificationGroupId) {
            await mongoose.connection.db.collection("jobschemas").updateOne(
                { _id: job._id },
                { $set: { notificationGroupId: job.jobCode } }
            );
        }
        continue;
      }

      const posts = job.eligibility.posts;
      const breakups = (job.vacancies && job.vacancies.breakup) ? job.vacancies.breakup : [];

      console.log(`Processing Job: ${job.jobCode} (${posts.length} posts)`);

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        
        // Find corresponding breakup for vacancy details
        // Try to match by postName, otherwise use index
        let breakup = breakups.find(b => b.name && post.postName && b.name.toLowerCase() === post.postName.toLowerCase());
        if (!breakup && breakups.length > i) {
          breakup = breakups[i];
        }

        // Deep copy the original job to create the clone
        const newJob = JSON.parse(JSON.stringify(job));
        
        // Remove MongoDB ID and version so we can insert as new
        delete newJob._id;
        delete newJob.__v;

        // 1. Set Identifiers
        newJob.notificationGroupId = job.jobCode;
        
        // If there's only 1 post, we can keep the original codes/urls.
        // If > 1, we must append index to keep them unique.
        if (posts.length > 1) {
            // Modify title
            newJob.title = `${job.title} - ${post.postName}`;
            // Modify unique keys
            newJob.jobCode = `${job.jobCode}-P${i + 1}`;
            newJob.urlTitle = `${job.urlTitle}-p${i + 1}`;
        }

        // 2. Flatten Eligibility
        const generalReqs = newJob.eligibility.generalRequirements || [];
        newJob.eligibility = {
            age: post.age || null,
            education: post.education || [],
            experience: post.experience || { required: false },
            alternativeQualifications: post.alternativeQualifications || [],
            certifications: post.certifications || [],
            skills: post.skills || [],
            generalRequirements: generalReqs
        };

        // 3. Flatten Vacancies
        newJob.vacancies = {
            total: breakup ? (breakup.posts || 0) : (posts.length === 1 ? job.vacancies.total : 0),
            isTentative: job.vacancies ? job.vacancies.isTentative : false,
            categoryWiseAvailable: breakup ? !!breakup.categoryWiseAvailable : false,
            categoryWise: breakup ? breakup.categoryWise : null,
            genderWise: breakup ? breakup.genderWise : null,
            horizontalReservation: breakup ? breakup.horizontalReservation : null
        };

        // 4. Schema versioning
        newJob.schemaVersion = 3;
        
        // Delete the original job BEFORE inserting clones to avoid duplicate key errors on jobCode
        if (i === 0) {
            await mongoose.connection.db.collection("jobschemas").deleteOne({ _id: job._id });
        }

        // Insert the new flattened job
        await mongoose.connection.db.collection("jobschemas").insertOne(newJob);
        
        if (posts.length > 1) expandedCount++;
        else singleCount++;
      }

      deletedCount++;
    }

    console.log(`\nMigration Complete!`);
    console.log(`Old Master Jobs Deleted: ${deletedCount}`);
    console.log(`Single-Post Jobs Flattened: ${singleCount}`);
    console.log(`Multi-Post Jobs Expanded into: ${expandedCount} new jobs`);
    
    // Quick count of new total
    const newTotal = await mongoose.connection.db.collection("jobschemas").countDocuments();
    console.log(`New Total Jobs in DB: ${newTotal}`);

    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

runMigration();
