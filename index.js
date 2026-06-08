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
const allowedOrigins = [
  "https://www.aspirantcareer.in",
  "https://job-sarthiv2-qo97.vercel.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Allow any local development port dynamically
      if (origin.startsWith("http://localhost:") || origin === "http://localhost") {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

Database().then(async () => {
  // Run background data flattening & cleanup
  const { runStartupMigration } = require("./utils/startupMigration");
  await runStartupMigration();
});

// Routes
app.use("/web/api", webroutes);

app.get("/", (req, res) => {
  res.send("Welcome to aspirantcareer.in API");
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
