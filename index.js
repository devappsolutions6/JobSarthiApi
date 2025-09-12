const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");   // ⬅️ yaha import
const webroutes = require("./routes/webroutes");
const Database = require("./config/db");

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

// ✅ CORS Middleware
app.use(cors({
  origin: "*", // sab jagah se allow karega (frontend ka URL yaha daalna best practice hai)
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

Database();

// Routes
app.use("/", webroutes);

// Root route
app.get("/", (req, res) => {
  res.send("Welcome to Home Page");
});

// Server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
