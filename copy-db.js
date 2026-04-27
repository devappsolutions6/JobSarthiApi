const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const SOURCE_URI = "mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/JobSarthiv1?retryWrites=true&w=majority";
const DEST_URI = "mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/DevJobSarthi?retryWrites=true&w=majority";

async function copyDatabase() {
    console.log("Connecting to source database...");
    const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise();
    
    console.log("Connecting to destination database...");
    const destConn = await mongoose.createConnection(DEST_URI).asPromise();

    try {
        // Get all collections from the source database
        const collections = await sourceConn.db.listCollections().toArray();
        console.log(`Found ${collections.length} collections to copy.`);

        for (const colInfo of collections) {
            const colName = colInfo.name;
            // Skip system collections
            if (colName.startsWith('system.')) continue;

            console.log(`\nCopying collection: ${colName}`);
            const sourceCol = sourceConn.collection(colName);
            const destCol = destConn.collection(colName);

            // Fetch all documents from the source collection
            const docs = await sourceCol.find({}).toArray();
            console.log(`  Found ${docs.length} documents in ${colName}.`);

            // Fetch and copy indexes
            try {
                const indexes = await sourceCol.indexes();
                // Filter out the default _id index as it's automatically created
                const indexesToCreate = indexes.filter(idx => idx.name !== '_id_').map(idx => {
                    // Remove database-specific fields
                    const { ns, v, ...indexSpec } = idx;
                    return indexSpec;
                });

                if (indexesToCreate.length > 0) {
                    await destCol.createIndexes(indexesToCreate);
                    console.log(`  Successfully created ${indexesToCreate.length} custom indexes in ${colName}.`);
                }
            } catch (err) {
                console.error(`  Error copying indexes for ${colName}:`, err.message);
            }

            if (docs.length > 0) {
                // Insert the documents into the destination collection
                try {
                    // Use insertMany to insert documents
                    // ordered: false allows continuing insertion even if some documents throw errors (like duplicate key)
                    await destCol.insertMany(docs, { ordered: false });
                    console.log(`  Successfully copied documents into ${colName}.`);
                } catch (err) {
                    // Ignore duplicate key errors if you run this script multiple times
                    if (err.code === 11000 || (err.writeErrors && err.writeErrors.some(e => e.code === 11000))) {
                         console.log(`  Inserted some documents. Ignored duplicate keys for already existing data.`);
                    } else {
                         console.error(`  Error inserting documents into ${colName}:`, err.message);
                    }
                }
            } else {
                console.log(`  Skipped empty collection ${colName}.`);
            }
        }

        console.log("\nDatabase copy completed successfully!");

    } catch (err) {
        console.error("An error occurred during the copy process:", err);
    } finally {
        await sourceConn.close();
        await destConn.close();
        console.log("Database connections closed.");
    }
}

copyDatabase();
