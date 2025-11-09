const express = require("express");
const { getUsers, getJobs, UserSignup, YourJobsController, _getAnnouncement, getJobById, getAdmitCard, getResultCard, FilterJobsController, UserSingnupController, userSignupController, userLoginController } = require('../controller/webController');
const { verifyEmailController } = require("../controller/verifyEmailController");


const router = express.Router();

// Routes connected to controller
router.get("/web/api/getUsers", getUsers);
router.get("/web/api/getJobs", getJobs);
router.get("/web/api/getJobs/:id", getJobById);  
router.get("/web/api/getadmitcards",getAdmitCard);
router.get("/web/api/getresultcards", getResultCard)


router.post("/web/api/signup", UserSignup)
router.get("/web/api/announcement", _getAnnouncement)

router.post("/web/api/userjobsDetails", YourJobsController)

router.get("/web/api/getFilterJobs", FilterJobsController)


const { signupLimiter, loginLimiter } = require('../middleware/rateLimiter');
router.post("/web/api/userSignup", signupLimiter, userSignupController);
router.post("/web/api/login", loginLimiter, userLoginController);
router.get("/web/api/verify-email", verifyEmailController);
 

module.exports = router; 
