const mongoose = require("mongoose");

const ConfigMasterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true }, // e.g., "jobDomains", "educationMapping"
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ConfigMaster", ConfigMasterSchema);
