const {
  JobsSchemaDatas,
  AdmitCardData,
  ResultCardData,
  UserSignupSchemaDatas,
  UserprefrenceData,
  ExamCalendarData,
} = require("../models/webmodel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateSignupInput } = require("../utils/validation");
const { sendVerificationEmail } = require("../utils/emailService");
const { getCache, setCache } = require("../utils/cache");





// getAnnouncementData
const _getAnnouncement = async (req, res) => {

  
  try {
    const AllAnnouncementData = await JobsSchemaDatas.aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 4 },
      { $project: { title: 1, urlTitle: 1, _id: 1 } },
      {
        $unionWith: {
          coll: "admitcards",
          pipeline: [
            { $sort: { createdAt: -1 } },
            { $limit: 4 },
            { $project: { title: 1, downloadLink: 1, _id: 0 } },
          ],
        },
      },
      {
        $unionWith: {
          coll: "results",
          pipeline: [
            { $sort: { createdAt: -1 } },
            { $limit: 4 },
            { $project: { title: 1, DownloadLink: 1, _id: 0 } },
          ],
        },
      },
    ]);

    res.status(200).json({
      message: "Announcement Data fetched successfully",
      data: AllAnnouncementData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 1. All Jobs — with pagination and search
const getJobs = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const today = new Date();
    const filter = {
      isActive: { $ne: false },
      $or: [
        { "importantDates.applyEnd": { $gte: today } },
        { "importantDates.applyEnd": { $exists: false } },
        { "importantDates.applyEnd": null },
      ],
    };
    if (search) filter.title = { $regex: search, $options: "i" };

    const cacheKey = `jobs_p${page}_l${limit}_s${search || ""}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ message: "All jobs fetched", ...cached, fromCache: true });

    const skip = (Number(page) - 1) * Number(limit);
    const [jobs, total] = await Promise.all([
      JobsSchemaDatas.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      JobsSchemaDatas.countDocuments(filter),
    ]);

    const payload = { total, page: Number(page), totalPages: Math.ceil(total / limit), data: jobs };
    await setCache(cacheKey, payload, 300);

    res.json({ message: "All jobs fetched", ...payload });
  } catch (error) {
    res.status(500).json({ error: "Error fetching jobs", details: error.message });
  }
};

// 2. Single Job by ID

const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
  

    const job = await JobsSchemaDatas.findById(id);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    res.json({ message: "Single job fetched", data: job });
  } catch (error) {
    console.error("Error fetching job:", error);
    res
      .status(500)
      .json({ error: "Error fetching job", details: error.message });
  }
};



const getHomePageJobs = async (req, res) => {
  try {
    const { page = 1, limit = 15, sort = "latest" } = req.query;

    const today = new Date();
    const filter = {
      $or: [
        // New schema: applyStart is tentative (not yet started)
        { "importantDates.applyStart.tentative": true },
        // Old schema: applyStart was null
        { "importantDates.applyStart": null },

        // New schema: applyEnd.date >= today
        { "importantDates.applyEnd.date": { $gte: today } },
        // New schema: applyEnd is tentative
        { "importantDates.applyEnd.tentative": true },

        // Old schema: applyEnd was a plain Date >= today
        { "importantDates.applyEnd": { $gte: today } },
        // Old schema: applyEnd didn't exist or was null
        { "importantDates.applyEnd": { $exists: false } },
        { "importantDates.applyEnd": null },
      ],
    };

    const sortMap = {
      latest:    { createdAt: -1 },
      // New schema sorts by .date, old schema sorts by direct value — both work together
      ending:    { "importantDates.applyEnd.date": 1, "importantDates.applyEnd": 1 },
      vacancies: { "vacancies.total": -1 },
    };
    const sortQuery = sortMap[sort] || { createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);

    const [jobs, total] = await Promise.all([
      JobsSchemaDatas.find(filter, {
        _id: 1, title: 1, JobId: 1,
        urlTitle:1,
        "vacancies.total": 1,
        "importantDates.applyStart": 1,
        "importantDates.applyEnd": 1,
        conductingBody: 1,
      }).sort(sortQuery).skip(skip).limit(Number(limit)),
      JobsSchemaDatas.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      message: "Successfully fetched the data",
      data: jobs,
      total,
      page: Number(page),
      totalPages,
      hasMore: Number(page) < totalPages,
    });

  } catch (error) {
    res.status(500).json({
      error: "Error fetching jobs",
      details: error.message,
    });
  }
};


const getAdmitCard = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (search) filter.title = { $regex: search, $options: "i" };

    const cacheKey = `admitcards_p${page}_l${limit}_c${category || ""}_s${search || ""}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ message: "All Admit Card Data", ...cached, fromCache: true });

    const skip = (Number(page) - 1) * Number(limit);
    const [admitCards, total] = await Promise.all([
      AdmitCardData.find(filter).sort({ releaseDate: -1 }).skip(skip).limit(Number(limit)),
      AdmitCardData.countDocuments(filter),
    ]);

    const payload = { total, page: Number(page), totalPages: Math.ceil(total / limit), data: admitCards };
    await setCache(cacheKey, payload, 300);

    res.json({ message: "All Admit Card Data", ...payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getResultCard = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (search) filter.title = { $regex: search, $options: "i" };

    const cacheKey = `results_p${page}_l${limit}_c${category || ""}_s${search || ""}`;
    const cached = await getCache(cacheKey);
    if (cached) return res.json({ message: "All Result Data", ...cached, fromCache: true });

    const skip = (Number(page) - 1) * Number(limit);
    const [result, total] = await Promise.all([
      ResultCardData.find(filter).sort({ ReleaseDate: -1 }).skip(skip).limit(Number(limit)),
      ResultCardData.countDocuments(filter),
    ]);

    const payload = { total, page: Number(page), totalPages: Math.ceil(total / limit), data: result };
    await setCache(cacheKey, payload, 300);

    res.json({ message: "All Result Data", ...payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//logut controller

const logutController = async (req, res) =>{
res.clearCookie("token", {
    httpOnly: true,
    secure: true,       // same as login
    sameSite: "none",   // same as login
    path: "/"           // same as login
  });


  return res.json({ message: "Logged out successfully" });
}


const JobCategoryController = async (req, res) => {
  try {
    const rawType = (req.params.type || "").trim();
    if (!rawType) {
      return res.status(400).json({ error: "Job type is required" });
    }

    const today = new Date();

    const jobCollection = await JobsSchemaDatas.aggregate([
      {
        $match: {
          // case-insensitive match: "railway", "Railway", "RAILWAY" — sab kaam karenge
          jobDomains: { $elemMatch: { $regex: `^${rawType}$`, $options: "i" } },
          $or: [
            { "importantDates.applyEnd": { $gte: today } },
            { "importantDates.applyEnd": { $exists: false } },
            { "importantDates.applyEnd": null },
          ],
        }
      },
      {
        $project: {
          title: 1,
          conductingBody: 1,
          location: 1,
          jobDomains: 1,
          "vacancies.total": 1,
          "importantDates.applyStart": 1,
          "importantDates.applyEnd": 1,
        }
      },
      { $sort: { "importantDates.applyEnd": 1, createdAt: -1 } }
    ]);

    return res.status(200).json({
      jobType: rawType,
      total: jobCollection.length,
      data: jobCollection
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};






// GET /exam-calendar
// Query params: month (1-12), year (YYYY), category
const getExamCalendar = async (req, res) => {
  try {
    const { month, year, category } = req.query;

    const today = new Date();
    const filter = { isActive: true };

    if (month && year) {
      // Filter by exact month and year
      const from = new Date(Number(year), Number(month) - 1, 1);   // 1st of that month
      const to   = new Date(Number(year), Number(month), 1);        // 1st of next month
      filter.date = { $gte: from, $lt: to };
    } else {
      // Default: upcoming events in next 6 months
      const sixMonthsLater = new Date(today);
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      filter.date = { $gte: today, $lte: sixMonthsLater };
    }

    if (category) filter.category = category;

    const data = await ExamCalendarData.find(filter).sort({ date: 1 });

    res.status(200).json({ message: "success", data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// POST /admin/exam-calendar
const addExamCalendar = async (req, res) => {
  try {
    const { title, category, phase, date, description, officialLink } = req.body;

    if (!title || !category || !phase || !date) {
      return res.status(400).json({ error: "title, category, phase and date are required" });
    }

    const entry = await ExamCalendarData.create({ title, category, phase, date, description, officialLink });

    res.status(201).json({ message: "Exam calendar entry added successfully", data: entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Eligibility Checker — no auth required
// POST /web/api/eligibility-check
const eligibilityCheckController = async (req, res) => {
  try {
    const {
      educationLevel,
      dob,
      category = "gen",
      location = "",
    } = req.body;

    if (!educationLevel) {
      return res.status(400).json({ error: "educationLevel is required" });
    }

    const educationRank = { "10th": 1, "12th": 2, diploma: 3, graduate: 4, postgraduate: 5 };

    // Maps user education level to regex patterns matching degree names in DB
    const eduDegreePatterns = {
      "10th":        "10th|matriculat|ssc|secondary school",
      "12th":        "12th|intermediate|hsc|higher secondary|senior secondary",
      "diploma":     "diploma|iti",
      "graduate":    "degree|b\\.tech|b\\.e\\b|bachelor|b\\.sc|b\\.a\\b|b\\.com|graduation|engineering degree|graduate",
      "postgraduate":"master|m\\.tech|m\\.e\\b|m\\.sc|m\\.a\\b|m\\.com|post.?graduate|mba|phd|doctorate",
    };

    const userMaxEduRank = educationRank[educationLevel.toLowerCase()] || 0;
    const eligiblePatterns = Object.keys(educationRank)
      .filter((k) => educationRank[k] <= userMaxEduRank)
      .map((k) => eduDegreePatterns[k])
      .filter(Boolean);

    const categoryRelaxation = ["sc", "st"].includes((category || "").toLowerCase())
      ? 5
      : (category || "").toLowerCase() === "obc"
      ? 3
      : 0;

    const today = new Date();
    const userAge = dob
      ? Math.floor((today - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const andConditions = [
      {
        $or: [
          { "importantDates.applyEnd": { $gte: today } },
          { "importantDates.applyEnd": { $exists: false } },
          { "importantDates.applyEnd": null },
        ],
      },
    ];

    // Education cascade: graduate → eligible for diploma/12th/10th jobs too
    // DB structure: eligibility.posts[].education[].degree & eligibility.posts[].alternativeQualifications[].degree
    if (eligiblePatterns.length > 0) {
      const eduRegex = eligiblePatterns.join("|");
      andConditions.push({
        $or: [
          { "eligibility.posts": { $exists: false } },
          { "eligibility.posts": { $size: 0 } },
          { "eligibility.posts.education.degree": { $exists: false } },  // posts have no education specified → open to all
          { "eligibility.posts.education.degree": { $regex: eduRegex, $options: "i" } },
          { "eligibility.posts.alternativeQualifications.degree": { $regex: eduRegex, $options: "i" } },
        ],
      });
    }

    // Location filter
    const loc = (location || "").toLowerCase().trim();
    if (loc && loc !== "all india") {
      andConditions.push({ location: { $regex: `^(all india|${loc})$`, $options: "i" } });
    }

    // Age filter (with category relaxation)
    if (userAge !== null) {
      andConditions.push({
        $or: [
          { "ageCriteria.numberBased.min": { $exists: false } },
          { "ageCriteria.numberBased.max": { $exists: false } },
          { "ageCriteria.numberBased.min": null },
          { "ageCriteria.numberBased.max": null },
          {
            "ageCriteria.numberBased.min": { $lte: userAge },
            $expr: {
              $gte: [
                { $add: [{ $ifNull: ["$ageCriteria.numberBased.max", 99] }, categoryRelaxation] },
                userAge,
              ],
            },
          },
        ],
      });
    }

    const filter = { $and: andConditions };

    const [eligible, jobs] = await Promise.all([
      JobsSchemaDatas.countDocuments(filter),
      JobsSchemaDatas.find(filter, {
        _id: 1, title: 1, conductingBody: 1, location: 1, jobDomains: 1,
        "vacancies.total": 1,
        "importantDates.applyStart": 1,
        "importantDates.applyEnd": 1,
      })
        .sort({ "importantDates.applyEnd": 1, createdAt: -1 })
        .limit(30),
    ]);

    return res.status(200).json({ eligible, data: jobs });
  } catch (error) {
    return res.status(500).json({ error: "Eligibility check failed", details: error.message });
  }
};

// Search Jobs — suggestions API
// GET /web/api/search?q=ssc&limit=8
const searchJobs = async (req, res) => {
  try {
    const { q = "", limit = 8 } = req.query;
    const query = q.trim();

    if (!query) return res.json({ message: "Search results", data: [] });

    const regex = { $regex: query, $options: "i" };

    const today = new Date();
    const jobs = await JobsSchemaDatas.find(
      {
        isActive: { $ne: false },
        $and: [
          {
            $or: [
              // New schema: applyStart is tentative (not yet started)
        { "importantDates.applyStart.tentative": true },
        // Old schema: applyStart was null
        { "importantDates.applyStart": null },

        // New schema: applyEnd.date >= today
        { "importantDates.applyEnd.date": { $gte: today } },
        // New schema: applyEnd is tentative
        { "importantDates.applyEnd.tentative": true },

        // Old schema: applyEnd was a plain Date >= today
        { "importantDates.applyEnd": { $gte: today } },
        // Old schema: applyEnd didn't exist or was null
        { "importantDates.applyEnd": { $exists: false } },
        { "importantDates.applyEnd": null },
            ],
          },
          {
            $or: [
              { title: regex },
              { department: regex },
              { conductingBody: regex },
              { jobDomains: regex },
              { tags: regex },
              { searchKeywords: regex },
              { location: regex },
            ],
          },
        ],
      },
      {
        _id: 1,
        title: 1,
        urlTitle: 1,
        department: 1,
        conductingBody: 1,
        jobDomains: 1,
        location: 1,
        "vacancies.total": 1,
        "importantDates.applyEnd": 1,
      }
    )
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 20));

    res.json({ message: "Search results", data: jobs });
  } catch (error) {
    res.status(500).json({ error: "Search failed", details: error.message });
  }
};

module.exports = {
  getHomePageJobs,
  getJobs,
  getJobById,
  _getAnnouncement,
  getAdmitCard,
  getResultCard,
  logutController,
  JobCategoryController,
  getExamCalendar,
  addExamCalendar,
  searchJobs,
  eligibilityCheckController,
};
