const mongoose = require("mongoose");
const { SELECTION_PREFERENCES, EDUCATION_LEVEL_CODES } = require("../utils/educationHelper");


const {
  LOCATION_CODES, STREAM_CODES, GENDER_CODES, CATEGORY_CODES,
  MARITAL_STATUS_CODES, PWD_CATEGORIES, NCC_CERTIFICATES, EXPERIENCE_STATUS
} = require("../utils/constants");

const UserSignupSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpiry: { type: Date },
  resetOtp: { type: String },
  resetOtpExpiry: { type: Date },
  refreshToken: { type: String },
  googleId: { type: String },
  avatar: { type: String },
 
  // Education using standard LEVEL CODES from helper and STREAM CODES from constants
  education: {
    levels: { type: [{ type: String, enum: EDUCATION_LEVEL_CODES }], default: [] },
    streamCodes: { type: [{ type: String, enum: STREAM_CODES }], default: [] },
    percentage: { type: Number, min: 0, max: 100, default: null },
    isFinalYearStudent: { type: Boolean, default: false }
  },
  
  // High-Speed Enums
  preferredLocations: { type: [{ type: String, enum: LOCATION_CODES, uppercase: true }], default: ["ALL_INDIA"] },
  domicileState: { type: String, enum: LOCATION_CODES, default: "ALL_INDIA", uppercase: true },
  category: { type: String, enum: CATEGORY_CODES, uppercase: true },
  gender: { type: String, enum: GENDER_CODES, default: "ANY", uppercase: true },
  maritalStatus: { type: String, enum: MARITAL_STATUS_CODES, default: "UNMARRIED", uppercase: true },
  
  // Specific Govt Quotas & Relaxations
  isPwD: { type: Boolean, default: false },
  pwdCategory: { type: String, enum: PWD_CATEGORIES, default: "NONE", uppercase: true },
  isExServiceman: { type: Boolean, default: false },
  yearsOfService: { type: Number, default: 0 },
  isDepartmentalCandidate: { type: Boolean, default: false }, // Govt Employee
  isSportsperson: { type: Boolean, default: false },
  nccCertificate: { type: String, enum: NCC_CERTIFICATES, default: "NONE", uppercase: true },
  
  // UPSC Attempt Limiter
  pastUPSCAttempts: { type: Number, default: 0 },

  // Tech / Physical Skills
  hasTypingSkill: { type: Boolean, default: false },
  hasShorthandSkill: { type: Boolean, default: false },
  
  // Experience Status
  experienceStatus: { type: String, enum: EXPERIENCE_STATUS, default: "FRESHER", uppercase: true },
  
  // Flexible Arrays for UI mapping
  organizationTypes: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  dob: { type: Date },
  selectionPreference: { type: String, enum: SELECTION_PREFERENCES, default: "any" },
  lastLocation: {
    ip: String,
    city: String,
    region: String,
    country: String,
    lat: Number,
    lon: Number,
    isp: String,
    updatedAt: Date
  }
}, { timestamps: true });

/* ==========================================================
   🧹 AUTH USER CACHE INVALIDATION HOOKS
   ========================================================== */

const invalidateUserCache = async function(doc) {
  try {
    const { clearCache, clearCachePattern } = require("../utils/cache");
    
    // Scenario A: We have a valid user document instance (e.g. from save, remove, findOneAndUpdate, findOneAndDelete)
    const isDoc = doc && (doc._id || doc.id) && (doc.email || doc.Email);
    if (isDoc) {
      const docId = doc._id || doc.id;
      if (docId) {
        await clearCache(`user_auth_${docId}`);
      }
      const email = doc.email || doc.Email;
      if (email) {
        await clearCache(`user_auth_email_${email.toLowerCase()}`);
      }
      return;
    }

    // Scenario B: We are in a query context (updateOne, updateMany, deleteOne, deleteMany)
    // where `this` is the Query object.
    if (this && typeof this.getQuery === "function") {
      const query = this.getQuery();
      if (query) {
        let cleared = false;
        if (query._id) {
          await clearCache(`user_auth_${query._id}`);
          cleared = true;
        }
        if (query.email) {
          await clearCache(`user_auth_email_${query.email.toLowerCase()}`);
          cleared = true;
        }
        if (query.Email) {
          await clearCache(`user_auth_email_${query.Email.toLowerCase()}`);
          cleared = true;
        }
        if (cleared) return; // Successfully invalidated specific user cache
      }
    }

    // Scenario C: Generic fallback (only if no specific user info can be extracted)
    await clearCachePattern("user_auth_*");
    await clearCachePattern("user_auth_email_*");
  } catch (err) {
    console.error("⚠️ [Cache] Failed to invalidate user cache:", err.message);
  }
};

// Post hooks for single document save/remove
UserSignupSchema.post("save", invalidateUserCache);
UserSignupSchema.post("remove", invalidateUserCache);

// Post hooks for query updates and deletes
UserSignupSchema.post("updateOne", invalidateUserCache);
UserSignupSchema.post("updateMany", invalidateUserCache);
UserSignupSchema.post("findOneAndUpdate", invalidateUserCache);
UserSignupSchema.post("findOneAndDelete", invalidateUserCache);
UserSignupSchema.post("deleteOne", invalidateUserCache);
UserSignupSchema.post("deleteMany", invalidateUserCache);

module.exports = mongoose.model("accounts", UserSignupSchema);
