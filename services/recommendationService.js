const mongoose = require("mongoose");
const Job = require("../models/Job");

// Centralized education ranks imported from educationHelper — only EDUCATION_RANKS needed
// since all levelCodes are standard codes post-migration (no fallback maps required)
const { EDUCATION_RANKS: educationRank } = require("../utils/educationHelper");

class RecommendationService {
  // Helper to normalize user preferences exactly once before running matching loops.
  // All token fields (organizationTypes, interests, preferredLocations, stream, specialization)
  // are stored lowercase after DB migration — no runtime casing needed here.
  normalizeUserProfile(profile) {
    const {
      education = { levels: [], stream: [], specialization: [] },
      preferredLocations = ["all india"],
      organizationTypes = [],
      interests = [],
      gender = "any",
      dob = null,
      category: userCategory = "",
      selectionPreference = "any",
    } = profile;

    const wantsAllIndia = preferredLocations.length === 0 || preferredLocations.includes("all india");
    const stateLocations = preferredLocations.filter(l => l !== "all india");

    const today = new Date();
    const cat = (userCategory || "").toLowerCase();
    const categoryRelaxation = cat === "sc" || cat === "st" ? 5 : cat === "obc" ? 3 : 0;

    const userAge = dob
      ? Math.floor((today - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const educationLevels = education.levels || [];
    const userMaxEduRank = educationLevels.reduce(
      (max, lvl) => Math.max(max, educationRank[lvl] || 0), 0
    );

    return {
      educationLevels,
      educationStreams: education.stream || [],
      specializations: education.specialization || [],
      preferredLocations,
      wantsAllIndia,
      stateLocations,
      organizationTypes,
      interests,
      gender: (gender || "any").toLowerCase(),
      dob: dob || null,
      userCategory: cat,
      selectionPreference: (selectionPreference || "any").toLowerCase(),
      catVacField: ["obc", "sc", "st", "ews"].includes(cat) ? cat : null,
      categoryRelaxation,
      userAge,
      userMaxEduRank,
    };
  }

  // Score a single job against a pre-normalized user profile. Returns scored job object or null if not eligible.
  scoreSingleJobForProfile(job, normalizedProfile) {
    const {
      educationLevels,
      educationStreams,
      specializations,
      preferredLocations,
      wantsAllIndia,
      stateLocations,
      organizationTypes,
      interests,
      gender,
      userCategory,
      selectionPreference,
      catVacField,
      categoryRelaxation,
      userAge,
      userMaxEduRank,
    } = normalizedProfile;

    // Job location is lowercase in DB after migration — direct compare
    const jobLocation = (job.location || "all india");

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 1 — HARD MATCH (Eligibility Filter)
    // ═══════════════════════════════════════════════════════════════════════════

    // A. Education filter
    let isEduEligible = false;
    if (!job.eligibility?.posts || job.eligibility.posts.length === 0) {
      isEduEligible = true; // Open to all
    } else {
      for (const post of job.eligibility.posts) {
        if (!post.education || post.education.length === 0) {
          isEduEligible = true;
          break;
        }
        for (const edu of post.education) {
          // levelCode is always a standard code in DB — direct lookup, no fallback needed
          const requiredRank = educationRank[edu.levelCode] || 0;
          if (requiredRank === 0 || userMaxEduRank >= requiredRank) {
            isEduEligible = true;
            break;
          }
        }
        if (isEduEligible) break;
      }
    }

    if (!isEduEligible) return null;

    // B. Location filter — jobLocation and preferredLocations are both lowercase
    let isLocEligible = false;
    if (wantsAllIndia || jobLocation === "all india") {
      isLocEligible = true;
    } else {
      isLocEligible = stateLocations.some(prefLoc => jobLocation.includes(prefLoc));
    }

    if (!isLocEligible) return null;

    // C. Organization/Domains filter — jobDomains and tags are lowercase in DB
    let isOrgEligible = true;
    if (organizationTypes.length > 0) {
      const jobTokens = [
        ...(job.jobDomains || []),
        ...(job.tags || []),
        job.conductingBody?.toLowerCase(),
        job.department?.toLowerCase(),
      ].filter(Boolean);

      isOrgEligible = organizationTypes.some(prefOrg =>
        jobTokens.some(jobToken => jobToken.includes(prefOrg))
      );
    }

    if (!isOrgEligible) return null;

    // D. Selection preference filter
    const stages = (job.selectionProcess || []).map(s => (s.stage || "").toLowerCase());
    let isSelEligible = true;
    if (selectionPreference === "written") {
      const hasPhysical = stages.some(s => /pet|physical|medical/i.test(s));
      const hasInterview = stages.some(s => /interview/i.test(s));
      if (hasPhysical || hasInterview) isSelEligible = false;
    } else if (selectionPreference === "pet") {
      isSelEligible = stages.some(s => /pet|physical|medical/i.test(s));
    } else if (selectionPreference === "interview") {
      isSelEligible = stages.some(s => /interview/i.test(s));
    }

    if (!isSelEligible) return null;

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 2 — SOFT SCORING (Weighted Token Matching)
    // ═══════════════════════════════════════════════════════════════════════════

    // 1. Org Match — jobDomains/tags are lowercase, organizationTypes are lowercase
    const jobOrgTokens = [
      ...(job.jobDomains || []),
      ...(job.tags || []),
      job.conductingBody?.toLowerCase(),
      job.department?.toLowerCase(),
    ].filter(Boolean);
    const orgMatchCount = new Set(jobOrgTokens.filter(t => organizationTypes.includes(t))).size;
    const orgScore = Math.min(orgMatchCount * 15, 40);

    // 2. Interest Match — tags/searchKeywords/jobDomains are lowercase, interests are lowercase
    const jobInterestTokens = [
      ...(job.tags || []),
      ...(job.searchKeywords || []),
      ...(job.jobDomains || []),
    ].filter(Boolean);
    const interestMatchCount = new Set(jobInterestTokens.filter(t => interests.includes(t))).size;
    const interestScore = Math.min(interestMatchCount * 10, 35);

    // 3. Exact State Match
    const isExactStateMatch = !wantsAllIndia && stateLocations.includes(jobLocation);
    const locationScore = isExactStateMatch ? 20 : 0;

    // 4. Category Vacancy Match
    let categoryScore = 0;
    if (catVacField && Array.isArray(job.vacancies?.breakup)) {
      const hasCatVacancy = job.vacancies.breakup.some(p =>
        p.categoryWise && p.categoryWise[catVacField] > 0
      );
      if (hasCatVacancy) categoryScore = 18;
    }

    // 5. Age Match
    let ageScore = 12;
    if (userAge !== null && job.ageCriteria?.numberBased) {
      const minAge = job.ageCriteria.numberBased.min || 0;
      const maxAge = (job.ageCriteria.numberBased.max || 99) + categoryRelaxation;
      if (userAge < minAge || userAge > maxAge) ageScore = 0;
    }

    // 6. Specialization Match — edu.specialization is lowercase in DB, specializations are lowercase
    const jobSpecializations = (job.eligibility?.posts || [])
      .flatMap(p => (p.education || []).map(e => e.specialization))
      .filter(Boolean);
    const specializationScore = Math.min(
      new Set(jobSpecializations.filter(s => specializations.includes(s))).size * 12, 24
    );

    // 7. Selection Process Score
    let selectionScore = 0;
    if (selectionPreference === "written") {
      if (!stages.some(s => /pet|physical|medical/i.test(s)) && !stages.some(s => /interview/i.test(s))) {
        selectionScore = 15;
      }
    } else if (selectionPreference === "pet" && stages.some(s => /pet|physical|medical/i.test(s))) {
      selectionScore = 15;
    } else if (selectionPreference === "interview" && stages.some(s => /interview/i.test(s))) {
      selectionScore = 15;
    }

    // 8. Gender Match
    let genderScore = 0;
    if (gender === "male" || gender === "female") {
      const hasGenderVacancy = (job.vacancies?.breakup || []).some(p =>
        p.genderWise && p.genderWise[gender] > 0
      );
      if (hasGenderVacancy) genderScore = 10;
    }

    // 9. Stream Match — edu.stream is lowercase in DB, educationStreams are lowercase
    let streamScore = 0;
    if (educationStreams.length > 0) {
      const jobStreams = (job.eligibility?.posts || [])
        .flatMap(p => (p.education || []).map(e => e.stream))
        .filter(Boolean);
      if (jobStreams.some(s => educationStreams.includes(s))) streamScore = 10;
    }

    const relevanceScore = orgScore + interestScore + locationScore + categoryScore + ageScore + specializationScore + selectionScore + genderScore + streamScore;

    return {
      jobId: job._id,
      title: job.title,
      slug: job.urlTitle,
      location: job.location,
      organization: job.conductingBody || job.organization || "",
      applyEnd: job.importantDates?.applyEnd?.date
        ? new Date(job.importantDates.applyEnd.date)
        : (job.importantDates?.applyEnd instanceof Date ? job.importantDates.applyEnd : null),
      salaryMin: job.salaryRange?.min || null,
      salaryMax: job.salaryRange?.max || null,
      vacancies: {
        total: job.vacancies?.total || 0,
      },
      score: relevanceScore,
      matchedOn: ["education", "location", "interest"].filter((reason) => {
        if (reason === "education" && job.eligibility?.posts?.length > 0) return true;
        if (reason === "location" && job.location) return true;
        if (reason === "interest" && job.jobDomains?.length > 0) return true;
        return false;
      }),
      generatedAt: new Date(),
    };
  }

  // Pure JavaScript In-Memory Matching & Token-Based Scoring Engine
  async getRecommendedJobs(user) {
    const {
      education = { levels: [], stream: [], specialization: [] },
      interests = [],
      organizationTypes = [],
    } = user;

    // Check if user has actually provided any info (beyond defaults)
    const hasData = education?.levels?.length > 0 || 
                    interests?.length > 0 || 
                    organizationTypes?.length > 0;

    if (!hasData) {
      return [];
    }

    // Normalize user profile exactly once
    const normalizedProfile = this.normalizeUserProfile(user);

    // High performance read-only lean query
    const activeJobs = await Job.find({ isActive: true }).lean();
    const scoredJobs = [];

    for (const job of activeJobs) {
      const scored = this.scoreSingleJobForProfile(job, normalizedProfile);
      if (scored) {
        scoredJobs.push({
          _id: scored.jobId,
          title: scored.title,
          urlTitle: scored.slug,
          conductingBody: scored.organization,
          location: scored.location,
          eligibility: job.eligibility,
          importantDates: job.importantDates,
          salaryRange: job.salaryRange,
          vacancies: job.vacancies,
          relevanceScore: scored.score
        });
      }
    }

    // Sort by relevanceScore descending, then by importantDates.applyEnd.date ascending
    return scoredJobs.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      const aEnd = a.importantDates?.applyEnd?.date || a.importantDates?.applyEnd;
      const bEnd = b.importantDates?.applyEnd?.date || b.importantDates?.applyEnd;
      if (aEnd && bEnd) return new Date(aEnd) - new Date(bEnd);
      return 0;
    });
  }

