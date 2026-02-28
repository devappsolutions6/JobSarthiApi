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
    const JobsData = await JobsSchemaDatas.find()
      .sort({ startDate: -1 })
      .limit(4)
      .select("title");

    const AdmitCardDataofJobs = await AdmitCardData.find()
      .sort({ releaseDate: -1 })
      .limit(4)
      .select("title");

    const ResultDataofJobs = await ResultCardData.find()
      .sort({ resultDate: -1 })
      .limit(4)
      .select("title");

    const AllAnnouncementData = [
      ...JobsData,
      ...AdmitCardDataofJobs,
      ...ResultDataofJobs,
    ];

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
    const filter = { isActive: true };
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
    const JobsData = await JobsSchemaDatas.find(
      {},
    { _id: 1, title: 1, JobId: 1, "vacancies.total":1, 
      "importantDates.applyStart": 1,
      "importantDates.applyEnd":1,
      "conductingBody":1,


}
    );

    res.json({
      message: "Successfully fetched the data",
      data: JobsData,
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
    const type = req.params.type?.toLowerCase();

     

  
    const jobCollection = await JobsSchemaDatas.aggregate([
      {
        $match: {
          isActive: true,
          jobDomains: type
        }
      },
     {
      $project:{
        vacancies:1,
        importantDates:1,
        conductingBody:1,
        title:1
      }
     }
    ]);

    return res.status(200).json({
      jobType: type,
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


// Search Jobs — suggestions API
// GET /web/api/search?q=ssc&limit=8
const searchJobs = async (req, res) => {
  try {
    const { q = "", limit = 8 } = req.query;
    const query = q.trim();

    if (!query) return res.json({ message: "Search results", data: [] });

    const regex = { $regex: query, $options: "i" };

    const jobs = await JobsSchemaDatas.find(
      {
        isActive: true,
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
      {
        _id: 1,
        title: 1,
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
};
