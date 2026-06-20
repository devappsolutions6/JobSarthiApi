const mongoose = require("mongoose");
const { EDUCATION_LEVEL_CODES } = require("../utils/educationHelper");
const {
  LOCATION_CODES, STREAM_CODES, GENDER_CODES, CATEGORY_CODES,
  MARITAL_STATUS_CODES, PWD_CATEGORIES, NCC_CERTIFICATES
} = require("../utils/constants");


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

    notificationGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "jobs",
      index: true,
    },

    urlTitle: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    isPrimaryPost: {
      type: Boolean,
      default: true,
      index: true,
    },

    masterTitle: {
      type: String,
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

    locationCodes: {
      type: [{ type: String, enum: LOCATION_CODES }],
      default: ["ALL_INDIA"],
    },

    domicileRequired: {
      type: String,
      enum: LOCATION_CODES,
    },

    maritalStatusAllowed: {
      type: [{ type: String, enum: MARITAL_STATUS_CODES }],
      default: MARITAL_STATUS_CODES,
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
      categoryWiseAvailable: {
        type: Boolean,
        default: false,
      },
      categoryWise: mongoose.Schema.Types.Mixed,
      genderWise: mongoose.Schema.Types.Mixed,
      horizontalReservation: mongoose.Schema.Types.Mixed,
    },

    /* =========================
       ⏳ AGE LIMITS & CRITERIA
       ========================== */
    ageCriteria: {
      type: {
        type: String,
        default: "number",
      },
      asOnDate: Date,
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
      age: {
        min: Number,
        max: Number,
      },
      education: [
        {
          level: String,
          degree: String,
          levelCode: {
            type: String,
            enum: EDUCATION_LEVEL_CODES,
          },
          streamCodes: {
            type: [{ type: String, enum: STREAM_CODES }],
            default: []
          },
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
      generalRequirements: [String],
      
      minimumPercentageRequired: { type: Number, min: 0, max: 100, default: null },
      allowsFinalYearStudents: { type: Boolean, default: false },
      requiresTyping: { type: Boolean, default: false },
      requiresShorthand: { type: Boolean, default: false },
      nccBonusAvailable: { type: Boolean, default: false },
      sportsQuotaAvailable: { type: Boolean, default: false },
      maxAttempts: {
        UR: Number,
        OBC: Number,
        SCST: Number
      },
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
    
    // Auto-computed flat arrays for blazing fast personalization matching
    streams: [String],
    specializations: [String],
    searchTokens: [String],

    /* =========================
       🎯 RECOMMENDATION TARGETS
       Perfectly flattened object for instant recommendation matching
       ========================== */
    recommendationTargets: {
      minEducationRank: { type: Number, default: 0 },
      streamCodes: [{ type: String, enum: STREAM_CODES }],
      locationCodes: [{ type: String, enum: LOCATION_CODES }],
      age: {
        asOnDate: Date,
        min: { type: Number, default: 0 },
        maxGen: { type: Number, default: 99 },
        maxObc: { type: Number, default: 99 },
        maxScSt: { type: Number, default: 99 },
      },
      genders: [{ type: String, enum: GENDER_CODES }],
      categories: [{ type: String, enum: CATEGORY_CODES }],
      organizationTypes: [String],
      roles: [String],
      selectionFlags: {
        hasWrittenTest: { type: Boolean, default: false },
        hasPhysicalTest: { type: Boolean, default: false },
        hasInterview: { type: Boolean, default: false },
      }
    },

    relatedJobs: [
      {
        jobId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "jobs",
        },
        title: String,
        vacancies: Number,
      },
    ],

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
    syllabusStream: {
      type: String,
      enum: ["SSC", "Railway", "Banking", "UPSC", "Defence", "State", "None"],
      default: "None",
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
  "eligibility.education.levelCode": 1,
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
