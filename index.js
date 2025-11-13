const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const webroutes = require("./routes/webroutes");
const Database = require("./config/db");

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 REQUIRED FOR httpOnly cookies
app.use(cookieParser());

// Allowed frontend
// const FRONTEND = process.env.FRONTEND_URL;

// 🔥 FIXED CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",           // local development
      "https://jobsarthi.vercel.app",    // production frontend
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

Database();

// Routes
app.use("/", webroutes);

app.get("/", (req, res) => {
  res.send("Welcome to Home Page");
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
