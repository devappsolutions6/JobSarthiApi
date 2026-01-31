const { response } = require("express");
const {
  UserData,
  JobsSchemaDatas,
  AdmitCardData,
  ResultCardData,
  YourJobsSchemaDatas,

  UserSignupSchemaDatas,
  userDataSchemasDatas,
  UserprefrenceData,
} = require("../models/webmodel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateSignupInput } = require("../utils/validation");
const { sendVerificationEmail } = require("../utils/emailService");





// getAnnouncementData
const _getAnnouncement = async (req, res) => {
  try {
    const JobsData = await JobsSchemaDatas.find()
      .sort({ startDate: -1 })
      .limit(4)
      .select("title");

    const AdmitCardDataofJobs = await AdmitCardData.find()
      .sort({ releaseDate: -1 })
      .limit(4)
      .select("title");

    const ResultDataofJobs = await ResultCardData.find()
      .sort({ resultDate: -1 })
      .limit(4)
      .select("title");

    const AllAnnouncementData = [
      ...JobsData,
      ...AdmitCardDataofJobs,
      ...ResultDataofJobs,
    ];

    res.status(200).json({
      message: "Announcement Data fetched successfully",
      data: AllAnnouncementData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 1. All Jobs
const getJobs = async (req, res) => {
  try {
    const jobs = await JobsSchemaDatas.find();
    res.json({ message: "All jobs fetched", data: jobs });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching jobs", details: error.message });
  }
};

// 2. Single Job by ID

const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
  

    const job = await JobsSchemaDatas.findById(id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json({ message: "Single job fetched", data: job });
  } catch (error) {
    console.error("Error fetching job:", error);
    res
      .status(500)
      .json({ error: "Error fetching job", details: error.message });
  }
};



const getHomePageJobs = async (req, res) => {
  try {
    const JobsData = await JobsSchemaDatas.find(
      {},
    { _id: 1, title: 1, JobId: 1, "vacancies.total":1, 
      "importantDates.applyStart": 1,
      "importantDates.applyEnd":1,
      "conductingBody":1,


}
    );

    res.json({
      message: "Successfully fetched the data",
      data: JobsData,
    });

  } catch (error) {
    res.status(500).json({
      error: "Error fetching jobs",
      details: error.message,
    });
  }
};


const getAdmitCard = async (req, res) => {
  try {
    const admitCards = await AdmitCardData.find();
    res.json({
      message: "All Admit Card Data",
      data: admitCards,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getResultCard = async (req, res) => {
  try {
    const result = await ResultCardData.find();
    res.json({
      message: "All Result Data",
      data: result,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

//logut controller

const logutController = async (req, res) =>{
res.clearCookie("token", {
    httpOnly: true,
    secure: true,       // same as login
    sameSite: "none",   // same as login
    path: "/"           // same as login
  });


  return res.json({ message: "Logged out successfully" });
}


const JobCategoryController = async (req, res) => {
  try {
    const type = req.params.type?.toLowerCase();

     

  
    const jobCollection = await JobsSchemaDatas.aggregate([
      {
        $match: {
          isActive: true,
          jobDomains: type
        }
      },
     {
      $project:{
        vacancies:1,
        importantDates:1,
        conductingBody:1,
        title:1
      }
     }
    ]);

    return res.status(200).json({
      jobType: type,
      total: jobCollection.length,
      jobs: jobCollection
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};






module.exports = {
   getHomePageJobs,
  getJobs,
  getJobById,
  _getAnnouncement,
  getAdmitCard,
  getResultCard,
 
  logutController,
  JobCategoryController,
  
};
