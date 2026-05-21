const mongoose = require("mongoose");

const RecommendationItemSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "jobs",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
  },
  location: String,
  organization: String,
  applyEnd: Date,
  salaryMin: Number,
  salaryMax: Number,
  vacancies: {
    total: {
      type: Number,
      default: 0,
    }
  },
  score: {
    type: Number,
    required: true,
  },
  matchedOn: [String],
  generatedAt: {
    type: Date,
    default: Date.now,
  }
});

const PreferenceSnapshotSchema = new mongoose.Schema({
  educationLevels: {
    type: [String],
    default: [],
  },
  educationStreams: {
    type: [String],
    default: [],
  },
  specializations: {
    type: [String],
    default: [],
  },
  preferredLocations: {
    type: [String],
    default: [],
  },
  category: {
    type: String,
    default: "",
  },
  gender: {
    type: String,
    default: "any",
  },
  organizationTypes: {
    type: [String],
    default: [],
  },
  interests: {
    type: [String],
    default: [],
  },
  selectionPreference: {
    type: String,
    default: "any",
  },
  dob: {
    type: Date,
    default: null,
  }
});

const UserRecommendationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
      unique: true, // Exactly one recommendation sheet per user account
      index: true,
    },
    contactId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    preferences: {
      type: PreferenceSnapshotSchema,
      required: true,
    },
    recommendations: [RecommendationItemSchema],
    lastComputedAt: {
      type: Date,
      default: Date.now,
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "userrecommendations",
  UserRecommendationSchema,
  "userrecommendations"
);
