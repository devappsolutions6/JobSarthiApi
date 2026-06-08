const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

const dbUrl = 'mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority';

mongoose.connect(dbUrl).then(async () => {
  const db = mongoose.connection.db;

  // Let's get a few users to see what fields they have and what they set in preferences.
  console.log("=== Fetching sample users from accounts collection ===");
  const users = await db.collection('accounts').find({}).limit(15).toArray();
  for (const user of users) {
    console.log(`User: ${user.firstName} ${user.lastName || ''} (${user.email})`);
    console.log(`  Education:`, JSON.stringify(user.education));
    console.log(`  Preferred Locations:`, JSON.stringify(user.preferredLocations));
    console.log(`  Category: ${user.category}`);
    console.log(`  Gender: ${user.gender}`);
    console.log(`  Organization Types:`, JSON.stringify(user.organizationTypes));
    console.log(`  Interests:`, JSON.stringify(user.interests));
    console.log(`  Selection Preference: ${user.selectionPreference}`);
    console.log(`  DOB: ${user.dob}`);
    console.log("-----------------------------------------");
  }

  // Let's get a few jobs to see their structure.
  console.log("\n=== Fetching sample active jobs from jobschemas ===");
  const jobs = await db.collection('jobschemas').find({ isActive: true }).limit(5).toArray();
  for (const job of jobs) {
    console.log(`Job Title: ${job.title}`);
    console.log(`  Conducting Body: ${job.conductingBody}`);
    console.log(`  Domains:`, JSON.stringify(job.jobDomains));
    console.log(`  Location: ${job.location}`);
    console.log(`  Education:`, JSON.stringify(job.eligibility?.posts?.map(p => p.education)));
    console.log(`  Search Tokens:`, JSON.stringify(job.searchTokens));
    console.log("-----------------------------------------");
  }

  // Let's see some UserRecommendation precomputed data.
  console.log("\n=== Fetching sample precomputed recommendations ===");
  const recs = await db.collection('userrecommendations').find({}).limit(5).toArray();
  for (const rec of recs) {
    console.log(`Recommendation for contactId: ${rec.contactId}`);
    console.log(`  Preferences Snapshot:`, JSON.stringify(rec.preferences));
    console.log(`  Recommendations count: ${rec.recommendations?.length || 0}`);
    if (rec.recommendations && rec.recommendations.length > 0) {
      console.log(`  Top 3 Recommendations:`);
      rec.recommendations.slice(0, 3).forEach((r, idx) => {
        console.log(`    ${idx + 1}. ${r.title} (Score: ${r.score})`);
      });
    }
    console.log("-----------------------------------------");
  }

  process.exit(0);
}).catch(e => {
  console.error("Connection failed:", e);
  process.exit(1);
});
