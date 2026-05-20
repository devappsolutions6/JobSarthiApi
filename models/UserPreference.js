const mongoose = require("mongoose");
const { USER_CATEGORIES, GENDERS, SELECTION_PREFERENCES, EDUCATION_LEVEL_CODES } = require("../utils/educationHelper");


const UserPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "accounts",
      required: true,
      unique: true,
      index: true,
    },

    // 🎓 EDUCATION (maps to eligibility.education)
    education: {
      levels: {
        type: [{ type: String, enum: EDUCATION_LEVEL_CODES }], 
        // examples: ["EDU_10TH", "EDU_GRAD"]
        default: [],
        index: true,
      },
      stream: {
        type: [String], 
        // examples: ["science", "arts", "commerce", "engineering"]
        default: [],
        index: true,
      },
      specialization: {
        type: [String], 
        // examples: ["civil", "mechanical", "computer science"]
        default: [],
      },
    },

    // 📍 LOCATION (maps to job.locations[])
    preferredLocations: {
      type: [String], 
      // examples: ["uttar pradesh", "delhi", "all india"] — always lowercase
      default: ["all india"],
      index: true,
    },

    // 👤 CATEGORY (maps to vacancies.breakup.category)
    category: {
      type: String,
      enum: USER_CATEGORIES,
      lowercase: true,
      index: true,
    },

    // 🚻 GENDER (maps to eligibility.gender)
    gender: {
      type: String,
      enum: GENDERS,
      default: "any",
      lowercase: true,
    },

    // 🏛 ORGANIZATION TYPE (maps to organization.type)
    organizationTypes: {
      type: [String], 
      // ["police", "railway", "banking", "teaching"]
      default: [],
      index: true,
    },

    // 🧠 INTERESTS (maps to metaTags & searchKeywords)
    interests: {
      type: [String],
      // ["constable", "technical", "government", "clerk"]
      default: [],
      index: true,
    },

    // 🎂 DATE OF BIRTH (for age-limit based job filtering & scoring)
    dob: { type: Date },

    // 🎯 SELECTION PROCESS PREFERENCE
    selectionPreference: {
      type: String,
      enum: SELECTION_PREFERENCES,
      default: "any",
    },

  },
  { timestamps: true }
);

// Explicit High-Performance Indexes are registered inline on fields (userId, interests, preferredLocations)
module.exports = mongoose.model("userpreferences", UserPreferenceSchema);
