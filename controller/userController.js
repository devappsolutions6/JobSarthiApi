const { UserSignupSchemaDatas, JobsSchemaDatas, SavedJobData } = require("../models/webmodel");




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

    const preferencePayload = {
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
      selectionPreference,
      ...(dob ? { dob: new Date(dob) } : {}),
    };

    const updatedUser = await UserSignupSchemaDatas.findByIdAndUpdate(
      userId,
      { $set: preferencePayload },
      { new: true }
    );

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





// Education rank: higher rank = higher qualification
// User with higher rank is ALSO eligible for lower-rank jobs (cascade)
const educationRank = {
  "10th": 1,
  "12th": 2,
  "diploma": 3,
  "graduate": 4,
  "postgraduate": 5,
};

// Maps user education level → regex patterns that match DB degree values
// e.g., user "graduate" matches "Engineering Degree", "B.Tech", "Degree" etc. in DB
const eduDegreePatterns = {
  "10th":        "10th|matriculat|ssc|high school|secondary school",
  "12th":        "12th|10\\+2|intermediate|hsc|higher secondary|senior secondary",
  "diploma":     "diploma|iti|polytechnic",
  "graduate":    "degree|b\\.tech|b\\.e\\b|bachelor|b\\.sc|b\\.a\\b|b\\.com|graduation|engineering degree|graduate",
  "postgraduate":"master|m\\.tech|m\\.e\\b|m\\.sc|m\\.a\\b|m\\.com|post.?graduate|mba|phd|doctorate",
};

