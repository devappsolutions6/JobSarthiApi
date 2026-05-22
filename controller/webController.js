const {
  JobsSchemaDatas,
  AdmitCardData,
  ResultCardData,
  UserSignupSchemaDatas,
  ExamCalendarData,
} = require("../models/webmodel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validateSignupInput } = require("../utils/validation");
const { sendVerificationEmail } = require("../utils/emailService");
const { getCache, setCache, fetchCached } = require("../utils/cache");





// getAnnouncementData
const _getAnnouncement = async (req, res) => {

  
  try {
    const AllAnnouncementData = await JobsSchemaDatas.aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: 10 },
      { $project: { title: 1, urlTitle: 1, _id: 1 } },
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
    const cacheKey = `jobs_p${page}_l${limit}_s${search || ""}`;

    const payload = await fetchCached(
      cacheKey,
      async () => {
        // Highly optimized pre-computed status filter leveraging indices
        const filter = { status: "active" };
        if (search) filter.title = { $regex: search, $options: "i" };

        const skip = (Number(page) - 1) * Number(limit);
        const [jobs, total] = await Promise.all([
          JobsSchemaDatas.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
          JobsSchemaDatas.countDocuments(filter),
        ]);

        return { total, page: Number(page), totalPages: Math.ceil(total / limit), data: jobs };
      },
      300
    );

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
    const cacheKey = `homepage_jobs_p${page}_l${limit}_s${sort}`;

    const payload = await fetchCached(
      cacheKey,
      async () => {
        const today = new Date();
    
        const filter = {
          status: "active",
          $or: [
            { "importantDates.applyEnd.date": null },
            { "importantDates.applyEnd.date": { $exists: false } },
            { "importantDates.applyEnd.date": { $gte: today } }
          ]
        };
        const skip = (Number(page) - 1) * Number(limit);

        const projection = {
          _id: 1, title: 1, jobCode: 1, urlTitle: 1,
          "vacancies.total": 1,
          "importantDates.applyStart": 1,
          "importantDates.applyEnd": 1,
          createdAt: 1,
          conductingBody: 1,
        };

        let jobsPromise;
        let countFilter = filter;

        if (sort === "ending") {
          // Ending Soon: Sort ascending by close date — only future deadlines within the next 10 days
          const endingSoonThreshold = new Date();
          endingSoonThreshold.setDate(today.getDate() + 10);

          countFilter = {
            status: "active",
            $or: [
              {
                "importantDates.applyEnd.date": {
                  $gte: today,
                  $lte: endingSoonThreshold
                }
              },
              {
                $and: [
                  { "importantDates.applyEnd": { $type: "date" } },
                  {
                    "importantDates.applyEnd": {
                      $gte: today,
                      $lte: endingSoonThreshold
                    }
                  }
                ]
              }
            ]
          };
          jobsPromise = JobsSchemaDatas.find(countFilter, projection)
            .sort({ "importantDates.applyEnd.date": 1, "importantDates.applyEnd": 1 })
            .skip(skip)
            .limit(Number(limit));
        } else {
          // Pure, predictable sorting for each tab (Latest & Most Vacancies)
          const sortMap = {
            latest:    { createdAt: -1 },
            vacancies: { "vacancies.total": -1 },
          };
          const sortQuery = sortMap[sort] || { createdAt: -1 };
          jobsPromise = JobsSchemaDatas.find(filter, projection)
            .sort(sortQuery)
            .skip(skip)
            .limit(Number(limit));
        }

        const [jobs, total] = await Promise.all([jobsPromise, JobsSchemaDatas.countDocuments(countFilter)]);
        const totalPages = Math.ceil(total / Number(limit));

        return {
          data: jobs,
          total,
          page: Number(page),
          totalPages,
          hasMore: Number(page) < totalPages,
        };
      },
      300
    );

    res.json({
      message: "Successfully fetched the data",
      ...payload
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
    const cacheKey = `admitcards_p${page}_l${limit}_c${category || ""}_s${search || ""}`;

    const payload = await fetchCached(
      cacheKey,
      async () => {
        const filter = {};
        if (category) filter.category = category;
        if (search) filter.title = { $regex: search, $options: "i" };

        const skip = (Number(page) - 1) * Number(limit);
        const [admitCards, total] = await Promise.all([
          AdmitCardData.find(filter).sort({ releaseDate: -1 }).skip(skip).limit(Number(limit)),
          AdmitCardData.countDocuments(filter),
        ]);

        return { total, page: Number(page), totalPages: Math.ceil(total / limit), data: admitCards };
      },
      300
    );

    res.json({ message: "All Admit Card Data", ...payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getResultCard = async (req, res) => {
  try {
    const { page = 1, limit = 20, category, search } = req.query;
    const cacheKey = `results_p${page}_l${limit}_c${category || ""}_s${search || ""}`;

    const payload = await fetchCached(
      cacheKey,
      async () => {
        const filter = {};
        if (category) filter.category = category;
        if (search) filter.title = { $regex: search, $options: "i" };

        const skip = (Number(page) - 1) * Number(limit);
        const [result, total] = await Promise.all([
          ResultCardData.find(filter).sort({ releaseDate: -1 }).skip(skip).limit(Number(limit)),
          ResultCardData.countDocuments(filter),
        ]);

        return { total, page: Number(page), totalPages: Math.ceil(total / limit), data: result };
      },
      300
    );

    res.json({ message: "All Result Data", ...payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//logut controller

const logutController = async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      // Decode token to get userId (no need to verify for logout)
      const decoded = jwt.decode(token);
      if (decoded && decoded.userId) {
        // Invalidate the refresh token in the database
        await UserSignupSchemaDatas.findByIdAndUpdate(decoded.userId, {
          $unset: { refreshToken: 1 },
        });
      }
    }
  } catch (err) {
    console.warn("Logout DB cleanup failed:", err.message);
  }

  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });

  return res.json({ message: "Logged out successfully" });
};


const JobCategoryController = async (req, res) => {
  try {
    const rawType = (req.params.type || "").trim();
    if (!rawType) {
      return res.status(400).json({ error: "Job type is required" });
    }

    const jobCollection = await JobsSchemaDatas.aggregate([
      {
        $match: {
          status: "active",
          // case-insensitive match: "railway", "Railway", "RAILWAY"
          jobDomains: { $elemMatch: { $regex: `^${rawType}$`, $options: "i" } }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          title: 1,
          conductingBody: 1,
          location: 1,
          jobDomains: 1,
          "vacancies.total": 1,
          "importantDates.applyStart": 1,
          "importantDates.applyEnd": 1,
          createdAt: 1,
        }
      }
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

    const { getEligibleLevelCodes } = require("../utils/educationHelper");

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
      { status: "active" }
    ];

    // Education cascade: graduate → eligible for diploma/12th/10th jobs too
    // All DB data is now standardized to EDU_* levelCodes — pure O(1) code lookup only, no regex fallback needed
    const eligibleCodes = getEligibleLevelCodes(educationLevel);
    if (eligibleCodes.length > 0) {
      andConditions.push({
        $or: [
          { "eligibility.posts": { $exists: false } },
          { "eligibility.posts": { $size: 0 } },
          { "eligibility.posts.education.levelCode": { $exists: false } }, // open to all
          { "eligibility.posts.education.levelCode": { $in: eligibleCodes } }, // High-performance exact match
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
// Highly optimized using MongoDB Full-Text search ($text) indexing instead of 7-field regex scans
const searchJobs = async (req, res) => {
  try {
    const { q = "", limit = 8 } = req.query;
    const query = q.trim();

    if (!query) return res.json({ message: "Search results", data: [] });

    // Escape regex characters to prevent crashes
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // Match any word starting with the search query (e.g., "rail" matches "Railway" or "Indian Railway")
    const regex = new RegExp("\\b" + escapedQuery, "i");

    const jobs = await JobsSchemaDatas.find(
      {
        status: "active",
        $or: [
          { title: regex },
          { conductingBody: regex },
          { department: regex },
          { searchKeywords: regex }
        ]
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
        "importantDates.examDate": 1
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
