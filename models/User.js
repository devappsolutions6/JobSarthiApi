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

module.exports = mongoose.model("accounts", UserSignupSchema);
