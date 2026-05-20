const mongoose = require("mongoose");

const ResultSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    
    // Strict normalized camelCase casing
    releaseDate: { type: Date },
    downloadLink: { type: String }
  },
  { timestamps: true }
);

// High-performance index paths for sorting dashboards on production
ResultSchema.index({ releaseDate: -1 });
ResultSchema.index({ createdAt: -1 });

module.exports = mongoose.model("result", ResultSchema);
