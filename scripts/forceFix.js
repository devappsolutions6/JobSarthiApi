require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function forceFix() {
  try {
    const conn = await mongoose.connect(process.env.DBURL || "mongodb://localhost:27017/jobsarthi");
    const collection = conn.connection.db.collection("jobs");
    
    // Forcefully remove the corrupted correctionWindow string field so Mongoose can recreate it as an object
    await collection.updateMany(
      { "importantDates.correctionWindow": "" },
      { $unset: { "importantDates.correctionWindow": "" } }
    );
    
    // Forcefully fix the levelCodes
    await collection.updateMany(
      { "eligibility.posts.education.levelCode": "GRADUATION" },
      { $set: { "eligibility.posts.$[].education.$[].levelCode": "EDU_GRAD" } }
    );
    
    console.log("Force fix complete.");
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}
forceFix();
