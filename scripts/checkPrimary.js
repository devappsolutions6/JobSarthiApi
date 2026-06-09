require('dotenv').config({path: '.env'});
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
mongoose.connect(process.env.DBURL).then(async () => {
  const db = mongoose.connection.db;
  const count = await db.collection('jobschemas').countDocuments({ isPrimaryPost: { $ne: false } });
  console.log('Primary posts: ' + count);
  const docs = await db.collection('jobschemas').find({ isPrimaryPost: { $ne: false } }).limit(2).toArray();
  console.log(docs.map(d => ({title: d.title, masterTitle: d.masterTitle})));
  process.exit(0);
});
