const mongoose = require("mongoose");

const UserSyllabusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "accounts",
      required: true,
      unique: true,
      index: true,
    },
    // Array of completed topics (e.g. ["Quantitative Aptitude:Percentages", "Reasoning:Syllogisms"])
    completedTopics: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("usersyllabus", UserSyllabusSchema);
