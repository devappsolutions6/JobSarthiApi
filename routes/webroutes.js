const express = require("express");
const { getUsers, getJobs, UserSignup, _getAnnouncemet, getJobById } = require('../controller/webController');

const router = express.Router();

// Routes connected to controller
router.get("/web/api/getUsers", getUsers);
router.get("/web/api/getJobs", getJobs);
router.get("/web/api/getJobs/:id", getJobById);  


router.post("/web/api/signup", UserSignup)
router.get("/web/api/announcement", _getAnnouncemet)

module.exports = router;
