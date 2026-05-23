const mongoose = require("mongoose");
const { EDUCATION_LEVEL_CODES } = require("../utils/educationHelper");


/* ==========================================================
   📄 MASTER JOB SCHEMA (UNIFIED FLAT STRUCTURE)
   ========================================================== */

const JobSchema = new mongoose.Schema(
  {
    /* =========================
       🔹 BASIC JOB INFORMATION
       ========================== */
    jobCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
    },

    urlTitle: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    shortDescription: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    conductingBody: {
      type: String,
    },

    department: {
      type: String,
    },

    organization: {
      type: String,
    },

    postType: {
      type: String,
      default: "regular",
      lowercase: true,
      trim: true,
    },

    jobDomains: [String],

    location: {
      type: String,
      default: "All India",
    },

    stateEligibility: [String],

    examLanguages: [String],

    isActive: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      default: "active",
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },

    /* =========================
       💰 SALARY / PAY SCALE
       ========================== */
    salaryRange: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: "INR",
      },
      unit: {
        type: String,
        default: "monthly",
      },
      note: String,
    },

    /* =========================
       📊 VACANCY DETAILS
       ========================== */
    vacancies: {
      total: {
        type: Number,
        default: 0,
      },
      isTentative: {
        type: Boolean,
        default: false,
      },
      breakup: [
        {
          postCode: String,
          level: String,
          name: String,
          organization: String,
          posts: Number,
          ageMin: Number,
          ageMax: Number,
          payScale: {
            level: String,
            min: Number,
            max: Number,
            currency: {
              type: String,
              default: "INR",
            },
          },
          categoryWise: mongoose.Schema.Types.Mixed,
          categoryWiseAvailable: {
            type: Boolean,
            default: false,
          },
          genderWise: mongoose.Schema.Types.Mixed,
          horizontalReservation: mongoose.Schema.Types.Mixed,
        },
      ],
    },

    /* =========================
       ⏳ AGE LIMITS & CRITERIA
       ========================== */
    ageCriteria: {
      type: {
        type: String,
        default: "number",
      },
      numberBased: {
        min: Number,
        max: Number,
      },
      dobBased: {
        from: Date,
        to: Date,
      },
      relaxationRules: [
        {
          category: String,
          years: Number,
          note: String,
        },
      ],
    },

    /* =========================
       📚 ELIGIBILITY CRITERIA
       ========================== */
    eligibility: {
      posts: [
        {
          postName: String,
          age: {
            min: Number,
            max: Number,
          },
          education: [
            {
              level: String,
              levelCode: {
                type: String,
                enum: EDUCATION_LEVEL_CODES,
                index: true,
              },
              stream: String,
              specialization: String,
              minMarks: Number,
              required: {
                type: Boolean,
                default: true,
              },
            },
          ],
          alternativeQualifications: [
            {
              degree: String,
              description: String,
            },
          ],
          experience: {
            required: {
              type: Boolean,
              default: false,
            },
            minYears: Number,
            field: String,
          },
          certifications: [String],
          skills: [String],
        },
      ],
      generalRequirements: [String],
    },

    /* =========================
       💪 PHYSICAL CRITERIA
       ========================== */
    physicalCriteria: {
      applicable: {
        type: Boolean,
        default: false,
      },
      height: {
        male: {
          value: Number,
          unit: String,
        },
        female: {
          value: Number,
          unit: String,
        },
      },
      chest: {
        min: {
          value: Number,
          unit: String,
        },
        max: {
          value: Number,
          unit: String,
        },
      },
      weight: {
        male: {
          min: Number,
          max: Number,
          unit: String,
        },
        female: {
          min: Number,
          max: Number,
          unit: String,
        },
      },
      running: {
        male: {
          distance: {
            value: Number,
            unit: String,
          },
          time: {
            value: Number,
            unit: String,
          },
        },
        female: {
          distance: {
            value: Number,
            unit: String,
          },
          time: {
            value: Number,
            unit: String,
          },
        },
      },
      events: mongoose.Schema.Types.Mixed,
    },

    /* =========================
       📝 SELECTION PROCESS
       ========================== */
    selectionProcess: [
      {
        order: Number,
        stage: String,
        description: String,
        qualifying: {
          type: Boolean,
          default: true,
        },
        marksWeightage: Number,
      },
    ],

    /* =========================
       💳 APPLICATION FEE
       ========================== */
    applicationFee: [
      {
        category: String,
        amount: Number,
        refundable: {
          type: Boolean,
          default: false,
        },
        note: String,
      },
    ],

    /* =========================
       📅 IMPORTANT DATES
       ========================== */
    importantDates: {
      notificationDate: {
        date: Date,
        tentative: { type: Boolean, default: false },
      },
      applyStart: {
        date: Date,
        tentative: { type: Boolean, default: false },
      },
      applyEnd: {
        date: Date,
        tentative: { type: Boolean, default: false },
      },
      feeLastDate: {
        date: Date,
        tentative: { type: Boolean, default: false },
      },
      correctionWindow: {
        start: Date,
        end: Date,
        tentative: { type: Boolean, default: false },
      },
      examDate: {
        date: Date,
        tentative: { type: Boolean, default: true },
        note: String,
      },
      admitCardDate: {
        date: Date,
        tentative: { type: Boolean, default: true },
        note: String,
      },
      resultDate: {
        date: Date,
        tentative: { type: Boolean, default: true },
        note: String,
      },
      documentVerificationDate: {
        date: Date,
        tentative: { type: Boolean, default: true },
        note: String,
      },
      joiningDate: {
        date: Date,
        tentative: { type: Boolean, default: true },
        note: String,
      },
    },

    /* =========================
       🔗 EXTERNAL LINKS
       ========================== */
    links: {
      notification: String,
      applyOnline: String,
      syllabus: String,
      admitCard: String,
      result: String,
      answerKey: String,
      officialWebsite: String,
    },

    /* =========================
       🏷️ TAGGING & SEARCH META
       ========================== */
    tags: [String],
    searchKeywords: [String],
    targetCategories: [String],

    relatedJobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "jobs",
      },
    ],

    popularityScore: {
      type: Number,
      default: 0,
    },

    viewCount: {
      type: Number,
      default: 0,
    },

    saveCount: {
      type: Number,
      default: 0,
    },

    /* =========================
       🛡️ SYSTEM META-DATA
       ========================== */
    meta: {
      dataCompleteness: {
        type: String,
        default: "full",
      },
      lastVerifiedAt: {
        type: Date,
        default: Date.now,
      },
      source: String,
      notes: String,
    },
    isRecommendationProcessed: {
      type: Boolean,
      default: false,
    },

    // schemaVersion = 3 for unified flat schema structure
    schemaVersion: {
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
  }
);

