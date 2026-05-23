const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority').then(async () => {
  const db = mongoose.connection.db;
  const collection = db.collection('jobschemas');
  const today = new Date();
  const todayStr = today.toISOString();
  
  const filter = {
    status: { $in: ['active', 'upcoming'] },
    $or: [
      { 'importantDates.applyEnd.date': null },
      { 'importantDates.applyEnd.date': { $exists: false } },
      { 'importantDates.applyEnd.date': { $gte: today } },
      { 'importantDates.applyEnd.date': { $gte: todayStr } }
    ]
  };
  
  const docs = await collection.find(filter).sort({createdAt: -1}).limit(5).toArray();
  console.log(JSON.stringify(docs.map(d => ({
    id: d._id,
    title: d.title,
    status: d.status,
    applyEnd: d.importantDates?.applyEnd?.date
  })), null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
