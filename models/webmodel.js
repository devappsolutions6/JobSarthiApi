const { application } = require("express");
const mongoose = require("mongoose");


//  Announcement Schema
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  status: { type: String, required: true }, 
  link: { type: String, required: true },
  orderNo:{type:Number, require: true},
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const AnnouncementData = mongoose.model("announcement", announcementSchema);



//AdmitCard Schema

const AdmitCardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  releaseDate: { type: Date },
  examDate: { type: Date },
  category: { type: String },
   DownloadLink:{type: String,}
});

const AdmitCardData = mongoose.model("AdmitCard", AdmitCardSchema);




//Result Schena

const ResultSchema = new mongoose.Schema({
  title: {type: String, required: true},
  description:{type: String, },
  ReleaseDate:{type: Date, },
  DownloadLink:{type: String,}
})

const ResultCardData = mongoose.model("result", ResultSchema);




// user Singnup Api

const UserSignupSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String},
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date },
  resetOtp: { type: String },
  resetOtpExpiry: { type: Date },
  refreshToken: { type: String },
 
  education: {
    levels: { type: [String], default: [] },
    stream: { type: [String], default: [] },
    specialization: { type: [String], default: [] },
  },
  preferredLocations: { type: [String], default: ["All India"] },
  category: { type: String, lowercase: true },
  gender: { type: String, default: "any", lowercase: true },
  organizationTypes: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  dob: { type: Date },
  selectionPreference: { type: String, enum: ["any", "written", "pet", "interview"], default: "any" },
}, { timestamps: true });
 

const UserSignupSchemaDatas = mongoose.model("accounts", UserSignupSchema);




//Jobs Schemasss
const JobsSchema = new mongoose.Schema(
  {
    /* =========================
       🔹 BASIC JOB INFORMATION
    ========================== */
    title: { type: String, required: true, index: true }, 
    urlTitle:{type:String, required:true},
    jobCode: { type: String, unique: true, index: true }, // SSC-GD-2026
    department: { type: String }, // SSC, UPSC, RRB, UPPRPB
    conductingBody: { type: String }, // SSC / UPSC / BPSC

    jobDomains: [
      {
        type: String,
        enum: [
          "Central",
          "State",
          "Defence",
          "Police",
          "Railway",
          "Teaching",
          "Banking",
          "PSU",
          "Medical",
          "Engineering",
          "Other",
        ],
      },
    ],

    location: { type: String, default: "All India" },
    description: String,
    isActive: { type: Boolean, default: true },

    /* =========================
       🧾 VACANCY DETAILS
    ========================== */
    vacancies: {
  total: { type: Number },

  breakup: [
    {
      // ✅ EXISTING — no change
      level: String,
      name: String,
      posts: { type: Number },

      // ➕ ADD — post code like "5/26", "Category-1"
      postCode: { type: String },

      // ➕ ADD — agar ek notification me multiple orgs ho
      organization: { type: String },

      // ➕ ADD — post-wise age (global ageCriteria se alag hoga kabhi kabhi)
      ageMin: { type: Number },
      ageMax: { type: Number },

      // ➕ ADD — salary info
      payScale: {
        level: { type: String },        // "Level-3"
        min: { type: Number },          // 21700
        max: { type: Number },          // 69100
        currency: { type: String, default: "INR" },
      },

      // 🔄 MODIFY categoryWise — sebc add karo (Odisha/other states use karte hain)
      categoryWise: {
        gen: Number,
        obc: Number,
        sc: Number,
        st: Number,
        ews: Number,
        sebc: Number,    // ➕ ADD
        female: Number,
        other: Number,
      },

      // ✅ EXISTING — no change
      genderWise: {
        male: Number,
        female: Number,
      },

      // ➕ ADD — horizontal reservation (category ke andar reserved seats)
      horizontalReservation: {
        women: { type: Number, default: 0 },
        exSM: { type: Number, default: 0 },   // Ex-Servicemen
        pwd: { type: Number, default: 0 },
      },

      // ➕ ADD — jab category-wise data available na ho notification me
      categoryWiseAvailable: { type: Boolean, default: false },
    },
  ],
},

  
 /* =========================
       📚 New Eligibility ELIGIBILITY CRITERIA
    ========================== */
eligibility: {
  posts: [
    {
      postName: String,

      age: {
        min: Number,
        max: Number
      },

      education: [
        {
          degree: String,       // B.Tech
          stream: String,       // Electronics
          specialization: String,
          minMarks: Number
        }
      ],

      alternativeQualifications: [
        {
          degree: String,
          description: String
        }
      ],

      experience: {
        required: Boolean,
        minYears: Number,
        field: String
      },

      certifications: [
        String
      ],

      skills: [
        String
      ]
    }
  ],

  generalRequirements: [
    String
  ]
}
,

    /* =========================
       🎂 AGE CRITERIA
    ========================== */
    ageCriteria: {
      type: {
        type: String,
        enum: ["NUMBER", "DOB"],
        default: "NUMBER",
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
          category: String, // SC/ST, OBC, Female
          years: Number,
        },
      ],
    },

    /* =========================
   🏃 PHYSICAL CRITERIA (OPTIONAL)
========================== */
physicalCriteria: {
  height: {
    male: {
      value: { type: Number },
      unit: { type: String, default: "cm" }
    },
    female: {
      value: { type: Number },
      unit: { type: String, default: "cm" }
    }
  },

  chest: {
    min: {
      value: { type: Number },
      unit: { type: String, default: "cm" }
    },
    max: {
      value: { type: Number },
      unit: { type: String, default: "cm" }
    }
  },

  running: {
    male: {
      distance: {
        value: { type: Number },
        unit: { type: String, default: "km" }
      },
      time: {
        value: { type: Number },
        unit: { type: String, default: "min" }
      }
    },
    female: {
      distance: {
        value: { type: Number },
        unit: { type: String, default: "km" }
      },
      time: {
        value: { type: Number },
        unit: { type: String, default: "min" }
      }
    }
  },

  events: [
    {
      name: { type: String }, // "High Jump", "Gola Fek"
      type: {
        type: String,
        enum: ["HEIGHT", "DISTANCE", "WEIGHT_DISTANCE"]
      },

      male: {
        value: { type: Number },
        unit: { type: String },       // "feet", "meter", "kg"
        additional: { type: String }  // "16 Pound Ball"
      },

      female: {
        value: { type: Number },
        unit: { type: String },
        additional: { type: String }
      }
    }
  ]
},



    /* =========================
       ⚙️ SELECTION PROCESS
    ========================== */
    selectionProcess: [
      {
        stage: String, // CBT / PET / Interview
        description: String,
        qualifying: { type: Boolean, default: true },
      },
    ],

    /* =========================
       💰 APPLICATION FEES
    ========================== */
    applicationFee: [
      {
        category: String, // GEN / OBC / SC / Female
        amount: Number,
        refundable: { type: Boolean, default: false },
      },
    ],

    /* =========================
       🗓️ IMPORTANT DATES New Important Date 
    ========================== */
 importantDates: {

  shortNoticeDate: { type: Date },
  detailedNoticeDate: { type: Date },

  applyStart: {
    date: { type: Date },
    tentative: { type: Boolean, default: false },
    monthYear: { type: String }, // "March 2026"
  },

  applyEnd: {
    date: { type: Date },
    tentative: { type: Boolean, default: false },
    monthYear: { type: String }, // "April 2026"
  },

  feeLastDate: {
    date: { type: Date },
    tentative: { type: Boolean, default: false },
    monthYear: { type: String }, // ➕ ADDED
  },

  correctionWindow: {
    start: { type: Date },
    startMonthYear: { type: String }, // ➕ ADDED
    end: { type: Date },
    endMonthYear: { type: String },   // ➕ ADDED
    tentative: { type: Boolean, default: false },
  },

  examDate: {
    date: { type: Date },
    tentative: { type: Boolean, default: false },
    monthYear: { type: String }, // ➕ ADDED — "May 2026"
    note: { type: String },      // "Phase 1 – June 2026"
  },

  admitCardDate: {
    date: { type: Date },
    tentative: { type: Boolean, default: false },
    monthYear: { type: String }, // ➕ ADDED
  },

  resultDate: {
    date: { type: Date },
    tentative: { type: Boolean, default: false },
    monthYear: { type: String }, // ➕ ADDED
  },

},
    /* =========================
       🔗 LINKS
    ========================== */
    links: {
      notification: String,
      applyOnline: String,
      syllabus: String,
      officialWebsite: String,
    },

    /* =========================
       🔍 SEARCH & AI OPTIMIZATION
    ========================== */
    tags: [String], // "10th Pass", "Police", "SSC"
    searchKeywords: {
      type: [String],
      index: true,
    },
  },
  { timestamps: true }
);