  // Generate / Overwrite recommendation list snapshot for exactly one user contactId
  async recomputeUserRecommendations(userIdOrContactId) {
    const { User, UserPreference, UserRecommendation } = require("../models");

    let user = null;
    if (mongoose.Types.ObjectId.isValid(userIdOrContactId)) {
      user = await User.findById(userIdOrContactId).lean();
    }
    if (!user) {
      user = await User.findOne({ contactId: userIdOrContactId }).lean();
    }

    if (!user) {
      console.log(`⚠️ User not found for recommendations: ${userIdOrContactId}`);
      return;
    }

    const userId = user._id;
    const contactId = user.contactId || user.email || user._id.toString();

    // Fetch user preferences
    const pref = await UserPreference.findOne({ userId }).lean();

    const userProfile = {
      education: user.education || { levels: [], stream: [], specialization: [] },
      preferredLocations: pref?.preferredLocations || ["all india"],
      organizationTypes: pref?.organizationTypes || [],
      interests: pref?.interests || [],
      gender: user.gender || "any",
      dob: user.dob || null,
      category: user.category || "",
      selectionPreference: pref?.selectionPreference || "any",
    };

    // Calculate recommendations in pure Node JS memory
    const recommendedJobs = await this.getRecommendedJobs(userProfile);

    // Compile active preference choices snapshot
    const preferencesSnapshot = {
      educationLevels: userProfile.education.levels || [],
      educationStreams: userProfile.education.stream || [],
      specializations: userProfile.education.specialization || [],
      preferredLocations: userProfile.preferredLocations || [],
      category: userProfile.category || "",
      gender: userProfile.gender || "any",
      organizationTypes: userProfile.organizationTypes || [],
      interests: userProfile.interests || [],
      selectionPreference: userProfile.selectionPreference || "any",
      dob: userProfile.dob || null,
    };

    // If no recommendations are eligible, update overview with the preferences snapshot but an empty recommendations array
    if (!recommendedJobs || recommendedJobs.length === 0) {
      await UserRecommendation.updateOne(
        { userId },
        {
          $set: {
            contactId,
            preferences: preferencesSnapshot,
            recommendations: [],
            lastComputedAt: new Date()
          }
        },
        { upsert: true }
      );
      return;
    }

    // Map snapshots
    const recommendations = recommendedJobs.map((job) => ({
      jobId: job._id,
      title: job.title,
      slug: job.urlTitle,
      location: job.location,
      organization: job.conductingBody || job.organization || "",
      applyEnd: job.importantDates?.applyEnd?.date
        ? new Date(job.importantDates.applyEnd.date)
        : (job.importantDates?.applyEnd instanceof Date ? job.importantDates.applyEnd : null),
      salaryMin: job.salaryRange?.min || null,
      salaryMax: job.salaryRange?.max || null,
      vacancies: {
        total: job.vacancies?.total || 0,
      },
      score: job.relevanceScore || 0,
      matchedOn: ["education", "location", "interest"].filter((reason) => {
        if (reason === "education" && job.eligibility?.posts?.length > 0) return true;
        if (reason === "location" && job.location) return true;
        if (reason === "interest" && job.jobDomains?.length > 0) return true;
        return false;
      }),
      generatedAt: new Date(),
    }));

    // Upsert exactly one overview document per user
    await UserRecommendation.updateOne(
      { userId },
      {
        $set: {
          contactId,
          preferences: preferencesSnapshot,
          recommendations,
          lastComputedAt: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`✅ Pre-computed ${recommendations.length} recommendations sheet in JS memory for user: ${contactId}`);
  }

  // Seeding/migration-triggered precompute worker for all registered users
  async recomputeAllUsersRecommendations(force = false) {
    const { User, UserRecommendation, UserPreference, Job } = require("../models");
    
    // 1. Auto-Deactivation: Mark naturally expired jobs in the master collection as inactive
    const deactivationResult = await Job.updateMany(
      { isActive: true, "importantDates.applyEnd.date": { $lt: new Date() } },
      { $set: { isActive: false } }
    );
    if (deactivationResult.modifiedCount > 0) {
      console.log(`🔒 [Recommendations] Auto-Deactivation: Marked ${deactivationResult.modifiedCount} expired jobs as inactive in master collection.`);
    }

    // 2. Global Background Garbage Collection: Purge expired/deactivated jobs from ALL caches
    const inactiveOrExpiredJobs = await Job.find({
      $or: [
        { isActive: false },
        { "importantDates.applyEnd.date": { $lt: new Date() } }
      ]
    }, { _id: 1 }).lean();
    
    if (inactiveOrExpiredJobs.length > 0) {
      const deadJobIds = inactiveOrExpiredJobs.map(j => j._id);
      await UserRecommendation.updateMany(
        {},
        { $pull: { recommendations: { jobId: { $in: deadJobIds } } } }
      );
      console.log(`🧹 [Recommendations] Garbage Collection: Purged ${deadJobIds.length} inactive/expired jobs from all user caches.`);
    }

    // Dirty-flag precomputation check: only calculate if new/unprocessed jobs exist (or if force = true)
    if (!force) {
      const unprocessedJobs = await Job.find({ isRecommendationProcessed: false, isActive: true }).lean();
      if (unprocessedJobs.length === 0) {
        console.log("ℹ️ [Recommendations] All user recommendation feeds are already up to date. No new jobs to process.");
        return;
      }

      console.log(`🔍 [Recommendations] Found ${unprocessedJobs.length} unprocessed jobs. Running Segmented Recalculation & Incremental Pushing...`);
      
      let processedJobsCount = 0;
      for (const job of unprocessedJobs) {
        // Approach 2: Query only the subset of users whose preferences overlap with this job's domains or location
        const affectedPreferences = await UserPreference.find({
          $or: [
            { interests: { $in: job.jobDomains || [] } },
            { preferredLocations: job.location }
          ]
        }).lean();

        console.log(`⚡ [Recommendations] Processing job "${job.title}" for ${affectedPreferences.length} affected user profiles...`);
        
        const bulkOps = []; // Collect operations for high-performance bulkWrite

        for (const pref of affectedPreferences) {
          const user = await User.findById(pref.userId).lean();
          if (!user) continue;

          const userProfile = {
            education: user.education || { levels: [], stream: [], specialization: [] },
            preferredLocations: pref.preferredLocations || ["all india"],
            organizationTypes: pref.organizationTypes || [],
            interests: pref.interests || [],
            gender: user.gender || "any",
            dob: user.dob || null,
            category: user.category || "",
            selectionPreference: pref.selectionPreference || "any",
          };

          // Normalize profile exactly once for this user
          const normalizedProfile = this.normalizeUserProfile(userProfile);

          // Run single job scorer
          const scoredJobSnapshot = this.scoreSingleJobForProfile(job, normalizedProfile);
          
          if (scoredJobSnapshot) {
            const contactIdStr = user.contactId || user.email || user._id.toString();
            
            // Operation 1: Pull existing job (prevents duplicates entirely)
            bulkOps.push({
              updateOne: {
                filter: { userId: user._id },
                update: { $pull: { recommendations: { jobId: job._id } } }
              }
            });

            // Operation 2: Push fresh snapshot, sort, and slice
            bulkOps.push({
              updateOne: {
                filter: { userId: user._id },
                update: {
                  $set: { contactId: contactIdStr, lastComputedAt: new Date() },
                  $push: {
                    recommendations: {
                      $each: [scoredJobSnapshot],
                      $sort: { score: -1 },
                      $slice: 100
                    }
                  }
                },
                upsert: true
              }
            });
          }
        }
        
        // Execute all pull/push operations in a single database roundtrip!
        if (bulkOps.length > 0) {
          await UserRecommendation.bulkWrite(bulkOps, { ordered: false });
        }

        // Reset dirty flag using high performance updateOne (since we used .lean())
        await Job.updateOne(
          { _id: job._id },
          { $set: { isRecommendationProcessed: true } }
        );
        processedJobsCount++;
      }

      console.log(`🎉 [Recommendations] Success processing ${processedJobsCount} new jobs incrementally.`);
      return;
    }

    // Full forced recalculation sweep (warm start on server boot / DB optimize)
    console.log("⚡ [Recommendations] Forced global recalculation triggered. Purging database cache...");
    await UserRecommendation.deleteMany({});
    console.log("🧹 [Recommendations] Cleared all legacy recommendation documents from the database.");

    const allUsers = await User.find({}).lean();
    console.log(`⚡ [Recommendations] Pre-computing via In-Memory Engine for all ${allUsers.length} users...`);

    let successCount = 0;
    for (const user of allUsers) {
      try {
        await this.recomputeUserRecommendations(user._id);
        successCount++;
      } catch (err) {
        console.error(`❌ Failed to pre-compute for user ${user.contactId || user._id}:`, err);
      }
    }

    // Reset dirty flag for all active jobs
    await Job.updateMany(
      { isRecommendationProcessed: false },
      { $set: { isRecommendationProcessed: true } }
    );

    console.log(`🎉 [Recommendations] Success pre-computing ${successCount}/${allUsers.length} user recommendations caches.`);
  }
}

module.exports = new RecommendationService();
