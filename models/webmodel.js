const { application } = require("express");
const mongoose = require("mongoose");

// ✅ User Schema
const userSchema = new mongoose.Schema({
  Name: { type: String, required: true },
  Email: { type: String, required: true },
  Mobile: { type: Number, required: true },
});
const UserData = mongoose.model("users", userSchema);




//  Announcement Schema
const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  status: { type: String, required: true }, 
  link: { type: String, required: true },
  orderNo:{type:Number, require: true},
  isActive: { type: Boolean, default: true },
}, { timestamps: true });


const AnnouncementData = mongoose.model("announcement", announcementSchema);



//AdmitCard Schema


const AdmitCardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  releaseDate: { type: Date },
  examDate: { type: Date },
  category: { type: String }
});

const AdmitCardData = mongoose.model("AdmitCard", AdmitCardSchema);




//Result Schena

const ResultSchema = new mongoose.Schema({
  title: {type: String, required: true},
  description:{type: String, },
  ReleaseDate:{type: Date, },
  DownloadLink:{type: String,}
})


const ResultCardData = mongoose.model("result", ResultSchema);

//Jobs Schemasss


const JobsSchema = new mongoose.Schema({
  // Basic Info
  title: { type: String, required: true },                  
  JobId: { type: Number, required: true, unique: true },    
  JobCategory: { type: String, required: true },           
  description: { type: String },                            

  // Vacancy Details
  TotalPost: { type: Number, required: true },              
  vacancies: [
    {
      postName: { type: String, required: true },         
      total: { type: Number, required: true },              
      categoryWise: {
        general: { type: Number, default: 0 },
        obc: { type: Number, default: 0 },
        sc: { type: Number, default: 0 },
        st: { type: Number, default: 0 },
        ews: { type: Number, default: 0 },
        female: { type: Number, default: 0 }
      }
    }
  ],

  // Eligibility
eligibility: [
  {
    postName: { type: String, required: true },
    education: { type: String },
    ageLimit: {
      min: { type: Number },
      max: { type: Number },
      relaxation: { type: String }
    }
  }
],


  // Application Fee
  applicationFee: {
    general: { type: Number, default: 0 },
    obc: { type: Number, default: 0 },
    sc: { type: Number, default: 0 },
    st: { type: Number, default: 0 },
    female: { type: Number, default: 0 }
  },

  // Important Dates
  importantDates: {
    startDate: { type: Date, required: true },             
    endDate: { type: Date },                               
    lastDate: { type: Date, required: true },             
    examDate: { type: Date },                              
    admitCardDate: { type: Date },                       
    resultDate: { type: Date }                           
  },

  // Other Info
  selectionProcess: { type: String },                     
  salary: { type: String },                               
  syllabusLink: { type: String },                         

  // Official Links
  officialNotification: { type: String },                  
  applyOnlineLink: { type: String },                       
  moreDetailsLink: { type: String, required: true },       

}, { timestamps: true });


const JobsSchemaDatas = mongoose.model("jobs", JobsSchema)






module.exports = { UserData, AnnouncementData, JobsSchemaDatas, AdmitCardData, ResultCardData};
