const { UserprefrenceData, JobsSchemaDatas, SavedJobData } = require("../models/webmodel");




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





// Education rank: higher rank means higher qualification
// A user with higher education is also eligible for lower-level jobs
const educationRank = {
  "10th": 1,
  "12th": 2,
  "diploma": 3,
  "graduate": 4,
  "postgraduate": 5,
};

const recommendJobsController = async (req, res) => {
  try {
    const userId = req.user._id;

    const userPref = await UserprefrenceData.findOne({ userId });
    if (!userPref) {
      return res.status(404).json({
        status: "error",
        message: "User preferences not found. Please set your preferences first.",
      });
    }

    const {
      education = {},
      preferredLocations = [],
      organizationTypes = [],
      interests = [],
    } = userPref;

    // Normalize all user inputs to lowercase
    const educationLevels = (education.levels || []).map(l => l.toLowerCase());
    const educationStreams = (education.stream || []).map(s => s.toLowerCase());
    const normalizedLocations = preferredLocations.map(l => l.toLowerCase());
    const normalizedOrgTypes = organizationTypes.map(o => o.toLowerCase());
    const normalizedInterests = interests.map(i => i.toLowerCase());

    // Cascade education: a graduate is also eligible for 12th/10th/diploma jobs
    const userMaxEduRank = educationLevels.reduce(
      (max, lvl) => Math.max(max, educationRank[lvl] || 0),
      0
    );
    const eligibleEduLevels =
      userMaxEduRank > 0
        ? Object.keys(educationRank).filter(k => educationRank[k] <= userMaxEduRank)
        : educationLevels;

    // If user selected "All India" (or no location), all job locations match
    const wantsAllIndia =
      normalizedLocations.length === 0 ||
      normalizedLocations.includes("all india");

    const today = new Date();

    // Build location match expression for the aggregation pipeline
    const locationMatchExpr = wantsAllIndia
      ? { $literal: true }
      : {
          $cond: [
            {
              $or: [
                { $eq: [{ $toLower: "$location" }, "all india"] },
                { $in: [{ $toLower: "$location" }, normalizedLocations] },
              ],
            },
            true,
            false,
          ],
        };

    // Build education level match expression
    const eduLevelMatchExpr =
      eligibleEduLevels.length > 0
        ? {
            $gt: [
              {
                $size: {
                  $setIntersection: [
                    {
                      $map: {
                        input: { $ifNull: ["$eligibility.education", []] },
                        as: "e",
                        in: { $toLower: { $ifNull: ["$$e.level", ""] } },
                      },
                    },
                    eligibleEduLevels,
                  ],
                },
              },
              0,
            ],
          }
        : { $literal: false };

    // Build education stream match expression (bonus points)
    const eduStreamMatchExpr =
      educationStreams.length > 0
        ? {
            $gt: [
              {
                $size: {
                  $setIntersection: [
                    {
                      $map: {
                        input: { $ifNull: ["$eligibility.education", []] },
                        as: "e",
                        in: { $toLower: { $ifNull: ["$$e.stream", ""] } },
                      },
                    },
                    educationStreams,
                  ],
                },
              },
              0,
            ],
          }
        : { $literal: false };

    // Sentinel array used when user has no preference — prevents false matches
    const NO_MATCH = ["__no_match__"];

    const jobs = await JobsSchemaDatas.aggregate([
      // 1. Active jobs only + filter out expired applications
      {
        $match: {
          isActive: true,
          $or: [
            { "importantDates.applyEnd": { $gte: today } },
            { "importantDates.applyEnd": { $exists: false } },
            { "importantDates.applyEnd": null },
          ],
        },
      },

      // 2. Compute individual match signals
      {
        $addFields: {
          // Education level match (cascading — graduate can see 12th jobs too)
          eduLevelMatch: eduLevelMatchExpr,

          // Education stream match (bonus)
          eduStreamMatch: eduStreamMatchExpr,

          // Location match
          locationMatch: locationMatchExpr,

          // Org type: count how many of user's org types match job domains/tags
          orgMatchCount: {
            $size: {
              $setIntersection: [
                {
                  $map: {
                    input: {
                      $concatArrays: [
                        { $ifNull: ["$jobDomains", []] },
                        { $ifNull: ["$tags", []] },
                        [{ $ifNull: ["$conductingBody", ""] }],
                        [{ $ifNull: ["$department", ""] }],
                      ],
                    },
                    as: "o",
                    in: { $toLower: "$$o" },
                  },
                },
                normalizedOrgTypes.length > 0 ? normalizedOrgTypes : NO_MATCH,
              ],
            },
          },

          // Interest: count matches across tags AND searchKeywords
          interestMatchCount: {
            $size: {
              $setIntersection: [
                {
                  $map: {
                    input: {
                      $concatArrays: [
                        { $ifNull: ["$tags", []] },
                        { $ifNull: ["$searchKeywords", []] },
                      ],
                    },
                    as: "t",
                    in: { $toLower: "$$t" },
                  },
                },
                normalizedInterests.length > 0 ? normalizedInterests : NO_MATCH,
              ],
            },
          },
        },
      },

      // 3. Calculate final match score (max 110 pts)
      //    Education level  : 30 pts
      //    Education stream : 10 pts (bonus)
      //    Location         : 20 pts
      //    Org type         :  8 pts per match, capped at 25
      //    Interests        :  5 pts per match, capped at 25
      {
        $addFields: {
          matchScore: {
            $add: [
              { $cond: ["$eduLevelMatch", 30, 0] },
              { $cond: ["$eduStreamMatch", 10, 0] },
              { $cond: ["$locationMatch", 20, 0] },
              { $min: [{ $multiply: ["$orgMatchCount", 8] }, 25] },
              { $min: [{ $multiply: ["$interestMatchCount", 5] }, 25] },
            ],
          },
        },
      },

      // 4. At least one signal must match (score >= 20)
      {
        $match: { matchScore: { $gte: 20 } },
      },

      // 5. Best match first; among ties, soonest-closing jobs come first
      {
        $sort: { matchScore: -1, "importantDates.applyEnd": 1, updatedAt: -1 },
      },

      // 6. Limit results
      { $limit: 30 },

      // 7. Response shape
      {
        $project: {
          _id: 1,
          title: 1,
          conductingBody: 1,
          location: 1,
          jobDomains: 1,
          "vacancies.total": 1,
          "importantDates.applyStart": 1,
          "importantDates.applyEnd": 1,
          matchScore: 1,
        },
      },
    ]);

    return res.status(200).json({
      status: "success",
      count: jobs.length,
      data: jobs,
    });

  } catch (error) {
    console.error("Recommendation Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to recommend jobs",
      error: error.message,
    });
  }
};









