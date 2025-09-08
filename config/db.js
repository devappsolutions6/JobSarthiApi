const mongoose = require("mongoose");

const connectDb = async () => {
  try {
    const conn = await mongoose.connect(process.env.DBURL);
    console.log(`Database connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1); 
  }
};

module.exports = connectDb;
