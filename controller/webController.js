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
    const rawJobs = await JobsSchemaDatas.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title urlTitle conductingBody")
      .lean();

    const AllAnnouncementData = rawJobs.map((job) => {
      const org = job.conductingBody ? `${job.conductingBody} - ` : "";
      return {
        _id: job._id,
        urlTitle: job.urlTitle,
        title: `${org}${job.title}`,
      };
    });

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
  

    const job = await JobsSchemaDatas.findById(id).populate("notificationGroupId", "title urlTitle");

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
        const todayStr = today.toISOString();
    
        const filter = {
          status: sort === "latest" ? { $in: ["active", "upcoming"] } : "active",
          $or: [
            { "importantDates.applyEnd.date": null },
            { "importantDates.applyEnd.date": { $exists: false } },
            { "importantDates.applyEnd.date": { $gte: today } },
            { "importantDates.applyEnd.date": { $gte: todayStr } }
          ]
        };
        const skip = (Number(page) - 1) * Number(limit);

        const projection = {
          _id: 1, title: 1, masterTitle: 1, jobCode: 1, urlTitle: 1,
          "vacancies.total": 1,
          "importantDates.applyStart": 1,
          "importantDates.applyEnd": 1,
          createdAt: 1,
          conductingBody: 1,
          eligibility: 1,
          locationCodes: 1,
          domicileRequired: 1,
          recommendationTargets: 1,
        };

        let jobsPromise;
        let countFilter = filter;

        if (sort === "ending") {
          // Ending Soon: Sort ascending by close date — only future deadlines within the next 10 days
          const endingSoonThreshold = new Date();
          endingSoonThreshold.setDate(today.getDate() + 10);
          const endingSoonThresholdStr = endingSoonThreshold.toISOString();

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
                "importantDates.applyEnd.date": {
                  $gte: todayStr,
                  $lte: endingSoonThresholdStr
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
         
          // case-insensitive match: "railway", "Railway", "RAILWAY"
          jobDomains: { $elemMatch: { $regex: `^${rawType}$`, $options: "i" } }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          title: 1,
          masterTitle: 1,
          conductingBody: 1,
          location: 1,
          jobDomains: 1,
          "vacancies.total": 1,
          "importantDates.applyStart": 1,
          "importantDates.applyEnd": 1,
          createdAt: 1,
          locationCodes: 1,
          domicileRequired: 1,
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
    
    // 1. Define date filters
    let fromDate, toDate;
    if (month && year) {
      fromDate = new Date(Number(year), Number(month) - 1, 1);   // 1st of that month
      toDate   = new Date(Number(year), Number(month), 1);        // 1st of next month
    } else {
      // Generous range: past 1 month to future 12 months for full coverage
      fromDate = new Date(today);
      fromDate.setMonth(fromDate.getMonth() - 1);
      toDate = new Date(today);
      toDate.setMonth(toDate.getMonth() + 12);
    }

    // 2. Query explicit ExamCalendarData
    const explicitFilter = { isActive: true };
    if (fromDate && toDate) {
      explicitFilter.date = { $gte: fromDate, $lt: toDate };
    }
    if (category) {
      explicitFilter.category = category;
    }
    const explicitEvents = await ExamCalendarData.find(explicitFilter);

    // 3. Query active jobs to synthesize dynamic events
    // Project only minimal lightweight fields for performance
    const activeJobs = await JobsSchemaDatas.find(
      { status: "active" },
      { title: 1, conductingBody: 1, jobDomains: 1, importantDates: 1, links: 1 }
    );

    // Helper to map job domains/conducting body to frontend categories
    const mapJobToCategory = (job) => {
      const jTitle = (job.title || "").toUpperCase();
      const conductingBody = (job.conductingBody || "").toUpperCase();
      const domains = (job.jobDomains || []).map(d => d.toUpperCase());

      if (conductingBody.includes("SSC") || jTitle.includes("SSC")) return "SSC";
      if (conductingBody.includes("UPSC") || jTitle.includes("UPSC")) return "UPSC";
      if (domains.includes("RAILWAY") || conductingBody.includes("RAILWAY") || jTitle.includes("RAILWAY")) return "Railway";
      if (domains.includes("BANKING") || domains.includes("BANK") || conductingBody.includes("BANK") || jTitle.includes("BANK")) return "Banking";
      if (domains.includes("DEFENCE") || domains.includes("MILITARY") || conductingBody.includes("DEFENCE") || jTitle.includes("DEFENCE")) return "Defence";
      if (domains.includes("POLICE") || conductingBody.includes("POLICE") || jTitle.includes("POLICE")) return "Police";
      if (domains.includes("TEACHING") || conductingBody.includes("TEACH") || jTitle.includes("TEACH")) return "Teaching";
      if (domains.includes("PSU") || conductingBody.includes("PSU") || jTitle.includes("PSU")) return "PSU";
      if (domains.includes("MEDICAL") || conductingBody.includes("MEDICAL") || jTitle.includes("MEDICAL")) return "Medical";
      if (domains.includes("STATE") || jTitle.includes("STATE")) return "State";
      
      if (job.jobDomains && job.jobDomains.length > 0) {
        const d = job.jobDomains[0];
        return d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
      }
      return "Central";
    };

    // Helper to map category strings to standard form
    const normalizeCategory = (cat) => {
      if (!cat) return "Central";
      const upper = cat.trim().toUpperCase();
      if (upper === "SSC") return "SSC";
      if (upper === "UPSC") return "UPSC";
      if (upper === "RAILWAY" || upper === "RAILWAYS") return "Railway";
      if (upper === "BANKING" || upper === "BANK" || upper === "BANKS") return "Banking";
      if (upper === "DEFENCE" || upper === "MILITARY" || upper === "NAVY" || upper === "ARMY" || upper === "AIRFORCE") return "Defence";
      if (upper === "POLICE") return "Police";
      if (upper === "TEACHING" || upper === "TEACHER" || upper === "EDUCATION") return "Teaching";
      if (upper === "PSU") return "PSU";
      if (upper === "MEDICAL" || upper === "HEALTH") return "Medical";
      if (upper === "STATE") return "State";
      return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
    };

    const synthesizedEvents = [];

    // Synthesize events from active jobs
    activeJobs.forEach(job => {
      const dates = job.importantDates || {};
      const jobCat = mapJobToCategory(job);
      const link = job.links?.applyOnline || job.links?.officialWebsite || "";

      // Add Apply Start
      if (dates.applyStart && dates.applyStart.date) {
        synthesizedEvents.push({
          _id: `${job._id}_applyStart`,
          title: `${job.title} - Application Start`,
          category: jobCat,
          phase: "application",
          date: dates.applyStart.date,
          description: dates.applyStart.note || "Online application process begins.",
          officialLink: link
        });
      }

      // Add Apply End
      if (dates.applyEnd && dates.applyEnd.date) {
        synthesizedEvents.push({
          _id: `${job._id}_applyEnd`,
          title: `${job.title} - Last Date to Apply`,
          category: jobCat,
          phase: "lastDate",
          date: dates.applyEnd.date,
          description: dates.applyEnd.note || "Last date to submit online application form.",
          officialLink: link
        });
      }

      // Add Exam Date
      if (dates.examDate && dates.examDate.date) {
        synthesizedEvents.push({
          _id: `${job._id}_examDate`,
          title: `${job.title} - Written Exam`,
          category: jobCat,
          phase: "exam",
          date: dates.examDate.date,
          description: dates.examDate.note || "Date of the examination.",
          officialLink: job.links?.officialWebsite || ""
        });
      }

      // Add Admit Card
      if (dates.admitCardDate && dates.admitCardDate.date) {
        synthesizedEvents.push({
          _id: `${job._id}_admitCardDate`,
          title: `${job.title} - Admit Card Release`,
          category: jobCat,
          phase: "admitCard",
          date: dates.admitCardDate.date,
          description: dates.admitCardDate.note || "Admit cards available for download.",
          officialLink: job.links?.admitCard || job.links?.officialWebsite || ""
        });
      }

      // Add Result
      if (dates.resultDate && dates.resultDate.date) {
        synthesizedEvents.push({
          _id: `${job._id}_resultDate`,
          title: `${job.title} - Exam Result`,
          category: jobCat,
          phase: "result",
          date: dates.resultDate.date,
          description: dates.resultDate.note || "Declaration of examination results.",
          officialLink: job.links?.result || job.links?.officialWebsite || ""
        });
      }
    });

    // 4. Map explicit events categories to align with frontend as well
    const normalizedExplicit = explicitEvents.map(ev => ({
      _id: ev._id,
      title: ev.title,
      category: normalizeCategory(ev.category),
      phase: ev.phase,
      date: ev.date,
      description: ev.description || "",
      officialLink: ev.officialLink || ""
    }));

    // 5. Merge, filter by range and category, then sort
    let allEvents = [...normalizedExplicit, ...synthesizedEvents];

    // Filter by date range (synthesized events aren't filtered by the db query)
    if (fromDate && toDate) {
      allEvents = allEvents.filter(ev => {
        const d = new Date(ev.date);
        return d >= fromDate && d < toDate;
      });
    }

    // Filter by category (case-insensitive filter)
    if (category) {
      const catUpper = category.trim().toUpperCase();
      allEvents = allEvents.filter(ev => ev.category.toUpperCase() === catUpper);
    }

    // Sort by date ascending
    allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.status(200).json({ message: "success", data: allEvents });
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
      
    ];

    // Education cascade: graduate → eligible for diploma/12th/10th jobs too
    // All DB data is now standardized to EDU_* levelCodes — pure O(1) code lookup only, no regex fallback needed
    const eligibleCodes = getEligibleLevelCodes(educationLevel);
    if (eligibleCodes.length > 0) {
      andConditions.push({
        "eligibility.education.levelCode": { $in: eligibleCodes },
      });
    }

    // Location filter
    const loc = (location || "").toLowerCase().trim();
    if (loc && loc !== "all india") {
      andConditions.push({ location: { $regex: `^(all india|${loc})$`, $options: "i" } });
    }

    // Age filter (with category relaxation)
    if (userAge !== null) {
      const dobStr = dob ? dob.substring(0, 10) : "";
      andConditions.push({
        $and: [
          // 1. Min age check
          {
            $or: [
              { "ageCriteria.numberBased.min": { $in: [null, undefined] } },
              { "ageCriteria.numberBased.min": { $exists: false } },
              { "ageCriteria.numberBased.min": { $lte: userAge } }
            ]
          },
          // 2. Max age check
          {
            $or: [
              { "ageCriteria.numberBased.max": { $in: [null, undefined] } },
              { "ageCriteria.numberBased.max": { $exists: false } },
              {
                $expr: {
                  $gte: [
                    { $add: [{ $ifNull: ["$ageCriteria.numberBased.max", 99] }, categoryRelaxation] },
                    userAge,
                  ],
                }
              }
            ]
          },
          // 3. DOB based check (if applicable)
          {
            $or: [
              { "ageCriteria.type": { $nin: ["DOB", "dob_based"] } },
              {
                "ageCriteria.dobBased.bornBetweenStart": { $lte: dobStr },
                "ageCriteria.dobBased.bornBetweenEnd": { $gte: dobStr }
              },
              {
                "ageCriteria.dobBased.from": { $lte: dob },
                "ageCriteria.dobBased.to": { $gte: dob }
              }
            ]
          }
        ]
      });
    }

    const filter = { $and: andConditions };

    const [eligible, jobs] = await Promise.all([
      JobsSchemaDatas.countDocuments(filter),
      JobsSchemaDatas.find(filter, {
        _id: 1, title: 1, masterTitle: 1, conductingBody: 1, location: 1, jobDomains: 1,
        "vacancies.total": 1,
        "importantDates.applyStart": 1,
        "importantDates.applyEnd": 1,
        locationCodes: 1,
        domicileRequired: 1,
      })
        .sort({ "importantDates.applyEnd": 1, createdAt: -1 })
        .limit(30),
    ]);

    return res.status(200).json({ eligible, data: jobs });
  } catch (error) {
    return res.status(500).json({ error: "Eligibility check failed", details: error.message });
  }
};


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

// Location Guessing API for unauthenticated users (Smart Default Location)
// GET /web/api/location/guess
const guessLocationController = async (req, res) => {
  try {
    const { getGeoLocation, extractIp } = require("../utils/geoService");
    const clientIp = extractIp(req);
    const locationData = await getGeoLocation(clientIp);

    if (locationData && locationData.region) {
      return res.status(200).json({
        success: true,
        data: {
          state: locationData.region,
          city: locationData.city
        }
      });
    }

    return res.status(200).json({ success: false, message: "Could not guess location" });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to guess location" });
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
  guessLocationController,
};
