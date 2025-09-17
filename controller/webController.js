const { response } = require("express");
const { UserData, AnnouncementData,JobsSchemaDatas, AdmitCardData, ResultCardData } = require("../models/webmodel");


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





//-getAnouncementData


const _getAnnouncemet  = async(req, res)=>{
  try{
 const AnnouncementDataofJobs = await AnnouncementData.find()

 res.json({
  message: 'Anouncement Data fetched Sucessfully',
  data: AnnouncementDataofJobs
 })
  }catch(err){
    res.json(err)
  }
}





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
// Get Single Job by _id
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
  _getAnnouncemet,
  getAdmitCard,
  getResultCard,
};


