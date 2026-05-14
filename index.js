const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const webroutes = require("./routes/webroutes");
const Database = require("./config/db");

dotenv.config();

const app = express();

// FIX FOR RENDER — MUST BE AT THE TOP
app.set("trust proxy", 1);

// Compress all responses — reduces response size by 60-70%
app.use(compression());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// REQUIRED FOR httpOnly cookies
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://www.aspirantcareer.in",
      "https://job-sarthiv2-qo97.vercel.app"

    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

Database();

// Routes
app.use("/web/api", webroutes);

app.get("/", (req, res) => {
  res.send("Welcome to JobSarthi API");
});

// Health check endpoint — used by load balancers and monitoring tools
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Worker ${process.pid} running on http://localhost:${PORT}`);
});
