const { UserprefrenceData, JobsSchemaDatas } = require("../models/webmodel");




// Get User Profile Details
const profileController = async (req, res) => {
  try {
    // auth middleware should attach user to req.user
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    const safeUser = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
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
    const userId = req.user._id;

    const {
      educationLevels = [],
      educationStreams = [],
      specializations = [],
      preferredLocations = ["All India"],
      category,
      gender = "any",
      organizationTypes = [],
      interests = [],
     
    } = req.body;

    //  Minimum data check
    if (
      educationLevels.length === 0 &&
      organizationTypes.length === 0 &&
      interests.length === 0
    ) {
      return res.status(400).json({
        status: "error",
        message: "Please provide at least education, organization type, or interests.",
      });
    }

    const preferencePayload = {
      userId,
      education: {
        levels: educationLevels,
        stream: educationStreams,
        specialization: specializations,
      },
      preferredLocations,
      category,
      gender,
      organizationTypes,
      interests,
    
    };

    const savedPreference = await UserprefrenceData.findOneAndUpdate(
      { userId },
      { $set: preferencePayload },
      { new: true, upsert: true },
    );

    return res.status(200).json({
      status: "success",
      message: "User preferences saved successfully",
      data: savedPreference,
    });

  } catch (error) {
    console.error("SavePreferences Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to save user preferences",
    });
  }
};





// 🚀 RECOMMEND JOBS CONTROLLER

const educationRank = {
  "10th": 1,
  "12th": 2,
  "diploma": 3,
  "graduate": 4,
  "postgraduate": 5,
};


// ===============================
const recommendJobsController = async (req, res) => {
  try {
    const userId = req.user._id;

    const userPref = await UserprefrenceData.findOne({ userId });
    if (!userPref) {
      return res.status(404).json({
        status: "error",
        message: "User preferences not found",
      });
    }

    const {
      preferredLocations = [],
      organizationTypes = [],
      interests = [],
    } = userPref;

    // normalize user inputs
    const normalizedLocations = preferredLocations.map(l => l.toLowerCase());
    const normalizedOrgTypes = organizationTypes.map(o => o.toLowerCase());
    const normalizedInterests = interests.map(i => i.toLowerCase());

    const jobs = await JobsSchemaDatas.aggregate([
      // 1 Active jobs only
      {
        $match: { isActive: true },
      },

      // 2 LOCATION MATCH (SOFT)
      {
        $addFields: {
          locationMatch: {
            $cond: [
              {
                $or: [
                  { $eq: [{ $toLower: "$location" }, "all india"] },
                  { $in: ["central", normalizedLocations] },
                  {
                    $in: [
                      { $toLower: "$location" },
                      normalizedLocations,
                    ],
                  },
                ],
              },
              true,
              false,
            ],
          },
        },
      },

      // 3 ORGANIZATION MATCH (STRONG)
      {
        $addFields: {
          organizationMatch: {
            $gt: [
              {
                $size: {
                  $setIntersection: [
                    {
                      $map: {
                        input: {
                          $concatArrays: [
                            { $ifNull: ["$tags", []] },
                            { $ifNull: ["$jobDomains", []] },
                            [{ $ifNull: ["$conductingBody", ""] }],
                            [{ $ifNull: ["$department", ""] }],
                          ],
                        },
                        as: "o",
                        in: { $toLower: "$$o" },
                      },
                    },
                    normalizedOrgTypes,
                  ],
                },
              },
              0,
            ],
          },
        },
      },

      // 4 INTEREST MATCH
      {
        $addFields: {
          interestMatch: {
            $gt: [
              {
                $size: {
                  $setIntersection: [
                    {
                      $map: {
                        input: { $ifNull: ["$tags", []] },
                        as: "t",
                        in: { $toLower: "$$t" },
                      },
                    },
                    normalizedInterests,
                  ],
                },
              },
              0,
            ],
          },
        },
      },

      // 5️⃣ FINAL SCORE (SOFT SCORING)
      {
        $addFields: {
          matchScore: {
            $add: [
              { $cond: ["$locationMatch", 25, 0] },
              { $cond: ["$organizationMatch", 45, 0] },
              { $cond: ["$interestMatch", 30, 0] },
            ],
          },
        },
      },

      // 6️⃣ MINIMUM SCORE (NOT STRICT)
      {
        $match: {
          matchScore: { $gte: 30 },
        },
      },

      // 7️⃣ SORT BEST MATCH
      {
        $sort: { matchScore: -1, updatedAt: -1 },
      },

      // 8️⃣ LIMIT
      {
        $limit: 20,
      },

      // 9️⃣ RESPONSE SHAPE (ONLY REQUIRED DATA)
      {
        $project: {
          _id: 1,
          title: 1,
          conductingBody: 1,
          "vacancies.total": 1,
          "importantDates.applyStart": 1,
          "importantDates.applyEnd": 1,
        },
      },
    ]);

    return res.status(200).json({
      status: "success",
      count: jobs.length,
      data: jobs,
    });

  } catch (error) {
    console.error("❌ Recommendation Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to recommend jobs",
      error: error.message,
    });
  }
};









module.exports ={
    profileController,
    Savepreferences,
    GetSaveData,
    recommendJobsController
}