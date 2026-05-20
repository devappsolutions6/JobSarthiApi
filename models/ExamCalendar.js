const mongoose = require("mongoose");
const { JOB_DOMAINS, EXAM_PHASES } = require("../utils/educationHelper");


const ExamCalendarSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: JOB_DOMAINS,
    },
    phase: {
      type: String,
      required: true,
      enum: EXAM_PHASES,
    },
    date: { type: Date, required: true },
    description: { type: String },
    officialLink: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ExamCalendarSchema.index({ date: 1, category: 1 });

module.exports = mongoose.model("examcalendar", ExamCalendarSchema);
