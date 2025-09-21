const express = require("express");
const { getUsers, getJobs, UserSignup, _getAnnouncement, getJobById, getAdmitCard, getResultCard } = require('../controller/webController');

const router = express.Router();

// Routes connected to controller
router.get("/web/api/getUsers", getUsers);
router.get("/web/api/getJobs", getJobs);
router.get("/web/api/getJobs/:id", getJobById);  
router.get("/web/api/getadmitcards",getAdmitCard);
router.get("/web/api/getresultcards", getResultCard)


router.post("/web/api/signup", UserSignup)
router.get("/web/api/announcement", _getAnnouncement)
 

module.exports = router; 