/* ==========================================================
   🚀 INDEXES
   ========================================================== */

JobSchema.index({
  title: "text",
  conductingBody: "text",
  department: "text",
  tags: "text",
  searchKeywords: "text",
});

JobSchema.index({
  isActive: 1,
  createdAt: -1,
});

JobSchema.index({
  status: 1,
  createdAt: -1,
});

JobSchema.index({
  status: 1,
  "vacancies.total": -1,
});

JobSchema.index({
  "importantDates.applyEnd.date": 1,
});

// Compound index for the recommendation cron's dirty-flag query:
// Job.find({ isRecommendationProcessed: false, isActive: true })
JobSchema.index({
  isRecommendationProcessed: 1,
  isActive: 1,
});

// Compound indexes to optimize complex multi-preference checks (like eligibility checks and matching recommendations)
JobSchema.index({
  status: 1,
  jobDomains: 1,
  location: 1,
});

JobSchema.index({
  status: 1,
  "eligibility.posts.education.levelCode": 1,
  location: 1,
});

/* ==========================================================
   🧹 CACHE INVALIDATION HOOKS
   ========================================================== */

// Post-save and post-update hooks to invalidate cache when a job is created, updated, or deleted
JobSchema.post("save", async function() {
  try {
    const { clearCachePattern } = require("../utils/cache");
    await clearCachePattern("homepage_jobs_*");
    await clearCachePattern("jobs_*");
  } catch (err) {
    console.error("⚠️ [Cache] Failed to invalidate cache on job save:", err.message);
  }
});

const invalidateJobCache = async function() {
  try {
    const { clearCachePattern } = require("../utils/cache");
    await clearCachePattern("homepage_jobs_*");
    await clearCachePattern("jobs_*");
  } catch (err) {
    console.error("⚠️ [Cache] Failed to invalidate cache on job query update:", err.message);
  }
};

JobSchema.post("updateOne", invalidateJobCache);
JobSchema.post("updateMany", invalidateJobCache);
JobSchema.post("findOneAndUpdate", invalidateJobCache);
JobSchema.post("deleteOne", invalidateJobCache);
JobSchema.post("deleteMany", invalidateJobCache);
JobSchema.post("findOneAndDelete", invalidateJobCache);

module.exports = mongoose.model("jobs", JobSchema, "jobschemas");
