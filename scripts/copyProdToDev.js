require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

async function copyProdToDev() {
  const prodUri = "mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/ProdBackup?retryWrites=true&w=majority";
  const devUri = "mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority";

  try {
    console.log("Connecting to Dev DB...");
    const devConn = await mongoose.createConnection(devUri).asPromise();
    
    console.log("Connecting to Prod DB...");
    const prodConn = await mongoose.createConnection(prodUri).asPromise();

    const collectionsToCopy = ["jobs", "users", "userrecommendations"]; // Add more if needed

    for (const collectionName of collectionsToCopy) {
      console.log(`\n--- Processing collection: ${collectionName} ---`);
      
      const prodCollection = prodConn.collection(collectionName);
      const devCollection = devConn.collection(collectionName);

      // 1. Drop existing data in dev
      console.log(`Dropping existing documents in Dev '${collectionName}'...`);
      await devCollection.deleteMany({});

      // 2. Fetch all documents from prod
      console.log(`Fetching documents from Prod '${collectionName}'...`);
      const docs = await prodCollection.find({}).toArray();
      
      // 3. Insert into dev
      if (docs.length > 0) {
        console.log(`Inserting ${docs.length} documents into Dev '${collectionName}'...`);
        await devCollection.insertMany(docs);
      } else {
        console.log(`No documents found in Prod '${collectionName}'.`);
      }
    }

    console.log("\n✅ Successfully copied all data from Prod to Dev.");

    await devConn.close();
    await prodConn.close();
    process.exit(0);

  } catch (error) {
    console.error("❌ Error copying data:", error);
    process.exit(1);
  }
}

copyProdToDev();
