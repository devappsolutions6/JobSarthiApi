const express = require("express");
const {
 
  getJobs,
  _getAnnouncement,
  getJobById,
  getAdmitCard,
  getResultCard,
  userSignupController,
  userLoginController,
  userDataController,
  logutController,
  userPrefrenceController,
  Savepreferences,
} = require("../controller/webController");
const {
  verifyEmailController,
} = require("../controller/verifyEmailController");

const router = express.Router();

// Routes connected to controller

router.get("/web/api/getJobs", getJobs);
router.get("/web/api/getJobs/:id", getJobById);
router.get("/web/api/getadmitcards", getAdmitCard);
router.get("/web/api/getresultcards", getResultCard);


router.get("/web/api/announcement", _getAnnouncement);

const { signupLimiter, loginLimiter } = require("../middleware/rateLimiter");
const authMiddleware = require("../middleware/auth");
const { profileController } = require("../controller/webController");

router.post("/web/api/userSignup", signupLimiter, userSignupController);
router.get("/web/api/verify-email", verifyEmailController);
router.post("/web/api/login", loginLimiter, userLoginController);

router.get("/web/api/user/profile", authMiddleware, profileController);

router.get('/web/api/logout',logutController)

router.post(
  "/web/api/user/save-preferences",
  authMiddleware,
 Savepreferences
);


module.exports = router;
