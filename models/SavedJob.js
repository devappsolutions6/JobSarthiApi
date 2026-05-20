const mongoose = require("mongoose");

const SavedJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "accounts", required: true },
    jobId:  { type: mongoose.Schema.Types.ObjectId, ref: "jobs",     required: true },
  },
  { timestamps: true }
);

SavedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model("savedjobs", SavedJobSchema);
