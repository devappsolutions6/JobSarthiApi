const { MongoClient } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const uri = "mongodb+srv://imvksb:Book2231042%40@cluster0.7pbs4.mongodb.net/?retryWrites=true&w=majority";

async function checkProdDb() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        
        const db3 = client.db("JobSarthi");
        const db4 = client.db("jobsarthi");
        
        console.log("JobSarthi jobs:", await db3.collection("jobs").countDocuments());
        console.log("jobsarthi jobs:", await db4.collection("jobs").countDocuments());
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
checkProdDb();
