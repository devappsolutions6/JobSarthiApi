const { response } = require("express");
const { UserData, JobsSchemaDatas, AdmitCardData, ResultCardData } = require("../models/webmodel");


//  Get all Users
const getUsers = async (req, res) => {
  try {
    const users = await SignupData.find(); 
    res.json({
      message: "All Users list",
      data: users
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching users" });
  }
};




const UserSignup = async (req, res) => {
  try {
    const newUserData = new SignupData({
      Name: req.body.Name,
      Email: req.body.Email,
      Mobile: req.body.Mobile  
    });

    await newUserData.save();

    res.json({
      message: "Data saved Successfully",
      data: newUserData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error saving data",
      details: err.message
    });
  }
};





// getAnnouncementData
const _getAnnouncement = async (req, res) => {
  try {
    const JobsData = await JobsSchemaDatas.find()
      .sort({ startDate: -1 })
      .limit(4)
      .select('title');

    const AdmitCardDataofJobs = await AdmitCardData.find()
      .sort({ releaseDate: -1 })
      .limit(4)
      .select('title');

    const ResultDataofJobs = await ResultCardData.find()
      .sort({ resultDate: -1 }) 
      .limit(4)
      .select('title');

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
    res.status(500).json({ error: "Error fetching jobs", details: error.message }); 
  }
};



// 2. Single Job by ID
//
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;   // yaha _id aa raha hai
    console.log("Fetching job by _id:", id);

    const job = await JobsSchemaDatas.findById(id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json({ message: "Single job fetched", data: job });
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "Error fetching job", details: error.message });
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


const getResultCard = async (req, res)=>{
  try{
  const result = await ResultCardData.find();
  res.json({
    message: "All Result Data",
    data: result
  })
  }
  catch(err){
    res.status(500).json({erro: err.message})
  }
}



module.exports = {
  getUsers,
  getJobs,
  getJobById,
  UserSignup,
  _getAnnouncement,
  getAdmitCard,
  getResultCard,
};


