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
  category: { type: String }
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
  FirstName: { type: String, required: true },
  LastName: { type: String},
  Email: { type: String, required: true, unique: true },
  Password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
});
 

const UserSignupSchemaDatas = mongoose.model("accounts", UserSignupSchema);




//Jobs Schemasss
const JobsSchema = new mongoose.Schema(
  {
    /* =========================
       🔹 BASIC JOB INFORMATION
    ========================== */
    title: { type: String, required: true, index: true }, 
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
          level: String, // Post / Cadre / Force / Class
          name: String, // Constable GD / PGT / IMA

          categoryWise: {
            gen: Number,
            obc: Number,
            sc: Number,
            st: Number,
            ews: Number,
            female: Number,
            other: Number,
          },

          genderWise: {
            male: Number,
            female: Number,
          },
        },
      ],
    },

    /* =========================
       📚 ELIGIBILITY CRITERIA
    ========================== */
   eligibility: {
  experience: {
    required: Boolean,
    details: String
  },

  // ✅ SIMPLE jobs (SSC, Police, Clerk, etc.)
  education: [
    {
      level: String,
      stream: String,
      specialization: String,
      minMarks: Number,
      required: Boolean
    }
  ],

  additionalQualifications: [String],

  // ✅ COMPLEX jobs (Teaching / Defence / UPSC)
  rules: [
    {
      appliesTo: String, // "Primary Teacher (Class 1–5)"
      minAge: Number,
      maxAge: Number,

      requiredTET: [String], // CTET / STET Paper I / II

      qualifications: [
        String // OR-based human readable rules
      ]
    }
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
       🗓️ IMPORTANT DATES
    ========================== */
    importantDates: {
      applyStart: Date,
      applyEnd: Date,
      feeLastDate: Date,
      correctionWindow: String,
      examDate: Date,
      admitCardDate: Date,
      resultDate: Date,
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



// user prefrence schema 



const UserPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "accounts",
    required: true,
    index: true,
  },

  // 🎓 EDUCATION (matching with eligibility.education.level)
  educationLevel: {
    type: String,
    enum: [
      "10th Pass",
      "12th Pass",
      "ITI",
      "Diploma",
      "Graduate",
      "Post Graduate",
      "B.Tech",
      "M.Tech",
      "MBBS",
      "Other",
    ],
  },

  // match with eligibility.education.stream
  educationStream: { type: String },

  // match with eligibility.education.specialization
  specialization: { type: String },

  // 🌍 LOCATION (matching with job.location)
  preferredState: {
    type: String,
    default: "All India",
  },

  // 👤 CATEGORY (matching eligibility.allowedCategories)
  category: {
    type: String,
    enum: ["GEN", "OBC", "SC", "ST", "EWS", "Female"],
    default: "GEN",
  },

  // 🚻 gender match with preferences.preferredGender
  gender: {
    type: String,
    enum: ["Male", "Female", "Any"],
    default: "Any",
  },

  // 🏛️ Job Type
  organizationType: {
    type: String,
    enum: [
      "Central Government",
      "State Government",
      "Defence",
      "Railway",
      "Banking",
      "PSU",
      "Police",
      "Teaching",
      "Engineering",
      "Medical",
      "Other",
    ],
  },

  

  // 🔍 Meta tags matching (Police, Banking, SSC ...)
  interests: {
    type: [String],
    default: [],
    index: true,
  }, // match with job.metaTags & job.searchKeywords

}, { timestamps: true });





const UserprefrenceData = mongoose.model("userPreferences", UserPreferenceSchema);





// Get the jobs according tho the user data 








module.exports = { 
 
  AnnouncementData, 
  JobsSchemaDatas,
   AdmitCardData,
   ResultCardData
   ,UserSignupSchemaDatas,
   UserprefrenceData


};
