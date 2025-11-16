const express = require("express");
const {
  getJobs,
  _getAnnouncement,
  getJobById,
  getAdmitCard,
  getResultCard,
  userSignupController,
  userLoginController,
  logutController,
  Savepreferences,
  recommendJobsController,
  getHomePageJobs,
  GetSaveData,
  profileController,
} = require("../controller/webController");

const { signupLimiter, loginLimiter } = require("../middleware/rateLimiter");
const { verifyEmailController } = require("../controller/verifyEmailController");

const authMiddleware = require("../middleware/auth");

const router = express.Router();


// ------------------------------
// Public Routes (No Auth)
// ------------------------------
router.get("/getJobs", getJobs);
router.get("/hompageJobs", getHomePageJobs);
router.get("/getJobs/:id", getJobById);
router.get("/getadmitcards", getAdmitCard);
router.get("/getresultcards", getResultCard);
router.get("/announcement", _getAnnouncement);
router.get("/logout", logutController);


// ------------------------------
// Auth Related Routes
// ------------------------------
router.post("/userSignup", signupLimiter, userSignupController);
router.get("/verify-email", verifyEmailController);
router.post("/login", loginLimiter, userLoginController);


// ------------------------------
// Protected Routes (Need Auth)
// ------------------------------
router.get("/user/profile", authMiddleware, profileController);
router.post("/user/save-preferences", authMiddleware, Savepreferences);
router.get("/getUserData", authMiddleware, GetSaveData);
router.get("/user/preferencesJobs", authMiddleware, recommendJobsController);

module.exports = router;
