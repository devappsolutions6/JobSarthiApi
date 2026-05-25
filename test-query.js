const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority').then(async () => {
  const db = mongoose.connection.db;
  const collection = db.collection('jobschemas');
  const today = new Date();
  const todayStr = today.toISOString();
  
  const docs = await collection.find({
    status: 'active',
    'eligibility.posts.education.levelCode': 'EDU_ANY'
  }).toArray();
  
  const results = docs.map(d => {
    const anyLevels = d.eligibility?.posts?.flatMap(p => 
      p.education?.filter(e => e.levelCode === 'EDU_ANY').map(e => e.level)
    ).filter(Boolean);
    return {
      title: d.title,
      eligibility: d.eligibility
    };
  });
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
