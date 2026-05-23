const mongoose = require("mongoose");
const { SELECTION_PREFERENCES, EDUCATION_LEVEL_CODES } = require("../utils/educationHelper");


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
 
  education: {
    levels: { type: [{ type: String, enum: EDUCATION_LEVEL_CODES }], default: [] },
    stream: { type: [String], default: [] },
    specialization: { type: [String], default: [] },
  },
  preferredLocations: { type: [String], default: ["all india"] },
  category: { type: String, lowercase: true },
  gender: { type: String, default: "any", lowercase: true },
  organizationTypes: { type: [String], default: [] },
  interests: { type: [String], default: [] },
  dob: { type: Date },
  selectionPreference: { type: String, enum: SELECTION_PREFERENCES, default: "any" },
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
