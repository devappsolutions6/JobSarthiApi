const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4']);

const URI = "mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/JobSarthiv1?retryWrites=true&w=majority";

async function fixDates() {
    console.log("Connecting to database...");
    try {
        await mongoose.connect(URI);
        const db = mongoose.connection.db;
        const collection = db.collection('jobschemas');

        const docs = await collection.find({}).toArray();
        let updatedCount = 0;

        for (const doc of docs) {
            let needsUpdate = false;
            const updateDoc = { $set: {} };

            // Helper to check and convert string or {$date} object dates
            const checkAndConvert = (path, value) => {
                if (!value) return;
                let dateStr = null;
                if (typeof value === 'string') {
                    dateStr = value;
                } else if (typeof value === 'object' && value['$date']) {
                    dateStr = value['$date'];
                }

                if (dateStr) {
                    const parsed = new Date(dateStr);
                    if (!isNaN(parsed.getTime())) {
                        updateDoc.$set[path] = parsed;
                        needsUpdate = true;
                    }
                }
            };

            // Convert importantDates fields
            if (doc.importantDates) {
                const datesObj = doc.importantDates;
                for (const key of Object.keys(datesObj)) {
                    if (datesObj[key] && typeof datesObj[key] === 'object') {
                        if (datesObj[key].date) {
                            checkAndConvert(`importantDates.${key}.date`, datesObj[key].date);
                        }
                        if (datesObj[key].start) {
                            checkAndConvert(`importantDates.${key}.start`, datesObj[key].start);
                        }
                        if (datesObj[key].end) {
                            checkAndConvert(`importantDates.${key}.end`, datesObj[key].end);
                        }
                    }
                }
            }
            
            // Convert ageCriteria.numberBased.referenceDate if exists
            if (doc.ageCriteria?.numberBased?.referenceDate) {
                checkAndConvert('ageCriteria.numberBased.referenceDate', doc.ageCriteria.numberBased.referenceDate);
            }

            if (needsUpdate) {
                await collection.updateOne({ _id: doc._id }, updateDoc);
                updatedCount++;
            }
        }

        console.log(`Successfully updated ${updatedCount} documents with proper Date objects.`);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

fixDates();
