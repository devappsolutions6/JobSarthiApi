const mongoose = require("mongoose");
const Job = require("../models/Job");
const { EDUCATION_RANKS: educationRank } = require("../utils/educationHelper");

class RecommendationService {
  normalizeUserProfile(profile) {
    const {
      education = { levels: [], streamCodes: [], percentage: null, isFinalYearStudent: false },
      preferredLocations = ["ALL_INDIA"],
      domicileState = "ALL_INDIA",
      organizationTypes = [],
      interests = [],
      gender = "ANY",
      maritalStatus = "UNMARRIED",
      dob = null,
      category: userCategory = "UR",
      selectionPreference = "any",
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
      experienceStatus = "FRESHER"
    } = profile;

    const wantsAllIndia = preferredLocations.length === 0 || preferredLocations.includes("ALL_INDIA");
    const educationLevels = education.levels || [];
    const userMaxEduRank = educationLevels.reduce((max, lvl) => Math.max(max, educationRank[lvl] || 0), 0);
    const cat = (userCategory || "UR").toUpperCase();

    return {
      educationLevels,
      streamCodes: education.streamCodes || [],
      percentage: education.percentage || 0,
      isFinalYearStudent: education.isFinalYearStudent || false,
      preferredLocations,
      domicileState,
      wantsAllIndia,
      organizationTypes,
      interests,
      gender: (gender || "ANY").toUpperCase(),
      maritalStatus: (maritalStatus || "UNMARRIED").toUpperCase(),
      dob: dob || null,
      userCategory: cat,
      selectionPreference: (selectionPreference || "any").toLowerCase(),
      catVacField: ["OBC", "SC", "ST", "EWS"].includes(cat) ? cat : null,
      userMaxEduRank,
      isPwD, pwdCategory, isExServiceman, yearsOfService, isDepartmentalCandidate,
      isSportsperson, nccCertificate, pastUPSCAttempts, hasTypingSkill, hasShorthandSkill,
      experienceStatus: (experienceStatus || "FRESHER").toUpperCase()
    };
  }

  scoreSingleJobForProfile(job, normalizedProfile) {
    const {
      streamCodes, percentage, isFinalYearStudent,
      preferredLocations, domicileState, wantsAllIndia,
      organizationTypes, interests, gender, maritalStatus,
      userCategory, selectionPreference, catVacField,
      userMaxEduRank, dob, isPwD, isExServiceman, yearsOfService,
      isDepartmentalCandidate, isSportsperson, nccCertificate,
      pastUPSCAttempts, hasTypingSkill, hasShorthandSkill, experienceStatus
    } = normalizedProfile;

    const targets = job.recommendationTargets;
    if (!targets) return null;

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 1 — ABSOLUTE HARD FILTERS (O(1) Enums)
    // ═══════════════════════════════════════════════════════════════════════════

    if (userMaxEduRank < targets.minEducationRank) return null;
    if (job.eligibility?.experience?.required && experienceStatus === "FRESHER") return null;
    if (gender !== "ANY" && targets.genders && targets.genders.length > 0 && !targets.genders.includes(gender)) return null;
    if (job.maritalStatusAllowed && job.maritalStatusAllowed.length > 0 && !job.maritalStatusAllowed.includes(maritalStatus)) return null;
    // Domicile / State eligibility check (disqualify non-domicile candidates for state jobs)
    const isStateJob = job.jobDomains && job.jobDomains.some(d => d && d.toLowerCase() === "state");
    if (isStateJob && domicileState && domicileState !== "ALL_INDIA") {
      const allowedStates = [];
      if (job.domicileRequired) allowedStates.push(job.domicileRequired.toUpperCase());
      if (job.locationCodes) job.locationCodes.forEach(loc => loc && allowedStates.push(loc.toUpperCase()));
      if (job.stateEligibility) job.stateEligibility.forEach(st => st && allowedStates.push(st.toUpperCase()));
      
      const userDomicile = domicileState.toUpperCase();
      if (allowedStates.length > 0 && !allowedStates.includes("ALL_INDIA") && !allowedStates.includes(userDomicile)) {
        return null; // Strict state eligibility failure
      }
    }
    if (job.domicileRequired && job.domicileRequired !== "ALL_INDIA" && job.domicileRequired !== domicileState) return null;
    if (job.eligibility?.minimumPercentageRequired && percentage < job.eligibility.minimumPercentageRequired) return null;
    if (isFinalYearStudent && !job.eligibility?.allowsFinalYearStudents) return null;
    if (job.eligibility?.requiresTyping && !hasTypingSkill) return null;
    if (job.eligibility?.requiresShorthand && !hasShorthandSkill) return null;

    // Selection Preference vs Job Flags
    if (selectionPreference === "written" && (targets.selectionFlags.hasPhysicalTest || targets.selectionFlags.hasInterview)) return null;
    if (selectionPreference === "pet" && targets.selectionFlags.hasPhysicalTest === false) return null;
    if (selectionPreference === "interview" && targets.selectionFlags.hasInterview === false) return null;

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 2 — CALENDAR EXACT AGE MATCH
    // ═══════════════════════════════════════════════════════════════════════════

    if (dob && targets.age?.asOnDate) {
      const asOnDate = new Date(targets.age.asOnDate);
      const birthDate = new Date(dob);
      
      let age = asOnDate.getFullYear() - birthDate.getFullYear();
      const m = asOnDate.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && asOnDate.getDate() < birthDate.getDate())) {
        age--;
      }

