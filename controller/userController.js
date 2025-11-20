const { UserprefrenceData, JobsSchemaDatas } = require("../models/webmodel");




// Get User Profile Details
const profileController = async (req, res) => {
  try {
    // auth middleware should attach user to req.user
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    const safeUser = {
      id: user._id,
      firstName: user.FirstName,
      lastName: user.LastName,
      email: user.Email,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin || null,
    };

    return res.status(200).json({ user: safeUser });
  } catch (err) {
    console.error("Profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Save all data of the user for job prefrence

const Savepreferences = async (req, res) => {
  try {
    // userId comes from authMiddleware using cookies.token
    const userId = req.user._id;

  



    const {
      educationLevel,
      educationStream,
      specialization,
      preferredState,
      category,
      gender,
      organizationType,
      department,
      experience,
      interests
    } = req.body;

    // Validation: At least education or state or category must be filled
    if (!educationLevel && !preferredState && !category) {
      return res.status(400).json({
        status: "error",
        message: "Please provide at least one preference field."
      });
    }

    // Prepare data object
    const preferenceData = {
      userId,
      educationLevel,
      educationStream,
      specialization,
      preferredState,
      category,
      gender,
      organizationType,
      department,
      experience,
      interests
    };

    // Save or Update (upsert)
    const savedPreference = await UserprefrenceData.findOneAndUpdate(
      { userId },
      preferenceData,
      { new: true, upsert: true } // Create if not exists
    );

    return res.status(200).json({
      status: "success",
      message: "User preferences saved successfully.",
      data: savedPreference
    });

  } catch (err) {
    console.error("Preference Error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to save preferences.",
      error: err.message
    });
  }
};

// Get all data of the specific user
const GetSaveData = async (req, res) => {
  try {
    const userId = req.user._id;  
    console.log("User ID:", userId);

    const userData = await UserprefrenceData.find({userId
    });

    return res.json({
      message: "User data fetched successfully",
      data: userData
    });

  } catch (err) {
    return res.json({
      message: err.message || err
    });
  }
};

// Get all Jobs recommend by user

const recommendJobsController = async (req, res) => {
  try {
    const user = req.user;

    const userPrefrence = await UserprefrenceData.findOne({
      userId: user._id
    }).lean();

    if (!userPrefrence) {
      return res.status(404).json({
        status: "error",
        message: "User preferences not found",
      });
    }

    // ------------------------------------------
    // 🔹 Education Rank Map (lowercase keys)
    // ------------------------------------------
    const educationRankMap = {
      "10th pass": 1,
      "12th pass": 2,
      "iti": 2,
      "diploma": 2,
      "graduate": 3,
      "b.tech": 3,
      "post graduate": 4,
      "m.tech": 4,
      "mbbs": 4,
      "other": 1,
    };

    // Normalize user input → lowercase
    const eduLower = userPrefrence.educationLevel.toLowerCase();

    // User education rank
    const userRank = educationRankMap[eduLower];

    // ------------------------------------------
    // ❗ If education not found → default lowest
    // ------------------------------------------
    if (!userRank) {
      console.warn("Unknown education level:", userPrefrence.educationLevel);
    }

    // ------------------------------------------
    // 🔎 FILTER QUERY
    // ------------------------------------------
    const filterQuery = {
      isActive: true,

      "importantDates.lastDate": { $gte: new Date() },

      // LOWER OR EQUAL rank allowed
      "eligibility.education.rank": { $lte: userRank || 1 },

      $or: [
        // Location match
        { location: { $in: [userPrefrence.preferredState, "All India"] } },

        // Org type (case-insensitive)
        {
          organizationType: {
            $regex: new RegExp(userPrefrence.organizationType, "i"),
          },
        },

        // Meta tags match
        { metaTags: { $in: userPrefrence.interests || [] } },

        // Search keywords match
        { searchKeywords: { $in: userPrefrence.interests || [] } },
      ],
    };

    console.log("FILTER APPLIED:", filterQuery);

    // ------------------------------------------
    // 📌 Fetch Jobs
    // ------------------------------------------
    let jobs = await JobsSchemaDatas.find(filterQuery).lean();

    // ------------------------------------------
    // ⭐ AI Scoring System
    // ------------------------------------------
    const rankedJobs = jobs.map((job) => {
      let score = 0;

      // ✔ Education match (case-insensitive)
      if (
        job.eligibility?.some(
          (e) => e.education.level.toLowerCase() === eduLower
        )
      ) {
        score += 25;
      }

      // ✔ State match
      if (job.location === userPrefrence.preferredState) score += 20;

      // ✔ Category match (case-insensitive)
      if (
        job.vacancies?.some((v) =>
          Object.keys(v.categoryWise || {}).includes(
            userPrefrence.category?.toLowerCase()
          )
        )
      ) {
        score += 10;
      }

      // ✔ Gender match
      if (job.preferences?.preferredGender === userPrefrence.gender) score += 10;

      // ✔ Organization type match (case-insensitive)
      if (
        job.organizationType?.toLowerCase() ===
        userPrefrence.organizationType?.toLowerCase()
      ) {
        score += 10;
      }

      // ✔ Interests match
      if (
        userPrefrence.interests?.some(
          (tag) =>
            job.metaTags?.includes(tag) ||
            job.searchKeywords?.includes(tag)
        )
      ) {
        score += 30;
      }

      return { ...job, score };
    });

    // ------------------------------------------
    // 🔥 Sort by score
    // ------------------------------------------
    rankedJobs.sort((a, b) => b.score - a.score);

    const finalJobs = rankedJobs.map((value)=>{
      return{
        importantDates:value.importantDates,
          id: value._id,
            title: value.title,
        JobId: value.JobId,
        organizationType:value.organizationType,
        TotalPost: value.TotalPost,
        score:value.score,
      
        
      }
    })

    // ------------------------------------------
    // 📤 Response
    // ------------------------------------------
    return res.json({
      
      data: finalJobs,
    });
  } catch (err) {
    console.error("Recommendation Error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to process recommendation",
      error: err.message,
    });
  }
};


module.exports ={
    profileController,
    Savepreferences,
    GetSaveData,
    recommendJobsController
}