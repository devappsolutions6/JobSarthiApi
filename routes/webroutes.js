const express = require("express");
const {
  getJobs,
  _getAnnouncement,
  getJobById,
  getAdmitCard,
  getResultCard,
  logutController,
  getHomePageJobs,
  JobCategoryController,
  getExamCalendar,
  addExamCalendar,
  searchJobs,
} = require("../controller/webController");

const { signupLimiter, loginLimiter, forgotPasswordLimiter } = require("../middleware/rateLimiter");
const {
  verifyOtpController,
  resendOtpController,
} = require("../controller/verifyEmailController");

const authMiddleware = require("../middleware/auth");
const {
  userSignupController,
  userLoginController,
} = require("../controller/authController");
const {
  forgotPasswordController,
  verifyResetOtpController,
  resetPasswordController,
} = require("../controller/forgotPasswordController");
const {
  profileController,
  Savepreferences,
  GetSaveData,
  recommendJobsController,
} = require("../controller/userController");

const router = express.Router();

// ------------------------------
// Public Routes (No Auth)
// ------------------------------
router.get("/search", searchJobs);
router.get("/getJobs", getJobs);
router.get("/hompageJobs", getHomePageJobs);
router.get("/getJobs/:id", getJobById);
router.get("/getadmitcards", getAdmitCard);
router.get("/getresultcards", getResultCard);
router.get("/announcement", _getAnnouncement);
router.get("/logout", logutController);
router.get("/Jobs-category/:type", JobCategoryController);
router.get("/exam-calendar", getExamCalendar);
router.post("/admin/exam-calendar", addExamCalendar);

// ------------------------------
// Auth Related Routes
// ------------------------------
router.post("/userSignup", signupLimiter, userSignupController);
router.post("/verify-otp", verifyOtpController);
router.post("/resend-otp", resendOtpController);
router.post("/login", loginLimiter, userLoginController);
router.post("/forgot-password", forgotPasswordLimiter, forgotPasswordController);
router.post("/verify-reset-otp", verifyResetOtpController);
router.post("/reset-password", resetPasswordController);

// ------------------------------
// Protected Routes (Need Auth)
// ------------------------------
router.get("/user/profile", authMiddleware, profileController);
router.post("/user/save-preferences", authMiddleware, Savepreferences);
router.get("/getUserData", authMiddleware, GetSaveData);
router.get("/user/preferencesJobs", authMiddleware, recommendJobsController);

module.exports = router;
