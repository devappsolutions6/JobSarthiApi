const mongoose = require("mongoose");
const dns = require("dns");
require("dotenv").config();

// Fix for SRV DNS resolution issues
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const { UserSignupSchemaDatas, UserprefrenceData } = require("./models/webmodel");

async function migrate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.DBURL);
    console.log("Connected successfully.");

    const users = await UserSignupSchemaDatas.find({});
    console.log(`Found ${users.length} total users in accounts.`);

    let migratedCount = 0;
    let initializedCount = 0;

    for (const user of users) {
      try {
        // Try to find if this user has old preferences
        const pref = await UserprefrenceData.findOne({ userId: user._id });
        
        const updatePayload = {
          education: pref ? pref.education : { levels: [], stream: [], specialization: [] },
          preferredLocations: pref ? pref.preferredLocations : ["All India"],
          category: pref ? pref.category : null,
          gender: pref ? pref.gender : "any",
          organizationTypes: pref ? pref.organizationTypes : [],
          interests: pref ? pref.interests : [],
          dob: pref ? pref.dob : null,
          selectionPreference: pref ? pref.selectionPreference : "any",
        };

        await UserSignupSchemaDatas.findByIdAndUpdate(
          user._id,
          { 
            $set: updatePayload
          }
        );

        if (pref) {
          migratedCount++;
        } else {
          initializedCount++;
        }
      } catch (err) {
        console.error(`Error processing user ${user.email}:`, err.message);
      }
    }

    console.log("\nProcess completed!");
    console.log(`Users with migrated data: ${migratedCount}`);
    console.log(`Users initialized with defaults: ${initializedCount}`);
    console.log(`Total users processed: ${migratedCount + initializedCount}`);
    
    if (migratedCount > 0) {
        console.log("\nSUGGESTION: You can now safely delete the 'userpreferences' collection if you wish.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
