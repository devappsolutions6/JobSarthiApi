require('dotenv').config({path: '.env'});
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

async function fixDates() {
  await mongoose.connect(process.env.DBURL);
  const db = mongoose.connection.db;
  const jobs = await db.collection('jobschemas').find({}).toArray();
  
  let updatedCount = 0;
  for(const job of jobs) {
    let needsUpdate = false;
    const update = { $set: {} };
    
    if (typeof job.createdAt === 'string') {
      update['$set'].createdAt = new Date(job.createdAt);
      needsUpdate = true;
    }
    if (typeof job.updatedAt === 'string') {
      update['$set'].updatedAt = new Date(job.updatedAt);
      needsUpdate = true;
    }
    
    if (job.importantDates) {
      for(const key of Object.keys(job.importantDates)) {
        if (job.importantDates[key] && typeof job.importantDates[key].date === 'string') {
          update['$set'][`importantDates.${key}.date`] = new Date(job.importantDates[key].date);
          needsUpdate = true;
        }
        if (key === 'correctionWindow' && job.importantDates[key]) {
          if (typeof job.importantDates[key].start === 'string') {
            update['$set'][`importantDates.correctionWindow.start`] = new Date(job.importantDates[key].start);
            needsUpdate = true;
          }
          if (typeof job.importantDates[key].end === 'string') {
            update['$set'][`importantDates.correctionWindow.end`] = new Date(job.importantDates[key].end);
            needsUpdate = true;
          }
        }
      }
    }
    
    // Fix recommendation targets age date
    if (job.recommendationTargets && job.recommendationTargets.age && typeof job.recommendationTargets.age.asOnDate === 'string') {
      update['$set']['recommendationTargets.age.asOnDate'] = new Date(job.recommendationTargets.age.asOnDate);
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await db.collection('jobschemas').updateOne({ _id: job._id }, update);
      updatedCount++;
    }
  }
  
  console.log('Fixed dates for ' + updatedCount + ' jobs');
  process.exit(0);
}

fixDates().catch(console.error);
