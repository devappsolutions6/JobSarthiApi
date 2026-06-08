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
      userMaxEduRank,
      dob
    } = normalizedProfile;

    const targets = job.recommendationTargets;
    
    // If the job hasn't been migrated yet, skip it (or fallback to old logic, but migration handles this)
    if (!targets) return null;

    // Job location is lowercase in DB after migration — direct compare
    const jobLocation = String(job.location || "all india").toLowerCase();

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 1 — HARD MATCH (Eligibility Filter)
    // ═══════════════════════════════════════════════════════════════════════════

    // A. Education filter (Direct Rank Comparison)
    if (userMaxEduRank < targets.minEducationRank) return null;

    // B. Location filter
    let isLocEligible = false;
    if (wantsAllIndia || jobLocation === "all india") {
      isLocEligible = true;
    } else {
      isLocEligible = stateLocations.some(prefLoc => jobLocation.includes(prefLoc));
    }
    if (!isLocEligible) return null;

    // C. Organization filter
    if (organizationTypes.length > 0 && targets.organizationTypes && targets.organizationTypes.length > 0) {
      const orgMatch = targets.organizationTypes.some(t => organizationTypes.includes(t));
      if (!orgMatch) return null;
    }

    // D. Selection preference filter
    if (selectionPreference === "written" && (targets.selectionFlags.hasPhysicalTest || targets.selectionFlags.hasInterview)) return null;
    if (selectionPreference === "pet" && targets.selectionFlags.hasPhysicalTest === false) return null;
    if (selectionPreference === "interview" && targets.selectionFlags.hasInterview === false) return null;

    // ═══════════════════════════════════════════════════════════════════════════
    //  STAGE 2 — SOFT SCORING (Weighted Token Matching)
    // ═══════════════════════════════════════════════════════════════════════════

    let score = 0;

    // 1. Org Match
    const orgMatchCount = targets.organizationTypes ? targets.organizationTypes.filter(t => organizationTypes.includes(t)).length : 0;
    score += Math.min(orgMatchCount * 15, 40);

    // 2. Interest / Roles Match
    const roleMatchCount = targets.roles ? targets.roles.filter(t => interests.includes(t)).length : 0;
    score += Math.min(roleMatchCount * 10, 35);

    // 3. Exact State Match
    const isExactStateMatch = !wantsAllIndia && stateLocations.includes(jobLocation);
    if (isExactStateMatch) score += 20;

    // 4. Category Vacancy Match
    if (catVacField && targets.categories && targets.categories.includes(catVacField)) {
      score += 18;
    }

    // 5. Age Match
    if (dob) {
      // Calculate exact age based on the job's official cutoff date
      const asOnDate = targets.age.asOnDate ? new Date(targets.age.asOnDate) : new Date();
      const userAgeAsOnDate = Math.floor((asOnDate - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
      
      let maxAllowed = targets.age.maxGen;
      if (["obc"].includes(userCategory)) maxAllowed = targets.age.maxObc;
      if (["sc", "st"].includes(userCategory)) maxAllowed = targets.age.maxScSt;
      
      if (userAgeAsOnDate >= targets.age.min && userAgeAsOnDate <= maxAllowed) {
        score += 12;
      }
    }

    // 6. Specialization Match
    if (targets.eligibleSpecializations) {
      const specMatchCount = targets.eligibleSpecializations.filter(js => specializations.some(us => js.includes(us) || us.includes(js))).length;
      score += Math.min(specMatchCount * 12, 24);
    }

    // 7. Selection Process Score
    if (selectionPreference === "written" && !targets.selectionFlags.hasPhysicalTest && !targets.selectionFlags.hasInterview) score += 15;
    if (selectionPreference === "pet" && targets.selectionFlags.hasPhysicalTest) score += 15;
    if (selectionPreference === "interview" && targets.selectionFlags.hasInterview) score += 15;

    // 8. Gender Match
    if ((gender === "male" || gender === "female") && targets.genders && targets.genders.includes(gender)) {
      score += 10;
    }

    // 9. Stream Match
    if (educationStreams.length > 0 && targets.eligibleStreams) {
      const streamMatch = targets.eligibleStreams.some(js => 
        educationStreams.some(us => js.includes(us) || us.includes(js))
      );
      if (streamMatch) score += 10;
    }

    return {
      jobId: job._id,
      title: job.title,
      slug: job.urlTitle,
      location: job.location,
      organization: job.conductingBody || job.organization || "",
      applyEnd: (() => {
        const d = job.importantDates?.applyEnd?.date
          ? new Date(job.importantDates.applyEnd.date)
          : (job.importantDates?.applyEnd instanceof Date ? job.importantDates.applyEnd : null);
        return d && !isNaN(new Date(d).getTime()) ? new Date(d) : null;
      })(),
      salaryMin: job.salaryRange?.min || null,
      salaryMax: job.salaryRange?.max || null,
      vacancies: {
        total: job.vacancies?.total || 0,
      },
      score: score,
      matchedOn: ["education", "location", "interest"].filter((reason) => {
        if (reason === "education") return true;
        if (reason === "location" && job.location) return true;
        if (reason === "interest" && targets.roles?.length > 0) return true;
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
    const activeJobs = await Job.find().lean();
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

    const userProfile = {
      education: user.education || { levels: [], stream: [], specialization: [] },
      preferredLocations: user.preferredLocations || ["all india"],
      organizationTypes: user.organizationTypes || [],
      interests: user.interests || [],
      gender: user.gender || "any",
      dob: user.dob || null,
      category: user.category || "",
      selectionPreference: user.selectionPreference || "any",
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
      applyEnd: (() => {
        const d = job.importantDates?.applyEnd?.date
          ? new Date(job.importantDates.applyEnd.date)
          : (job.importantDates?.applyEnd instanceof Date ? job.importantDates.applyEnd : null);
        return d && !isNaN(new Date(d).getTime()) ? new Date(d) : null;
      })(),
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
        const affectedUsers = await User.find({
          $or: [
            { interests: { $in: job.jobDomains || [] } },
            { preferredLocations: job.location }
          ]
        }).lean();

        console.log(`⚡ [Recommendations] Processing job "${job.title}" for ${affectedUsers.length} affected user profiles...`);
        
        const bulkOps = []; // Collect operations for high-performance bulkWrite

        for (const user of affectedUsers) {
          const userProfile = {
            education: user.education || { levels: [], stream: [], specialization: [] },
            preferredLocations: user.preferredLocations || ["all india"],
            organizationTypes: user.organizationTypes || [],
            interests: user.interests || [],
            gender: user.gender || "any",
            dob: user.dob || null,
            category: user.category || "",
            selectionPreference: user.selectionPreference || "any",
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

            // Real-time Push Notification dispatch to matching registered user
            try {
              const NotificationSubscription = require("../models/NotificationSubscription");
              const fcmService = require("./fcmService");
              const { getJobNotificationImage } = require("../utils/categoryImages");
              
              const userSubscriptions = await NotificationSubscription.find({ userId: user._id, isActive: true }).lean();
              const jobImage = getJobNotificationImage(job);
              
              for (const sub of userSubscriptions) {
                await fcmService.sendPushNotification(sub.fcmToken, {
                  title: "New Job Alert Matching Your Profile! 🔔",
                  body: `${job.title} has just been announced at ${job.organization || "JobSarthi"}. Tap to see eligibility and apply!`,
                  icon: "https://www.aspirantcareer.in/icons/icon-192.png",
                  image: jobImage,
                  clickAction: `http://localhost:3000/details/${job.slug || job.urlTitle}/${job._id}`,
                  data: { jobId: job._id.toString() },
                  userId: user._id
                });
              }
            } catch (pushErr) {
              console.error(`⚠️ Failed to send push notification to user ${user._id}:`, pushErr.message);
            }
          }
        }
        
        // Real-time Push Notification dispatch to all guest/anonymous subscribers
        try {
          const NotificationSubscription = require("../models/NotificationSubscription");
          const fcmService = require("./fcmService");
          const { getJobNotificationImage } = require("../utils/categoryImages");
          
          const guestSubscriptions = await NotificationSubscription.find({ userId: null, isActive: true }).lean();
          const jobImage = getJobNotificationImage(job);
          
          for (const sub of guestSubscriptions) {
            await fcmService.sendPushNotification(sub.fcmToken, {
              title: "New Job Announcement! 🔔",
              body: `${job.title} has just been posted. Tap to check your eligibility now!`,
              icon: "https://www.aspirantcareer.in/icons/icon-192.png",
              image: jobImage,
              clickAction: `http://localhost:3000/details/${job.slug || job.urlTitle}/${job._id}`,
              data: { jobId: job._id.toString() }
            });
          }
        } catch (guestPushErr) {
          console.error("⚠️ Failed to send push notifications to guest subscribers:", guestPushErr.message);
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
