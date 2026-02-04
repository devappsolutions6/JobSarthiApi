const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const webroutes = require("./routes/webroutes");
const Database = require("./config/db");

dotenv.config();

const app = express();

// ⭐ FIX FOR RENDER — MUST BE AT THE TOP
app.set("trust proxy", 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔥 REQUIRED FOR httpOnly cookies
app.use(cookieParser());


// 🔥 FIXED CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",           // local development
      "https://www.aspirantcareer.in/",    // production frontend
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

Database();

// Routes
app.use("/web/api", webroutes);

app.get("/", (req, res) => {
  res.send("Welcome to Home Page");
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
