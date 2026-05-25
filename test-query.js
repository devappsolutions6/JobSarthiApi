const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority').then(async () => {
  const db = mongoose.connection.db;
  
  const jobschemasCount = await db.collection('jobschemas').countDocuments({});
  const oldjobsCount = await db.collection('oldjobs').countDocuments({});
  
  console.log(`Active collection (jobschemas) count: ${jobschemasCount}`);
  console.log(`Archived collection (oldjobs) count: ${oldjobsCount}`);
  
  const activeJobs = await db.collection('jobschemas').countDocuments({ status: 'active' });
  const expiredJobs = await db.collection('jobschemas').countDocuments({ status: 'expired' });
  
  console.log(`  jobschemas -> active: ${activeJobs}`);
  console.log(`  jobschemas -> expired: ${expiredJobs}`);

  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
