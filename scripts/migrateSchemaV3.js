require('dotenv').config({ path: '.env' });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const Job = require('../models/Job');

async function runMigration() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.DBURL);
    console.log('Connected to database successfully.');

    // Use raw MongoDB collection to bypass Mongoose schema cast/validation on query criteria
    console.log('Fetching all jobs with string-based notificationGroupId...');
    const stringGroupJobs = await Job.collection.find({
      notificationGroupId: { $type: 'string', $ne: '' }
    }).toArray();

    console.log(`Found ${stringGroupJobs.length} jobs with legacy string group IDs.`);

    // 2. Group the jobs by their legacy notificationGroupId string
    const groups = {};
    for (const job of stringGroupJobs) {
      const groupId = job.notificationGroupId;
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(job);
    }

    console.log(`Grouped into ${Object.keys(groups).length} unique groups.`);

    // 3. Process each group to establish primary/secondary linking
    for (const [groupStringId, jobsInGroup] of Object.entries(groups)) {
      console.log(`\nProcessing group: "${groupStringId}" (${jobsInGroup.length} jobs)`);

      // Determine the primary job
      let primaryJob = null;
      const primaryJobs = jobsInGroup.filter(j => j.isPrimaryPost === true);

      if (primaryJobs.length === 1) {
        primaryJob = primaryJobs[0];
      } else if (primaryJobs.length > 1) {
        console.log(`[Warning] Group "${groupStringId}" has multiple primary posts. Using the first one.`);
        primaryJob = primaryJobs[0];
        // Mark the rest as secondary
        for (let i = 1; i < primaryJobs.length; i++) {
          primaryJobs[i].isPrimaryPost = false;
        }
      } else {
        console.log(`[Warning] Group "${groupStringId}" has no primary post. Designating the first job as primary.`);
        primaryJob = jobsInGroup[0];
        primaryJob.isPrimaryPost = true;
        // Mark the rest as secondary
        for (let i = 1; i < jobsInGroup.length; i++) {
          jobsInGroup[i].isPrimaryPost = false;
        }
      }

      const primaryId = primaryJob._id;
      const secondaryJobs = jobsInGroup.filter(j => j._id.toString() !== primaryId.toString());

      console.log(`- Primary Job: "${primaryJob.title}" (ID: ${primaryId})`);
      console.log(`- Secondary Jobs Count: ${secondaryJobs.length}`);

      // Compile relatedJobs array for the primary job
      const relatedJobsList = secondaryJobs.map(sec => ({
        jobId: sec._id,
        title: sec.title,
        vacancies: sec.vacancies && typeof sec.vacancies.total === 'number' ? sec.vacancies.total : 0
      }));

      // Update primary job using raw updateOne
      await Job.collection.updateOne(
        { _id: primaryId },
        {
          $set: {
            isPrimaryPost: true,
            notificationGroupId: primaryId,
            relatedJobs: relatedJobsList
          }
        }
      );
      console.log(`- Updated primary job with ${relatedJobsList.length} related jobs.`);

      // Update secondary jobs using raw updateOne
      for (const sec of secondaryJobs) {
        await Job.collection.updateOne(
          { _id: sec._id },
          {
            $set: {
              isPrimaryPost: false,
              notificationGroupId: primaryId,
              relatedJobs: []
            }
          }
        );
      }
      console.log(`- Updated all secondary jobs in group.`);
    }

    // 4. Perform a bulk unset to clean up unused properties from all documents
    console.log('\nPerforming bulk unset for unused metadata fields...');
    const unsetResult = await Job.collection.updateMany(
      {},
      {
        $unset: {
          popularityScore: '',
          viewCount: '',
          saveCount: '',
          isFeatured: '',
          isPinned: ''
        }
      }
    );
    console.log(`Bulk unset complete. Modified ${unsetResult.modifiedCount} documents.`);

    // 5. Invalidate the Cache
    try {
      console.log('\nInvalidating cache...');
      const { clearCachePattern } = require('../utils/cache');
      await clearCachePattern('homepage_jobs_*');
      await clearCachePattern('jobs_*');
      console.log('Cache invalidated successfully.');
    } catch (err) {
      console.log('Cache invalidation skipped or failed:', err.message);
    }

    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
