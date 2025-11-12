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



//Jobs Schemasss
const JobsSchema = new mongoose.Schema(
  {
   
    title: { type: String, required: true },
    JobId: { type: Number, required: true, unique: true },
    department: { type: String, required: true }, // "Staff Selection Commission"
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
      required: true,
    },
    description: { type: String },
    location: { type: String, default: "All India" },
    isActive: { type: Boolean, default: true },

    // 🧾 Vacancy Details
    TotalPost: { type: Number, required: true },
    vacancies: [
      {
        postName: { type: String, required: true },
        total: { type: Number, required: true },
        categoryWise: {
          general: { type: Number, default: 0 },
          obc: { type: Number, default: 0 },
          sc: { type: Number, default: 0 },
          st: { type: Number, default: 0 },
          ews: { type: Number, default: 0 },
          female: { type: Number, default: 0 },
        },
      },
    ],

    // 📚 Eligibility (Smart Filtering Basis)
    eligibility: [
      {
        postName: { type: String, required: true },
        education: {
          level: {
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
            required: true,
          },
          stream: { type: String }, // "Science", "Arts", "Commerce", etc.
          specialization: { type: String }, // "Computer Science", "Civil Engg"
        },
        ageLimit: {
          min: { type: Number },
          max: { type: Number },
          relaxation: { type: String }, // "SC/ST +5 yrs, OBC +3 yrs"
        },
        allowedCategories: [
          { type: String, enum: ["GEN", "OBC", "SC", "ST", "EWS", "Female"] },
        ],
        experience: { type: String, default: "Fresher" },
      },
    ],

    // 💰 Application Fee
    applicationFee: {
      general: { type: Number, default: 0 },
      obc: { type: Number, default: 0 },
      sc: { type: Number, default: 0 },
      st: { type: Number, default: 0 },
      female: { type: Number, default: 0 },
    },

    // 🗓️ Important Dates
    importantDates: {
      startDate: { type: Date, required: true },
      endDate: { type: Date },
      lastDate: { type: Date, required: true },
      examDate: { type: Date },
      admitCardDate: { type: Date },
      resultDate: { type: Date },
    },

    // ⚙️ Selection Process & Pay
    selectionProcess: { type: String },
    salary: { type: String },
    syllabusLink: { type: String },

    // 🌐 Official Links
    officialNotification: { type: String },
    applyOnlineLink: { type: String },
    moreDetailsLink: { type: String, required: true },

    // 🧩 Smart Meta Tags for Recommendation
    metaTags: [
      {
        type: String,
        index: true,
      },
    ],
    // Examples: ["12th Pass", "Uttar Pradesh", "Police", "Male", "OBC", "Central Govt", "Defence"]

    // 🔍 AI/Filter Optimization Fields
    searchKeywords: {
      type: [String],
      index: true,
      default: [],
    }, // for full-text or fuzzy search (like "SSC", "Railway", "UP Police")

    // ⭐ User Preference Based Fields
    preferences: {
      preferredGender: { type: String, enum: ["Male", "Female", "Any"], default: "Any" },
      preferredState: { type: String, default: "All India" },
      preferredCategory: { type: String, enum: ["GEN", "OBC", "SC", "ST", "EWS"], default: "GEN" },
      preferredEducation: { type: String },
    },
  },
  { timestamps: true }
);

// 🧠 Text Index for Faster Search (MongoDB optimization)
JobsSchema.index({
  title: "text",
  description: "text",
  "eligibility.education.level": "text",
  metaTags: "text",
  searchKeywords: "text",
});
const JobsSchemaDatas = mongoose.model("jobs", JobsSchema)





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







// all  Data of the user for jobs filtering

const UserDataSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "accounts",
      required: true,
      index: true,
    },

    // 🎓 Education Info
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
    educationStream: { type: String },
    educationSpecialization: { type: String },

    // 🌍 Location & Category Preferences
    preferredState: { type: String, default: "All India" },
    category: {
      type: String,
      enum: ["GEN", "OBC", "SC", "ST", "EWS"],
      default: "GEN",
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Any"],
      default: "Any",
    },

    // 🧾 Job Preferences
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
      default: "Central Government",
    },
    department: { type: String },
    experience: { type: String, default: "Fresher" },

    // 🔍 Smart Tag or Keyword Preferences
    interests: {
      type: [String],
      default: [],
      index: true,
    }, // e.g. ["SSC", "UP Police", "Banking"]

    // Optional future AI optimization fields
    aiProfileScore: { type: Number, default: 0 }, // personalized match score
    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true }
);





const userDataSchemasDatas = mongoose.model("userData", UserDataSchema);






module.exports = { 
 
  AnnouncementData, 
  JobsSchemaDatas,
   AdmitCardData,
   ResultCardData
   ,UserSignupSchemaDatas,
  userDataSchemasDatas
};
