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
        domicileState: user.domicileState || "ALL_INDIA",
        category: user.category,
        gender: user.gender,
        maritalStatus: user.maritalStatus || "UNMARRIED",
        isPwD: user.isPwD || false,
        pwdCategory: user.pwdCategory || "NONE",
        isExServiceman: user.isExServiceman || false,
        yearsOfService: user.yearsOfService || 0,
        isDepartmentalCandidate: user.isDepartmentalCandidate || false,
        isSportsperson: user.isSportsperson || false,
        nccCertificate: user.nccCertificate || "NONE",
        pastUPSCAttempts: user.pastUPSCAttempts || 0,
        hasTypingSkill: user.hasTypingSkill || false,
        hasShorthandSkill: user.hasShorthandSkill || false,
        experienceStatus: user.experienceStatus || "FRESHER",
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
      streamCodes = [],
      percentage = null,
      isFinalYearStudent = false,
      preferredLocations = ["ALL_INDIA"],
      domicileState = "ALL_INDIA",
      category = "UR",
      gender = "ANY",
      maritalStatus = "UNMARRIED",
      isPwD = false,
      pwdCategory = "NONE",
      isExServiceman = false,
      yearsOfService = 0,
      isDepartmentalCandidate = false,
      isSportsperson = false,
      nccCertificate = "NONE",
      pastUPSCAttempts = 0,
      hasTypingSkill = false,
      hasShorthandSkill = false,
      experienceStatus = "FRESHER",
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

    const up = v => (v && typeof v === "string" ? v.toUpperCase().trim() : v);
    const upArr = arr => (Array.isArray(arr) ? arr.map(up).filter(Boolean) : []);
    const lc = v => (v && typeof v === "string" ? v.toLowerCase().trim() : v);
    const lcArr = arr => (Array.isArray(arr) ? arr.map(lc).filter(Boolean) : []);

    const preferencePayload = {
      education: {
        levels: educationLevels,                 // e.g. ["EDU_GRAD"]
        streamCodes: upArr(streamCodes),         // e.g. ["STR_ENG_CS_IT"]
        percentage: percentage !== null ? Number(percentage) : null,
        isFinalYearStudent: Boolean(isFinalYearStudent)
      },
      preferredLocations: upArr(preferredLocations),
      domicileState: up(domicileState),
      category: up(category),
      gender: up(gender),
      maritalStatus: up(maritalStatus),
      isPwD: Boolean(isPwD),
      pwdCategory: up(pwdCategory),
      isExServiceman: Boolean(isExServiceman),
      yearsOfService: Number(yearsOfService),
      isDepartmentalCandidate: Boolean(isDepartmentalCandidate),
      isSportsperson: Boolean(isSportsperson),
      nccCertificate: up(nccCertificate),
      pastUPSCAttempts: Number(pastUPSCAttempts),
      hasTypingSkill: Boolean(hasTypingSkill),
      hasShorthandSkill: Boolean(hasShorthandSkill),
      experienceStatus: up(experienceStatus),
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
        domicileState: updatedUser.domicileState,
        category: updatedUser.category,
        gender: updatedUser.gender,
        maritalStatus: updatedUser.maritalStatus,
        isPwD: updatedUser.isPwD,
        pwdCategory: updatedUser.pwdCategory,
        isExServiceman: updatedUser.isExServiceman,
        yearsOfService: updatedUser.yearsOfService,
        isDepartmentalCandidate: updatedUser.isDepartmentalCandidate,
        isSportsperson: updatedUser.isSportsperson,
        nccCertificate: updatedUser.nccCertificate,
        pastUPSCAttempts: updatedUser.pastUPSCAttempts,
        hasTypingSkill: updatedUser.hasTypingSkill,
        hasShorthandSkill: updatedUser.hasShorthandSkill,
        experienceStatus: updatedUser.experienceStatus,
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

// GET /user/bookmark/:jobId  → check if bookmarke 
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

const getUserSyllabus = async (req, res) => {
  try {
    const { UserSyllabusData } = require("../models/webmodel");
    const userId = req.user._id;
    let record = await UserSyllabusData.findOne({ userId });
    if (!record) {
      record = await UserSyllabusData.create({ userId, completedTopics: [] });
    }
    return res.status(200).json({ status: "success", data: record.completedTopics });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch syllabus progress", details: error.message });
  }
};

const toggleSyllabusTopic = async (req, res) => {
  try {
    const { UserSyllabusData } = require("../models/webmodel");
    const userId = req.user._id;
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    let record = await UserSyllabusData.findOne({ userId });
    if (!record) {
      record = await UserSyllabusData.create({ userId, completedTopics: [] });
    }

    const index = record.completedTopics.indexOf(topic);
    if (index > -1) {
      record.completedTopics.splice(index, 1);
    } else {
      record.completedTopics.push(topic);
    }

    await record.save();
    return res.status(200).json({ status: "success", data: record.completedTopics });
  } catch (error) {
    return res.status(500).json({ error: "Failed to toggle syllabus topic", details: error.message });
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
  getUserSyllabus,
  toggleSyllabusTopic,
};