/* ────────────────────────────────────────────
   BOOKMARK CONTROLLERS
──────────────────────────────────────────── */

// POST /user/bookmark/:jobId  → toggle (save / unsave)
const toggleBookmark = async (req, res) => {
  try {
    const userId = req.user._id;
    const { jobId } = req.params;

    const existing = await SavedJobData.findOne({ userId, jobId });
    if (existing) {
      await SavedJobData.deleteOne({ userId, jobId });
      return res.json({ bookmarked: false, message: "Job removed from bookmarks" });
    }

    await SavedJobData.create({ userId, jobId });
    return res.json({ bookmarked: true, message: "Job saved to bookmarks" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to toggle bookmark", details: error.message });
  }
};

// GET /user/bookmark/:jobId  → check if bookmarked
const checkBookmark = async (req, res) => {
  try {
    const userId = req.user._id;
    const { jobId } = req.params;
    const exists = await SavedJobData.findOne({ userId, jobId });
    return res.json({ bookmarked: !!exists });
  } catch (error) {
    return res.status(500).json({ error: "Failed to check bookmark", details: error.message });
  }
};

// GET /user/bookmarks  → get all saved jobs with basic details
const getBookmarks = async (req, res) => {
  try {
    const userId = req.user._id;
    const saved = await SavedJobData.find({ userId })
      .populate(
        "jobId",
        "title conductingBody department jobDomains location vacancies importantDates isActive updatedAt"
      )
      .sort({ createdAt: -1 });

    const data = saved.map((s) => s.jobId).filter(Boolean);
    return res.json({ data });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch bookmarks", details: error.message });
  }
};


module.exports = {
  profileController,
  Savepreferences,
  GetSaveData,
  recommendJobsController,
  toggleBookmark,
  checkBookmark,
  getBookmarks,
}