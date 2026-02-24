const mongoose = require("mongoose");

const connectDb = async () => {
  try {
    const conn = await mongoose.connect(process.env.DBURL, {
      maxPoolSize: 10,                // max 10 simultaneous DB connections per worker
      serverSelectionTimeoutMS: 5000, // fail fast if DB is unreachable
      socketTimeoutMS: 45000,         // close idle sockets after 45s
    });
    console.log(`Database connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDb;
