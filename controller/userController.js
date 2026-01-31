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


// ===============================
// 🎯 EDUCATION ORDER (LOW → HIGH)
// ===============================
const EDUCATION_ORDER = [
  "10th",
  "12th",
  "iti",
  "diploma",
  "graduate",
  "post graduate",
];

// ===============================
// 🧠 UTILITY: allowed education
// Graduate → 12th jobs allowed
// ===============================
function getAllowedEducationLevels(userLevels = []) {
  if (!userLevels.length) return [];

  const maxIndex = Math.max(
    ...userLevels.map(l =>
      EDUCATION_ORDER.indexOf(l.toLowerCase())
    )
  );

  if (maxIndex === -1) return [];

  return EDUCATION_ORDER.slice(0, maxIndex + 1);
}

// ===============================
// 🚀 RECOMMEND JOBS CONTROLLER
 recommendJobsController = async (req, res) => {
  try {
    const userId = req.user._id;

    // ----------------------------
    // 1️⃣ FETCH USER PREFERENCE
    // ----------------------------
    const preference = await UserprefrenceData
      .findOne({ userId })
      .lean();

    if (!preference) {
      return res.status(404).json({
        status: "error",
        message: "User preferences not found",
      });
    }

    // ----------------------------
    // 2️⃣ NORMALIZE USER DATA
    // ----------------------------
    const userEducationLevels =
      preference.education?.levels?.map(l => l.toLowerCase()) || [];

    const allowedEducationLevels =
      getAllowedEducationLevels(userEducationLevels);

    const userLocations =
      preference.preferredLocations?.length
        ? preference.preferredLocations
        : ["All India"];

    const userCategory = preference.category; // gen | obc | sc | st | ews
    const userGender = preference.gender || "any";

    const orgTypes =
      preference.organizationTypes?.map(o => o.toLowerCase()) || [];

    const interests =
      preference.interests?.map(i => i.toLowerCase()) || [];

    // ----------------------------
    // 3️⃣ BUILD SAFE FILTER QUERY
    // ----------------------------
    const filterQuery = {
      isActive: true,

      // application not expired
      "importantDates.applyEnd": { $gte: new Date() },

      // EDUCATION (ARRAY SAFE + RANK LOGIC)
      ...(allowedEducationLevels.length && {
        "eligibility.education": {
          $elemMatch: {
            level: { $in: allowedEducationLevels },
          },
        },
      }),

      // LOCATION (OLD + NEW SCHEMA)
      $or: [
        { location: { $in: userLocations } },   // legacy
        { locations: { $in: userLocations } },  // future
      ],

      // JOB DOMAIN (Police / Banking / etc.)
      ...(orgTypes.length && {
        jobDomains: { $in: orgTypes },
      }),

      // INTEREST KEYWORDS
      ...(interests.length && {
        searchKeywords: { $in: interests },
      }),
    };

    // ----------------------------
    // 4️⃣ FETCH JOBS
    // ----------------------------
    const jobs = await JobsSchemaDatas
      .find(filterQuery)
      .lean();

    // ----------------------------
    // 5️⃣ SCORING ENGINE
    // ----------------------------
    const scoredJobs = jobs.map(job => {
      let score = 0;

      // 🎓 EDUCATION SCORE
      if (
        job.eligibility?.education?.some(e =>
          allowedEducationLevels.includes(
            String(e.level).toLowerCase()
          )
        )
      ) {
        score += 30;
      }

      // 🌍 LOCATION SCORE
      if (
        (job.location &&
          userLocations.includes(job.location)) ||
        (job.locations &&
          job.locations.some(l =>
            userLocations.includes(l)
          ))
      ) {
        score += 20;
      }

      // 👤 CATEGORY SCORE
      if (
        userCategory &&
        job.vacancies?.breakup?.some(b =>
          b.categoryWise &&
          Object.keys(b.categoryWise)
            .map(k => k.toLowerCase())
            .includes(userCategory)
        )
      ) {
        score += 10;
      }

      // 🚻 GENDER SCORE
      // (no strict gender filter in DB → allow all)
      score += 10;

      // 🏛 DOMAIN SCORE
      if (
        job.jobDomains?.some(d =>
          orgTypes.includes(
            String(d).toLowerCase()
          )
        )
      ) {
        score += 10;
      }

      // 🔍 INTEREST SCORE
      if (
        interests.some(tag =>
          job.searchKeywords?.some(k =>
            k.toLowerCase().includes(tag)
          )
        )
      ) {
        score += 30;
      }

      return {
        _id: job._id,
        jobCode: job.jobCode,
        title: job.title,
        department: job.department,
        conductingBody: job.conductingBody,
        location: job.location || job.locations,
        totalVacancies: job.vacancies?.total || 0,
        importantDates: job.importantDates,
        score,
      };
    });

    // ----------------------------
    // 6️⃣ SORT & RESPONSE
    // ----------------------------
    scoredJobs.sort((a, b) => b.score - a.score);

    return res.status(200).json({
      status: "success",
      totalMatched: jobs.length,
      recommendedCount: scoredJobs.length,
      data: scoredJobs,
    });

  } catch (err) {
    console.error("❌ Recommendation Error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to recommend jobs",
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