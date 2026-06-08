const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

const dbUrl = 'mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority';
const { EDUCATION_RANKS: educationRank } = require("./utils/educationHelper");

mongoose.connect(dbUrl).then(async () => {
  const db = mongoose.connection.db;

  const activeJobs = await db.collection('jobschemas').find({ isActive: true }).limit(5).toArray();
  console.log("=== COMPILING NEW FLAT SCHEMA FIELDS FOR SAMPLE JOBS ===");

  for (const job of activeJobs) {
    const educationLevels = [];
    const educationRanks = [];

    if (job.eligibility?.posts) {
      job.eligibility.posts.forEach((p) => {
        if (p.education) {
          p.education.forEach((e) => {
            if (e.levelCode) {
              educationLevels.push(e.levelCode);
              educationRanks.push(educationRank[e.levelCode] || 0);
            }
          });
        }
      });
    }

    const uniqueLevels = Array.from(new Set(educationLevels));
    const uniqueRanks = Array.from(new Set(educationRanks));
    const minEducationRank = uniqueRanks.length > 0 ? Math.min(...uniqueRanks) : 0;

    // Compile age limits
    let ageMin = 99;
    let ageMax = 0;
    if (job.eligibility?.posts) {
      job.eligibility.posts.forEach(p => {
        if (p.age) {
          if (p.age.min !== undefined && p.age.min < ageMin) ageMin = p.age.min;
          if (p.age.max !== undefined && p.age.max > ageMax) ageMax = p.age.max;
        }
      });
    }
    // Fallbacks
    if (ageMin === 99) ageMin = job.ageCriteria?.numberBased?.min || 0;
    if (ageMax === 0) ageMax = job.ageCriteria?.numberBased?.max || 99;

    console.log(`Job: "${job.title}"`);
    console.log(`  Compiled Levels:`, JSON.stringify(uniqueLevels));
    console.log(`  Compiled Ranks:`, JSON.stringify(uniqueRanks));
    console.log(`  Min Edu Rank: ${minEducationRank}`);
    console.log(`  Age Limits: Min: ${ageMin}, Max: ${ageMax}`);
    console.log("-----------------------------------------");
  }

  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
