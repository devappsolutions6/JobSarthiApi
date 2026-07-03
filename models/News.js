const mongoose = require("mongoose");

const NewsSchema = new mongoose.Schema({
  title:   { type: String, required: true },
  source:  { type: String, default: "Google News" },
  pubDate: { type: Date },
  link:    { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("news", NewsSchema);
