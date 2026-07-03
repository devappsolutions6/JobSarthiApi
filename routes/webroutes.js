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
  eligibilityCheckController,
} = require("../controller/webController");
const { getRecruitmentPulse } = require("../controller/pulseController");
const { getLatestNews, syncNews } = require("../controller/newsController");



const { signupLimiter, loginLimiter, forgotPasswordLimiter } = require("../middleware/rateLimiter");
const {
  verifyOtpController,
  resendOtpController,
} = require("../controller/verifyEmailController");

const authMiddleware = require("../middleware/auth");
const {
  userSignupController,
  userLoginController,
  refreshTokenController,
  googleLoginController,
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
  toggleBookmark,
  checkBookmark,
  getBookmarks,
  getUserSyllabus,
  toggleSyllabusTopic,
} = require("../controller/userController");
const {
  subscribe,
  unsubscribe,
  testNotification
} = require("../controller/notificationController");

const router = express.Router();

// ------------------------------
// Public Routes (No Auth)
// ------------------------------
router.post("/notifications/subscribe", subscribe);
router.post("/notifications/unsubscribe", unsubscribe);
router.post("/notifications/test-push", testNotification);

router.get("/location/guess", require("../controller/webController").guessLocationController);
router.get("/search", searchJobs);
router.post("/eligibility-check", eligibilityCheckController);
router.get("/pulse", getRecruitmentPulse);
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
router.get("/news", getLatestNews);
router.post("/admin/news/sync", syncNews);



// ------------------------------
// Auth Related Routes
// ------------------------------
router.post("/userSignup", signupLimiter, userSignupController);
router.post("/verify-otp", verifyOtpController);
router.post("/resend-otp", resendOtpController);
router.post("/login", loginLimiter, userLoginController);
router.post("/google-login", googleLoginController);
router.post("/auth/refresh", refreshTokenController);
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

// Bookmark routes
router.post("/user/bookmark/:jobId", authMiddleware, toggleBookmark);
router.get("/user/bookmark/:jobId",  authMiddleware, checkBookmark);
router.get("/user/bookmarks",        authMiddleware, getBookmarks);

// Syllabus Progress routes
router.get("/user/syllabus", authMiddleware, getUserSyllabus);
router.post("/user/syllabus/toggle", authMiddleware, toggleSyllabusTopic);

module.exports = router;
