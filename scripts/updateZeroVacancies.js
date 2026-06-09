require('dotenv').config({path: '.env'});
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

async function updateZeroVacancies() {
  const uri = process.env.DBURL;
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collection = db.collection('jobschemas');

  const updates = [
    { title: "Telangana Police Recruitment 2026: 5000+ SI, Constable & Police Staff Vacancies Expected", total: 5000 },
    // NABARD
    { title: "Assistant Manager (Grade A) - Rural Development Banking Service (RDBS)", total: 80 },
    { title: "Assistant Manager (Grade A) - Legal", total: 10 },
    { title: "Assistant Manager (Grade A) - Protocol & Security Services", total: 5 },
    { title: "Assistant Manager (Grade A) - Rajbhasha", total: 5 },
    // West Bengal
    { title: "Nirman Sahayak", total: 1000 },
    { title: "Panchayat Secretary", total: 1500 },
    { title: "Data Entry Operator", total: 1500 },
    { title: "Accounts Clerk", total: 1000 },
    { title: "Executive Assistant", total: 1000 },
    { title: "Gram Panchayat Sahayak", total: 2500 },
    { title: "Gram Panchayat Karmee", total: 2500 },
    // BPSC TRE 4.0
    { title: "10+2 School Teacher PGT (Class 11 to 12)", total: 16774 },
    { title: "School Teacher (Class 1 to 5)", total: 10778 },
    { title: "School Teacher (Class 6 to 10) / Secondary School Teacher TGT / TGT Special (Class 9 to 10)", total: 9082 }
  ];

  let modifiedCount = 0;
  for (const update of updates) {
    const result = await collection.updateOne(
      { title: update.title },
      { $set: { "vacancies.total": update.total } }
    );
    if (result.modifiedCount > 0) {
      modifiedCount++;
      console.log(`Updated ${update.title} to ${update.total}`);
    }
  }

  console.log(`Total jobs updated: ${modifiedCount}`);
  process.exit(0);
}

updateZeroVacancies().catch(console.error);
