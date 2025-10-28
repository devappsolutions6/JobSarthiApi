const { response } = require("express");
const { UserData, JobsSchemaDatas, AdmitCardData, ResultCardData, YourJobsSchemaDatas, FilterJobsSchema, UserSignupSchemaDatas } = require("../models/webmodel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");





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

const getJobById = async (req, res) => {
  try {
    const { id } = req.params;   
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




// Your Jobs

const YourJobsController = async (req, res) => {
  try {
    const { userId, education, DoB } = req.body;

   
    const UserExist = await YourJobsSchemaDatas.findOne({ userId });

    if (UserExist) {
      return res.status(200).json({
        message: "User has already submitted data",
      });
    }

   
    const myData = await YourJobsSchemaDatas.create({
      userId,
      education,
      DoB,
    });

    return res.status(201).json({
      message: "Data is inserted successfully",
      insertedId: myData._id,
    });
  } catch (err) {
    res.status(500).json({
      message: "Something went wrong",
      error: err.message,
    });
  }
};



//Filter Jobs For The users


const FilterJobsController = async (req, res)=>{
  try{
    const UserData = await YourJobsSchemaDatas.find();

   
    const JobsData = await JobsSchemaDatas.find()




    console.log(JobsData)

    res.json({
      message: 'Data fetch sucessfully',
      data: JobsData
    })

    

  }
  catch(err){
    return res.send('Not Get the data ', err)
  }
}


// user Singnup Api




 const userSignupController = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await UserSignupSchemaDatas.findOne({ Email: email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create verification token
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1d" });

    const newUser = new UserSignupSchemaDatas({
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      Password: hashedPassword,
      verificationToken,
    });

    await newUser.save();

    // Send verification email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your gmail
        pass: process.env.EMAIL_PASS, // app password
      },
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify?token=${verificationToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify Your Email - StudyLoom",
      html: `
        <h3>Hello ${firstName},</h3>
        <p>Thank you for registering! Please verify your email by clicking the link below:</p>
        <a href="${verifyUrl}" target="_blank" style="color:#1a73e8">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: "Account created successfull.. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};






module.exports = {
  YourJobsController, 
  getUsers,
  getJobs,
  getJobById,
  UserSignup,
  _getAnnouncement,
  getAdmitCard,
  getResultCard,
  FilterJobsController,
  userSignupController

};