const recommendJobsController = async (req, res) => {
  try {
    const {
      education = { levels: [], stream: [], specialization: [] },
      preferredLocations = ["All India"],
      organizationTypes = [],
      interests = [],
      gender = "any",
      dob = null,
      category: userCategory = "",
      selectionPreference = "any",
    } = req.user;

    // Check if user has actually provided any info (beyond defaults)
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

    // ── Normalize inputs ──────────────────────────────────────────────────────
    const educationLevels           = (education.levels        || []).map(l => l.toLowerCase().trim());
    const educationStreams           = (education.stream        || []).map(s => s.toLowerCase().trim());
    const normalizedSpecializations = (education.specialization || []).map(s => s.toLowerCase().trim());
    const normalizedLocations       = preferredLocations.map(l => l.toLowerCase().trim());
    const normalizedOrgTypes        = organizationTypes.map(o => o.toLowerCase().trim());
    const normalizedInterests       = interests.map(i => i.toLowerCase().trim());
    const normalizedGender          = (gender || "any").toLowerCase();
    const normalizedSelPref         = (selectionPreference || "any").toLowerCase();
    // Category-specific vacancy field (null for GEN → no targeted boost needed)
    const catVacField = ["obc", "sc", "st", "ews"].includes((userCategory || "").toLowerCase())
      ? (userCategory || "").toLowerCase()
      : null;
    const today               = new Date();

    // ── Age calculation (for soft scoring) ────────────────────────────────────
    // SC/ST get +5 yr, OBC get +3 yr — we add max possible relaxation buffer
    // so valid jobs are never excluded
    const categoryRelaxation  = ["sc","st"].includes((userCategory||"").toLowerCase()) ? 5
                              : (userCategory||"").toLowerCase() === "obc" ? 3 : 0;
    const userAge = dob
      ? Math.floor((today - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    // ── Education cascade ─────────────────────────────────────────────────────
    // User with "12th" (rank 2) → eligible for jobs needing 10th (1) or 12th (2)
    // User with "graduate" (rank 4) → eligible for 10th, 12th, diploma, graduate
    const userMaxEduRank = educationLevels.reduce(
      (max, lvl) => Math.max(max, educationRank[lvl] || 0), 0
    );
    const eligibleEduLevels = userMaxEduRank > 0
      ? Object.keys(educationRank).filter(k => educationRank[k] <= userMaxEduRank)
      : educationLevels;

    // ── Location setup ────────────────────────────────────────────────────────
    // No location preference → show all jobs
    // "All India" preference → show all jobs
    // Specific state(s) → show ONLY those state jobs + "All India" jobs
    const wantsAllIndia = normalizedLocations.length === 0 ||
      normalizedLocations.includes("all india");
    const stateLocations = normalizedLocations.filter(l => l !== "all india");

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 1 — HARD FILTER ($match)
    //  ALL conditions must pass. No scoring here — binary gate.
    //  This ensures UPSC CAPF (grad required) never appears for a 12th-pass user,
    //  and Bihar-only jobs never appear for users who prefer other states.
    // ═══════════════════════════════════════════════════════════════════════════
    const hardAndConditions = [
      // Condition A: Not expired
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
    ];

    // Condition B: Education hard filter
    // Two DB schemas exist:
    //   New schema: eligibility.posts[].education[].degree  (free-text, e.g. "Bachelor Degree")
    //   Old schema: eligibility.education[].level           (normalized, e.g. "12th", "graduate")
    // User with rank ≥ job's required level → eligible (cascade).
    // Jobs with NO education field in either schema always pass (open to all).
    if (eligibleEduLevels.length > 0) {
      const eduRegex = eligibleEduLevels
        .map((lvl) => eduDegreePatterns[lvl])
        .filter(Boolean)
        .join("|");

      hardAndConditions.push({
        $or: [
          // ── New schema (eligibility.posts) ──────────────────────────────────
          { "eligibility.posts": { $size: 0 } },
          { "eligibility.posts.education.degree": { $exists: false } },
          { "eligibility.posts.education.degree":                 { $regex: eduRegex, $options: "i" } },
          { "eligibility.posts.alternativeQualifications.degree": { $regex: eduRegex, $options: "i" } },

          // ── Old schema (eligibility.education) — properly validated ─────────
          // Must have no posts AND old-schema education matches eligible levels.
          // Without this, ALL old-schema jobs bypassed the filter unconditionally.
          {
            $and: [
              { "eligibility.posts": { $exists: false } },
              {
                $or: [
                  { "eligibility.education": { $exists: false } },
                  { "eligibility.education": { $size: 0 } },
                  { "eligibility.education.level": { $in: eligibleEduLevels } },
                ],
              },
            ],
          },
        ],
      });
    }

    // Condition C: Location hard filter
    // If user has a state preference, only show:
    //   • Jobs with location = "All India"  (central / national jobs)
    //   • Jobs with location = one of user's preferred states
    if (!wantsAllIndia && stateLocations.length > 0) {
      const locRegex = `^(all india|${stateLocations.join("|")})$`;
      hardAndConditions.push({ location: { $regex: locRegex, $options: "i" } });
    }

    // Condition D: Organization type hard filter
    // If user selected specific org types (psu, bank, defence, etc.) ONLY show matching jobs.
    // Matches against jobDomains, tags, conductingBody, and department.
    // Deduplicates the array first (user data had ["psu","psu","psu"]).
    const uniqueOrgTypes = [...new Set(normalizedOrgTypes)];
    if (uniqueOrgTypes.length > 0) {
      const orgRegex = uniqueOrgTypes.join("|");
      hardAndConditions.push({
        $or: [
          { jobDomains:     { $regex: orgRegex, $options: "i" } },
          { tags:           { $regex: orgRegex, $options: "i" } },
          { conductingBody: { $regex: orgRegex, $options: "i" } },
          { department:     { $regex: orgRegex, $options: "i" } },
        ],
      });
    }

    // Condition E: Selection preference hard filter
    // If user prefers a specific selection mode, only show jobs with that mode.
    if (normalizedSelPref === "written") {
      hardAndConditions.push({
        $and: [
          { "selectionProcess.stage": { $not: { $regex: "pet|physical|medical", $options: "i" } } },
          { "selectionProcess.stage": { $not: { $regex: "interview", $options: "i" } } },
        ],
      });
    } else if (normalizedSelPref === "pet") {
      hardAndConditions.push({
        "selectionProcess.stage": { $regex: "pet|physical|medical", $options: "i" },
      });
    } else if (normalizedSelPref === "interview") {
      hardAndConditions.push({
        "selectionProcess.stage": { $regex: "interview", $options: "i" },
      });
    }

    // isActive field does not exist in DB — removed to avoid filtering out all jobs
    const hardMatch = { $and: hardAndConditions };

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 2 — SOFT SCORING (relevance ranking only)
    //  These signals don't include / exclude jobs — they only determine ORDER.
    //  A job that passes hard filters always shows; high-relevance ones show first.
    // ═══════════════════════════════════════════════════════════════════════════
    const NO_MATCH = ["__no_match__"];

    // Stream match expression
    // DB path: eligibility.posts[].education[].stream  (two levels of nesting)
    // Use $reduce to flatten all streams across all posts into one array
    const eduStreamMatchExpr = educationStreams.length > 0
      ? {
          $gt: [{
            $size: {
              $setIntersection: [
                {
                  $reduce: {
                    input: { $ifNull: ["$eligibility.posts", []] },
                    initialValue: [],
                    in: {
                      $concatArrays: [
                        "$$value",
                        { $map: {
                            input: { $ifNull: ["$$this.education", []] },
                            as: "e",
                            in: { $toLower: { $ifNull: ["$$e.stream", ""] } },
                        }},
                      ],
                    },
                  },
                },
                educationStreams,
              ],
            },
          }, 0],
        }
      : { $literal: false };

    // Specialization match count expression
    // Matches user's specialization against job's eligibility.education[].specialization,
    // jobDomains, and searchKeywords — covers both structured and keyword-tagged jobs
    const specializationMatchExpr = normalizedSpecializations.length > 0
      ? {
          $size: {
            $setIntersection: [
              {
                $map: {
                  input: {
                    $concatArrays: [
                      { $map: { input: { $ifNull: ["$eligibility.education", []] }, as: "e", in: { $toLower: { $ifNull: ["$$e.specialization", ""] } } } },
                      { $ifNull: ["$jobDomains",      []] },
                      { $ifNull: ["$searchKeywords",  []] },
                    ],
                  },
                  as: "s", in: { $toLower: "$$s" },
                },
              },
              normalizedSpecializations,
            ],
          },
        }
      : { $literal: 0 };

    // Gender match: job breakup has vacancies for user's gender
    const genderMatchExpr = normalizedGender === "male"
      ? { $gt: [{ $size: { $filter: { input: { $ifNull: ["$vacancies.breakup", []] }, as: "b", cond: { $gt: [{ $ifNull: ["$$b.genderWise.male", 0] }, 0] } } } }, 0] }
      : normalizedGender === "female"
      ? { $gt: [{ $size: { $filter: { input: { $ifNull: ["$vacancies.breakup", []] }, as: "b", cond: { $gt: [{ $ifNull: ["$$b.genderWise.female", 0] }, 0] } } } }, 0] }
      : { $literal: false };

    // Exact state match bonus (state-specific job, not just All India)
    const exactStateMatchExpr = !wantsAllIndia && stateLocations.length > 0
      ? { $in: [{ $toLower: "$location" }, stateLocations] }
      : { $literal: false };

    // Category-specific vacancy match
    // Checks whether the job has at least one post with vacancies in user's category
    // GEN users get no targeted boost (GEN vacancies are implicit in all jobs)
    const categoryVacancyExpr = catVacField
      ? {
          $gt: [{
            $size: {
              $filter: {
                input: { $ifNull: ["$vacancies.breakup", []] },
                as: "b",
                cond: { $gt: [{ $ifNull: [`$$b.categoryWise.${catVacField}`, 0] }, 0] },
              },
            },
          }, 0],
        }
      : { $literal: false };

    // Selection process preference match
    // "written"   → job has CBT/OMR/Written stage but NO PET/Interview
    // "pet"       → job has PET/Physical/Medical stage
    // "interview" → job has Interview stage
    const selectionStages = { $ifNull: [
      { $map: { input: { $ifNull: ["$selectionProcess", []] }, as: "s",
          in: { $toLower: { $ifNull: ["$$s.stage", ""] } } } },
      [],
    ]};

    const selPrefMatchExpr =
      normalizedSelPref === "written"
        ? { $and: [
            { $not: { $in: ["pet",       selectionStages] } },
            { $not: { $in: ["interview", selectionStages] } },
          ]}
        : normalizedSelPref === "pet"
          ? { $in: ["pet", selectionStages] }
          : normalizedSelPref === "interview"
            ? { $in: ["interview", selectionStages] }
            : { $literal: false }; // "any" → no scoring signal

    const jobs = await JobsSchemaDatas.aggregate([

      // ── Hard filter ──────────────────────────────────────────────────────────
      { $match: hardMatch },

      // ── Compute soft signals ─────────────────────────────────────────────────
      {
        $addFields: {
          // How many of user's org types match job domains / tags / dept?
          orgMatchCount: {
            $size: {
              $setIntersection: [
                { $map: {
                    input: { $concatArrays: [
                      { $ifNull: ["$jobDomains", []] },
                      { $ifNull: ["$tags", []] },
                      [{ $ifNull: ["$conductingBody", ""] }],
                      [{ $ifNull: ["$department", ""] }],
                    ]},
                    as: "o", in: { $toLower: "$$o" },
                }},
                normalizedOrgTypes.length > 0 ? normalizedOrgTypes : NO_MATCH,
              ],
            },
          },

          // How many of user's interests match job tags / keywords / domains?
          interestMatchCount: {
            $size: {
              $setIntersection: [
                { $map: {
                    input: { $concatArrays: [
                      { $ifNull: ["$tags", []] },
                      { $ifNull: ["$searchKeywords", []] },
                      { $ifNull: ["$jobDomains", []] },
                    ]},
                    as: "t", in: { $toLower: "$$t" },
                }},
                normalizedInterests.length > 0 ? normalizedInterests : NO_MATCH,
              ],
            },
          },

          specializationMatchCount: specializationMatchExpr,
          hasCategoryVacancy:  categoryVacancyExpr,
          selPrefMatch:        selPrefMatchExpr,
          eduStreamMatch:      eduStreamMatchExpr,
          hasGenderVacancy:    genderMatchExpr,
          isExactStateMatch:   exactStateMatchExpr,

          // Age match: job's NUMBER-based age criteria fits user's age (with category relaxation)
          // Soft bonus only — never excludes a job. Buffer for relaxations already applied.
          ageMatch: userAge !== null ? {
            $cond: {
              if: {
                $or: [
                  // No NUMBER-based criteria → assume open/unspecified → neutral
                  { $ne: ["$ageCriteria.type", "NUMBER"] },
                  { $not: { $ifNull: ["$ageCriteria.numberBased", false] } },
                  // User's age is within the allowed range (+ category relaxation buffer)
                  {
                    $and: [
                      { $lte: [{ $ifNull: ["$ageCriteria.numberBased.min", 0] },  userAge] },
                      { $gte: [{ $add:  [{ $ifNull: ["$ageCriteria.numberBased.max", 99] }, categoryRelaxation] }, userAge] },
                    ],
                  },
                ],
              },
              then: 1,  // age-eligible: boost slightly
              else: 0,  // over-age (no penalty, hard block not applied)
            },
          } : { $literal: 1 },  // unknown age → treat as eligible
        },
      },

      // ── Relevance score ──────────────────────────────────────────────────────
      // Scoring guide:
      //   Org type match        : 15 pts × count, max 40  (primary signal)
      //   Interest match        : 10 pts × count, max 35  (secondary signal)
      //   Exact state           : 20 pts bonus             (prefer state-specific over All-India)
      //   Age match             : 12 pts bonus             (user within job age limit)
      //   Specialization        : 12 pts × count, max 24  (branch-specific technical jobs)
      //   Category vacancy      : 18 pts bonus             (job has vacancies in user's category)
      //   Selection preference  : 15 pts bonus             (written/PET/interview match)
      //   Gender vacancy        : 10 pts bonus
      //   Edu stream            : 10 pts bonus
      {
        $addFields: {
          relevanceScore: {
            $add: [
              { $min: [{ $multiply: ["$orgMatchCount",           15] }, 40] },
              { $min: [{ $multiply: ["$interestMatchCount",      10] }, 35] },
              { $cond: ["$isExactStateMatch",   20, 0] },
              { $cond: ["$hasCategoryVacancy",  18, 0] },
              { $cond: [{ $eq: ["$ageMatch", 1] }, 12, 0] },
              { $min: [{ $multiply: ["$specializationMatchCount", 12] }, 24] },
              { $cond: ["$selPrefMatch",        15, 0] },
              { $cond: ["$hasGenderVacancy",    10, 0] },
              { $cond: ["$eduStreamMatch",      10, 0] },
            ],
          },
        },
      },

      // ── Sort: best match first, then soonest-closing ─────────────────────────
      { $sort: { relevanceScore: -1, "importantDates.applyEnd": 1, updatedAt: -1 } },

      // ── Limit ────────────────────────────────────────────────────────────────
      { $limit: 30 },

      // ── Project ──────────────────────────────────────────────────────────────
      {
        $project: {
          _id: 1, title: 1, urlTitle: 1, conductingBody: 1, location: 1, jobDomains: 1,
          "vacancies.total": 1,
          "importantDates.applyStart": 1,
          "importantDates.applyEnd":   1,
          relevanceScore: 1,
        },
      },
    ]);

    return res.status(200).json({ status: "success", count: jobs.length, data: jobs });

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
}