      if (isExServiceman) {
        age = age - yearsOfService - 3;
      } else if (isDepartmentalCandidate) {
        age = age - 5; 
      } else if (isPwD) {
        age = age - 10;
      }

      let maxAllowed = targets.age.maxGen;
      if (userCategory === "OBC") maxAllowed = targets.age.maxObc;
      if (userCategory === "SC" || userCategory === "ST") maxAllowed = targets.age.maxScSt;
      
      if (age < targets.age.min || age > maxAllowed) {
        return null; // Strict age failure
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 3 — HIGH SPEED ENUM SCORING
    // ═══════════════════════════════════════════════════════════════════════════

    let score = 0;

    const hasMatchingStream = targets.streamCodes && targets.streamCodes.some(code => streamCodes.includes(code));
    if (hasMatchingStream) score += 20;

    const hasMatchingLocation = targets.locationCodes && (targets.locationCodes.includes("ALL_INDIA") || targets.locationCodes.some(loc => preferredLocations.includes(loc)));
    if (hasMatchingLocation) score += 15;

    const orgMatchCount = targets.organizationTypes ? targets.organizationTypes.filter(t => organizationTypes.includes(t)).length : 0;
    score += Math.min(orgMatchCount * 15, 40);

    const roleMatchCount = targets.roles ? targets.roles.filter(t => interests.includes(t)).length : 0;
    score += Math.min(roleMatchCount * 10, 35);

    if (catVacField && targets.categories && targets.categories.includes(catVacField)) {
      score += 18;
    }

    if (nccCertificate === "C" && job.eligibility?.nccBonusAvailable) score += 10;
    if (isSportsperson && job.eligibility?.sportsQuotaAvailable) score += 10;

    return {
      jobId: job._id,
      title: job.title,
      slug: job.urlTitle,
      location: job.locationCodes && job.locationCodes.length > 0 ? job.locationCodes[0] : "ALL_INDIA",
      organization: job.conductingBody || job.organization || "",
      applyEnd: (() => {
        const d = job.importantDates?.applyEnd?.date ? new Date(job.importantDates.applyEnd.date) : null;
        return d && !isNaN(d.getTime()) ? d : null;
      })(),
      salaryMin: job.salaryRange?.min || null,
      salaryMax: job.salaryRange?.max || null,
      vacancies: { total: job.vacancies?.total || 0 },
      score: score,
      matchedOn: ["education", "location", "interest"].filter(reason => {
        if (reason === "education" && hasMatchingStream) return true;
        if (reason === "location" && hasMatchingLocation) return true;
        if (reason === "interest" && roleMatchCount > 0) return true;
        return false;
      }),
      generatedAt: new Date(),
    };
  }

