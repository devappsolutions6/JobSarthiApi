const {
  UserSignupSchemaDatas,
  JobsSchemaDatas,
  SavedJobData,
  UserRecommendationData,
} = require("../models/webmodel");

const RecommendationService = require("../services/recommendationService");

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
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Not authenticated" });

    return res.json({
      message: "User preferences fetched successfully",
      data: [{
        education: user.education,
        preferredLocations: user.preferredLocations,
        category: user.category,
        gender: user.gender,
        organizationTypes: user.organizationTypes,
        interests: user.interests,
        dob: user.dob,
        selectionPreference: user.selectionPreference,
        updatedAt: user.updatedAt,
      }]
    });

  } catch (err) {
    return res.status(500).json({
      message: err.message || err
    });
  }
};

// Save all data of the user for job preference
const Savepreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const {
      educationLevels = [],
      educationStreams = [],
      specializations = [],
      preferredLocations = ["all india"],
      category,
      gender = "any",
      organizationTypes = [],
      interests = [],
      selectionPreference = "any",
      dob,
    } = req.body;

    // Minimum data check
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

    // Sanitize all free-form token fields to lowercase at write time
    // so the recommendation engine can do direct equality checks with zero runtime normalization.
    const lc = v => (v && typeof v === "string" ? v.toLowerCase().trim() : v);
    const lcArr = arr => (Array.isArray(arr) ? arr.map(lc).filter(Boolean) : []);

    const preferencePayload = {
      education: {
        levels: educationLevels,                 // already standard codes e.g. "EDU_GRAD"
        stream: lcArr(educationStreams),
        specialization: lcArr(specializations),
      },
      preferredLocations: lcArr(preferredLocations),
      category,
      gender,
      organizationTypes: lcArr(organizationTypes),
      interests: lcArr(interests),
      selectionPreference,
      ...(dob ? { dob: new Date(dob) } : {}),
    };

    const updatedUser = await UserSignupSchemaDatas.findByIdAndUpdate(
      userId,
      { $set: preferencePayload },
      { new: true }
    );

    // Asynchronously trigger background recommendation recomputation
    RecommendationService.recomputeUserRecommendations(userId).catch((err) => {
      console.error(`❌ Background recommendation recomputation failed for user ${userId}:`, err);
    });

    return res.status(200).json({
      status: "success",
      message: "User preferences saved successfully",
      data: {
        education: updatedUser.education,
        preferredLocations: updatedUser.preferredLocations,
        category: updatedUser.category,
        gender: updatedUser.gender,
        organizationTypes: updatedUser.organizationTypes,
        interests: updatedUser.interests,
        dob: updatedUser.dob,
        selectionPreference: updatedUser.selectionPreference,
      },
    });

  } catch (error) {
    console.error("SavePreferences Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to save user preferences",
    });
  }
};

// Serve personalized recommendations from fast pre-computed cache collection
const recommendJobsController = async (req, res) => {
  try {
    const contactId = req.user.contactId || req.user.email || req.user._id.toString();

    // Query exactly one overview sheet document for this user (Option A)
    const recSheet = await UserRecommendationData.findOne({ contactId });
    const recommendations = recSheet?.recommendations || [];

    if (recommendations.length === 0) {
      // Check if user has actually provided any info (beyond defaults)
      const { education, interests, organizationTypes } = req.user;
      const hasData = education?.levels?.length > 0 ||
        interests?.length > 0 ||
        organizationTypes?.length > 0;
      if (!hasData) {
        return res.status(200).json({
          status: "success",
          message: "Please set your preferences to get personalized recommendations.",
          data: [],
        });
      }
    }

    // Map cached snaps to standard presentation objects (maintains full frontend compatibility)
    const mappedJobs = recommendations.slice(0, 30).map((job) => ({
      _id: job.jobId,
      title: job.title,
      urlTitle: job.slug,
      conductingBody: job.organization || "",
      location: job.location,
      importantDates: {
        applyEnd: job.applyEnd,
      },
      vacancies: {
        total: job.vacancies?.total || 0,
      },
      relevanceScore: job.score,
    }));

    return res.status(200).json({ status: "success", count: mappedJobs.length, data: mappedJobs });
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
        "title urlTitle conductingBody department jobDomains location vacancies importantDates isActive updatedAt"
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
};