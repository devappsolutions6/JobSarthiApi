const mongoose = require("mongoose");

const AdmitCardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    releaseDate: { type: Date },
    examDate: { type: Date },
    category: { type: String },
    
    // Strict normalized camelCase casing
    downloadLink: { type: String }
  },
  { timestamps: true }
);

// High-performance index paths for sorting dashboards on production
AdmitCardSchema.index({ releaseDate: -1 });
AdmitCardSchema.index({ examDate: -1 });
AdmitCardSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AdmitCard", AdmitCardSchema);