  async getRecommendedJobs(user) {
    const hasData = user.education?.levels?.length > 0 || 
                    user.interests?.length > 0 || 
                    user.organizationTypes?.length > 0;

    if (!hasData) return [];

    const normalizedProfile = this.normalizeUserProfile(user);
    const activeJobs = await Job.find({ status: "active" }).lean();
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
          relevanceScore: scored.score,
          matchedOn: scored.matchedOn || []
        });
      }
    }

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

  async recomputeUserRecommendations(userIdOrContactId) {
    const { User, UserRecommendation } = require("../models");

    let user = null;
    if (mongoose.Types.ObjectId.isValid(userIdOrContactId)) {
      user = await User.findById(userIdOrContactId).lean();
    }
    if (!user) {
      user = await User.findOne({ contactId: userIdOrContactId }).lean();
    }

    if (!user) return;

    const userId = user._id;
    const contactId = user.contactId || user.email || user._id.toString();

    const recommendedJobs = await this.getRecommendedJobs(user);

    const preferencesSnapshot = {
      educationLevels: user.education?.levels || [],
      streamCodes: user.education?.streamCodes || [],
      preferredLocations: user.preferredLocations || [],
      category: user.category || "UR",
      gender: user.gender || "ANY",
      organizationTypes: user.organizationTypes || [],
      interests: user.interests || [],
      selectionPreference: user.selectionPreference || "any",
      dob: user.dob || null,
      experienceStatus: user.experienceStatus || "FRESHER"
    };

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

    const recommendations = recommendedJobs.map((job) => ({
      jobId: job._id,
      title: job.title,
      slug: job.urlTitle,
      location: job.location,
      organization: job.conductingBody || "",
      applyEnd: (() => {
        const d = job.importantDates?.applyEnd?.date ? new Date(job.importantDates.applyEnd.date) : null;
        return d && !isNaN(d.getTime()) ? d : null;
      })(),
      salaryMin: job.salaryRange?.min || null,
      salaryMax: job.salaryRange?.max || null,
      vacancies: { total: job.vacancies?.total || 0 },
      score: job.relevanceScore || 0,
      matchedOn: job.matchedOn || [],
      generatedAt: new Date(),
    }));

    await UserRecommendation.updateOne(
      { userId },
      { $set: { contactId, preferences: preferencesSnapshot, recommendations, lastComputedAt: new Date() } },
      { upsert: true }
    );
  }

  async recomputeAllUsersRecommendations(force = false) {
    const { User, UserRecommendation, Job } = require("../models");
    
    const deactivationResult = await Job.updateMany(
      { isActive: true, "importantDates.applyEnd.date": { $lt: new Date() } },
      { $set: { isActive: false } }
    );

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
    }

    if (!force) {
      const unprocessedJobs = await Job.find({ isRecommendationProcessed: false, isActive: true }).lean();
      if (unprocessedJobs.length === 0) return;

      for (const job of unprocessedJobs) {
        const affectedUsers = await User.find({
          $or: [
            { interests: { $in: job.jobDomains || [] } },
            { preferredLocations: { $in: job.locationCodes || ["ALL_INDIA"] } }
          ]
        }).lean();
        
        const bulkOps = [];
        for (const user of affectedUsers) {
          const normalizedProfile = this.normalizeUserProfile(user);
          const scoredJobSnapshot = this.scoreSingleJobForProfile(job, normalizedProfile);
          
          if (scoredJobSnapshot) {
            const contactIdStr = user.contactId || user.email || user._id.toString();
            bulkOps.push({
              updateOne: { filter: { userId: user._id }, update: { $pull: { recommendations: { jobId: job._id } } } }
            });
            bulkOps.push({
              updateOne: {
                filter: { userId: user._id },
                update: {
                  $set: { contactId: contactIdStr, lastComputedAt: new Date() },
                  $push: { recommendations: { $each: [scoredJobSnapshot], $sort: { score: -1 }, $slice: 100 } }
                },
                upsert: true
              }
            });
          }
        }
        
        if (bulkOps.length > 0) await UserRecommendation.bulkWrite(bulkOps, { ordered: false });
        await Job.updateOne({ _id: job._id }, { $set: { isRecommendationProcessed: true } });
      }
      return;
    }

    await UserRecommendation.deleteMany({});
    const allUsers = await User.find({}).lean();

    for (const user of allUsers) {
      try {
        await this.recomputeUserRecommendations(user._id);
      } catch (err) {
        console.error(`❌ Failed to pre-compute for user ${user.contactId || user._id}:`, err);
      }
    }

    await Job.updateMany({ isRecommendationProcessed: false }, { $set: { isRecommendationProcessed: true } });
  }
}

module.exports = new RecommendationService();