JobsSchema.index({
  title: "text",
  jobCode: 1,
  jobDomains: 1,
  "eligibility.education.level": 1,
  "eligibility.rules.appliesTo": 1,
  tags: 1
});





const JobsSchemaDatas = mongoose.model("jobs", JobsSchema)





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
        type: [String], 
        // examples: ["10th", "12th", "graduate", "diploma", "bachelor", "master"]
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
      // ["Uttar Pradesh", "Delhi", "All India"]
      default: ["All India"],
      index: true,
    },

    // 👤 CATEGORY (maps to vacancies.breakup.category)
    category: {
      type: String,
      enum: ["gen", "obc", "sc", "st", "ews"],
      lowercase: true,
      index: true,
    },

    // 🚻 GENDER (maps to eligibility.gender)
    gender: {
      type: String,
      enum: ["male", "female", "any"],
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
    // Maps to job's selectionProcess[].stage  →  CBT / PET / Interview
    // "written"   → prefers written/CBT-only jobs  (SSC, Banking, Railway Clerk)
    // "pet"       → prefers physical-test jobs     (Police, Defence, Constable)
    // "interview" → prefers interview-based jobs   (UPSC, Teaching, PSU Officers)
    // "any"       → no preference
    selectionPreference: {
      type: String,
      enum: ["any", "written", "pet", "interview"],
      default: "any",
    },

  },
  { timestamps: true }
);

const UserprefrenceData = mongoose.model("userpreferences", UserPreferenceSchema);


// Exam Calendar Schema
const ExamCalendarSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ["SSC", "Railway", "Banking", "UPSC", "State", "Defence", "Police", "Teaching", "PSU", "Medical"],
    },
    phase: {
      type: String,
      required: true,
      enum: ["application", "lastDate", "admitCard", "exam", "result"],
    },
    date: { type: Date, required: true },
    description: { type: String },
    officialLink: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ExamCalendarSchema.index({ date: 1, category: 1 });

const ExamCalendarData = mongoose.model("examcalendar", ExamCalendarSchema);


// Saved / Bookmarked Jobs Schema
const SavedJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "accounts", required: true },
    jobId:  { type: mongoose.Schema.Types.ObjectId, ref: "jobs",     required: true },
  },
  { timestamps: true }
);
SavedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });
const SavedJobData = mongoose.model("savedjobs", SavedJobSchema);


module.exports = {
  AnnouncementData,
  JobsSchemaDatas,
  AdmitCardData,
  ResultCardData,
  UserSignupSchemaDatas,
  UserprefrenceData,
  ExamCalendarData,
  SavedJobData,
};
