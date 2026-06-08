require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const { EDUCATION_RANKS } = require("../utils/educationHelper");

// Helper mapping for legacy levelCodes
const LEVEL_CODE_MAP = {
  "GRADUATION": "EDU_GRAD",
  "POST_GRADUATION": "EDU_POSTGRAD",
  "INTERMEDIATE": "EDU_12TH",
  "MATRICULATION": "EDU_10TH",
  "DIPLOMA": "EDU_DIPLOMA",
  "EDU_GRAD": "EDU_GRAD",
  "EDU_POSTGRAD": "EDU_POSTGRAD",
  "EDU_12TH": "EDU_12TH",
  "EDU_10TH": "EDU_10TH",
  "EDU_DIPLOMA": "EDU_DIPLOMA",
  "EDU_ANY": "EDU_ANY"
};

// Helper mapping for organization types in recommendationTargets
const ORG_TYPES_MAP = {
  "police": "Police", "railway": "Railway", "banking": "Banking", "bank": "Banking",
  "defence": "Defence", "army": "Defence", "navy": "Defence", "air force": "Defence",
  "central": "Central", "state": "State", "teaching": "Teaching", "teacher": "Teaching",
  "psu": "PSU", "medical": "Medical", "health": "Medical", "engineering": "Engineering"
};

const QUICK_INTERESTS = [
  "Constable", "SI", "Clerk", "PO", "Teacher", "GD",
  "Driver", "ASI", "Inspector", "Technical", "Forest Guard", "Patwari"
];

// Fallback recommendation targets generator if none matched
function buildRecommendationTargets(job, post) {
  let minEduRank = 99;
  const streamsSet = new Set();
  const specSet = new Set();
  
  if (post.education) {
    for (const edu of post.education) {
      const standardCode = LEVEL_CODE_MAP[edu.levelCode] || "EDU_ANY";
      const rank = EDUCATION_RANKS[standardCode] || 99;
      if (rank < minEduRank) minEduRank = rank;
      if (edu.stream && edu.stream.trim().toLowerCase() !== "any") streamsSet.add(edu.stream.trim().toLowerCase());
      if (edu.specialization && edu.specialization.trim().toLowerCase() !== "any") specSet.add(edu.specialization.trim().toLowerCase());
    }
  }
  if (minEduRank === 99) minEduRank = 0;

  let gendersSet = new Set();
  let categoriesSet = new Set();
  
  if (job.vacancies?.genderWise) {
    const m = job.vacancies.genderWise.male || job.vacancies.genderWise.Male || 0;
    const f = job.vacancies.genderWise.female || job.vacancies.genderWise.Female || 0;
    if (m > 0) gendersSet.add("male");
    if (f > 0) gendersSet.add("female");
  }
  if (job.vacancies?.categoryWise) {
    for (const cat of ["gen", "obc", "sc", "st", "ews"]) {
      if (job.vacancies.categoryWise[cat] > 0 || job.vacancies.categoryWise[cat.toUpperCase()] > 0) {
        categoriesSet.add(cat);
      }
    }
  }
  if (gendersSet.size === 0) {
    gendersSet.add("male");
    gendersSet.add("female");
  }
  if (categoriesSet.size === 0) {
    ["gen", "obc", "sc", "st", "ews"].forEach(c => categoriesSet.add(c));
  }

  let baseMin = 18;
  let baseMax = 27;
  let asOnDate = null;
  if (post.age) {
    baseMin = post.age.min || baseMin;
    baseMax = post.age.max || baseMax;
  } else if (job.ageCriteria?.numberBased) {
    baseMin = job.ageCriteria.numberBased.min || baseMin;
    baseMax = job.ageCriteria.numberBased.max || baseMax;
  }
  let maxObc = baseMax + 3;
  let maxScSt = baseMax + 5;
  if (job.ageCriteria?.relaxationRules) {
    for (const rule of job.ageCriteria.relaxationRules) {
      const cat = (rule.category || "").toLowerCase();
      if (cat.includes("obc")) maxObc = baseMax + (rule.years || 3);
      if (cat.includes("sc") || cat.includes("st")) maxScSt = baseMax + (rule.years || 5);
    }
  }
  if (job.importantDates?.applyEnd?.date) {
    asOnDate = new Date(job.importantDates.applyEnd.date);
  }

  let orgTypesSet = new Set();
  let rolesSet = new Set();
  const searchTokens = job.searchTokens || [];
  const orgRaw = [job.conductingBody, job.department, ...(job.jobDomains || [])].filter(Boolean).map(s => s.toLowerCase());
  for (const raw of orgRaw) {
    for (const [key, val] of Object.entries(ORG_TYPES_MAP)) {
      if (raw.includes(key)) orgTypesSet.add(val.toLowerCase());
    }
  }
  const textCorpus = `${job.title} ${searchTokens.join(" ")}`.toLowerCase();
  for (const role of QUICK_INTERESTS) {
    if (textCorpus.includes(role.toLowerCase())) {
      rolesSet.add(role.toLowerCase());
    }
  }

  const stagesStr = (job.selectionProcess || []).map(s => (s.stage || "").toLowerCase() + " " + (s.description || "").toLowerCase()).join(" ");
  const hasWrittenTest = /written|cbt|exam|tier|prelim|main/i.test(stagesStr) || stagesStr.length === 0;
  const hasPhysicalTest = /pet|physical|medical|pst/i.test(stagesStr);
  const hasInterview = /interview|viva|personality/i.test(stagesStr);

  return {
    minEducationRank: minEduRank,
    eligibleStreams: Array.from(streamsSet),
    eligibleSpecializations: Array.from(specSet),
    age: {
      asOnDate,
      min: baseMin,
      maxGen: baseMax,
      maxObc,
      maxScSt,
    },
    genders: Array.from(gendersSet),
    categories: Array.from(categoriesSet),
    organizationTypes: Array.from(orgTypesSet),
    roles: Array.from(rolesSet),
    selectionFlags: {
      hasWrittenTest,
      hasPhysicalTest,
      hasInterview
    }
  };
}

async function runOldJobsMigration() {
  const uri = process.env.DBURL || "mongodb://localhost:27017/jobsarthi";
  
  try {
    console.log("Connecting to MongoDB for oldjobs migration...");
    const conn = await mongoose.connect(uri);
    console.log(`Connected to MongoDB: ${conn.connection.host}`);

    const collection = conn.connection.db.collection("oldjobs");
    const jobs = await collection.find({}).toArray();
    console.log(`Found ${jobs.length} total old jobs to process.`);

    let expandedCount = 0;
    let singleCount = 0;
    let alreadyFlatCount = 0;
    let deletedCount = 0;

    for (const job of jobs) {
      // Check if it's already flattened (does not have vacancies.breakup or eligibility.posts array with items)
      const hasOldEligibilityPosts = job.eligibility && Array.isArray(job.eligibility.posts) && job.eligibility.posts.length > 0;

      if (!hasOldEligibilityPosts) {
        // Already flattened. Ensure proper notificationGroupId and schemaVersion = 3
        const updates = {};
        let needsUpdate = false;

        if (!job.notificationGroupId) {
          updates.notificationGroupId = job.jobCode;
          needsUpdate = true;
        }
        if (job.schemaVersion !== 3) {
          updates.schemaVersion = 3;
          needsUpdate = true;
        }

        // Ensure recommendationTargets is a single object, not an array of objects
        if (Array.isArray(job.recommendationTargets)) {
          updates.recommendationTargets = job.recommendationTargets[0] || {};
          needsUpdate = true;
        }

        // Apply cleanups for correctionWindow
        if (job.importantDates) {
          if (job.importantDates.correctionWindow === "") {
            updates["importantDates.correctionWindow"] = undefined;
            needsUpdate = true;
          } else if (job.importantDates.correctionWindow && typeof job.importantDates.correctionWindow === 'object') {
            const cw = job.importantDates.correctionWindow;
            if (!cw.start && !cw.end) {
              updates["importantDates.correctionWindow"] = undefined;
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          const setObj = {};
          const unsetObj = {};
          for (const [k, v] of Object.entries(updates)) {
            if (v === undefined) unsetObj[k] = "";
            else setObj[k] = v;
          }
          const updateDoc = {};
          if (Object.keys(setObj).length > 0) updateDoc.$set = setObj;
          if (Object.keys(unsetObj).length > 0) updateDoc.$unset = unsetObj;

          await collection.updateOne({ _id: job._id }, updateDoc);
        }

        alreadyFlatCount++;
        continue;
      }

      const posts = job.eligibility.posts;
      const breakups = (job.vacancies && job.vacancies.breakup) ? job.vacancies.breakup : [];
      const targets = Array.isArray(job.recommendationTargets) ? job.recommendationTargets : [];

      console.log(`Processing Old Job: ${job.jobCode} (${posts.length} posts)`);

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];

        // Normalizing post levelCodes
        if (post.education) {
          post.education.forEach(edu => {
            if (edu.levelCode) {
              edu.levelCode = LEVEL_CODE_MAP[edu.levelCode] || edu.levelCode;
            }
          });
        }

        // Find corresponding breakup for vacancy details
        let breakup = breakups.find(b => b.name && post.postName && b.name.toLowerCase() === post.postName.toLowerCase());
        if (!breakup && breakups.length > i) {
          breakup = breakups[i];
        }

        // Deep copy the original job
        const newJob = JSON.parse(JSON.stringify(job));
        
        // Remove MongoDB ID and version to insert as new
        delete newJob._id;
        delete newJob.__v;

        // Set identifiers
        newJob.notificationGroupId = job.jobCode;

        if (posts.length > 1) {
          newJob.title = `${job.title} - ${post.postName}`;
          newJob.jobCode = `${job.jobCode}-P${i + 1}`;
          newJob.urlTitle = `${job.urlTitle}-p${i + 1}`;
        }

        // Flatten Eligibility
        const generalReqs = newJob.eligibility.generalRequirements || [];
        newJob.eligibility = {
          age: post.age || null,
          education: post.education || [],
          experience: post.experience || { required: false },
          alternativeQualifications: post.alternativeQualifications || [],
          certifications: post.certifications || [],
          skills: post.skills || [],
          generalRequirements: generalReqs
        };

        // Flatten Vacancies
        newJob.vacancies = {
          total: breakup ? (breakup.posts || 0) : (posts.length === 1 ? (job.vacancies?.total || 0) : 0),
          isTentative: job.vacancies ? !!job.vacancies.isTentative : false,
          categoryWiseAvailable: breakup ? !!breakup.categoryWiseAvailable : false,
          categoryWise: breakup ? breakup.categoryWise : null,
          genderWise: breakup ? breakup.genderWise : null,
          horizontalReservation: breakup ? breakup.horizontalReservation : null
        };

        // Auto-compile Streams and Specializations for this post
        const streamsSet = new Set();
        const specSet = new Set();
        if (newJob.eligibility.education) {
          newJob.eligibility.education.forEach((e) => {
            if (e.stream && e.stream.trim().toLowerCase() !== "any") {
              streamsSet.add(e.stream.trim().toLowerCase());
            }
            if (e.specialization && e.specialization.trim().toLowerCase() !== "any") {
              specSet.add(e.specialization.trim().toLowerCase());
            }
          });
        }
        newJob.streams = Array.from(streamsSet);
        newJob.specializations = Array.from(specSet);

        // Auto-compile Search Tokens
        const tokenSet = new Set();
        if (Array.isArray(newJob.jobDomains)) {
          newJob.jobDomains.forEach((t) => t && tokenSet.add(t.trim().toLowerCase()));
        }
        if (Array.isArray(newJob.tags)) {
          newJob.tags.forEach((t) => t && tokenSet.add(t.trim().toLowerCase()));
        }
        if (Array.isArray(newJob.searchKeywords)) {
          newJob.searchKeywords.forEach((t) => t && tokenSet.add(t.trim().toLowerCase()));
        }
        if (newJob.conductingBody) {
          tokenSet.add(newJob.conductingBody.trim().toLowerCase());
        }
        if (newJob.department) {
          tokenSet.add(newJob.department.trim().toLowerCase());
        }
        newJob.searchTokens = Array.from(tokenSet).filter(Boolean);

        // Flatten Recommendation Targets
        let matchedTarget = targets.find(t => t.postName && post.postName && t.postName.toLowerCase() === post.postName.toLowerCase());
        if (!matchedTarget && targets.length > i) {
          matchedTarget = targets[i];
        }

        if (matchedTarget) {
          // Flatten matchedTarget array element into a single object
          newJob.recommendationTargets = {
            minEducationRank: matchedTarget.minEducationRank || 0,
            eligibleStreams: matchedTarget.eligibleStreams || [],
            eligibleSpecializations: matchedTarget.eligibleSpecializations || [],
            age: {
              asOnDate: matchedTarget.age?.asOnDate || null,
              min: matchedTarget.age?.min || 0,
              maxGen: matchedTarget.age?.maxGen || 99,
              maxObc: matchedTarget.age?.maxObc || 99,
              maxScSt: matchedTarget.age?.maxScSt || 99,
            },
            genders: matchedTarget.genders || [],
            categories: matchedTarget.categories || [],
            organizationTypes: matchedTarget.organizationTypes || [],
            roles: matchedTarget.roles || [],
            selectionFlags: {
              hasWrittenTest: matchedTarget.selectionFlags?.hasWrittenTest || false,
              hasPhysicalTest: matchedTarget.selectionFlags?.hasPhysicalTest || false,
              hasInterview: matchedTarget.selectionFlags?.hasInterview || false,
            }
          };
        } else {
          // Generate new recommendationTargets for this specific post
          newJob.recommendationTargets = buildRecommendationTargets(newJob, post);
        }

        // Apply cleanups for correctionWindow
        if (newJob.importantDates) {
          if (newJob.importantDates.correctionWindow === "") {
            delete newJob.importantDates.correctionWindow;
          } else if (newJob.importantDates.correctionWindow && typeof newJob.importantDates.correctionWindow === 'object') {
            const cw = newJob.importantDates.correctionWindow;
            if (!cw.start && !cw.end) {
              delete newJob.importantDates.correctionWindow;
            }
          }
        }

        newJob.schemaVersion = 3;

        // Delete the original master job before inserting clones on first pass
        if (i === 0) {
          await collection.deleteOne({ _id: job._id });
        }

        // Insert new flattened post-specific job document
        await collection.insertOne(newJob);

        if (posts.length > 1) expandedCount++;
        else singleCount++;
      }

      deletedCount++;
    }

    console.log("\n✅ Old Jobs Migration Complete!");
    console.log(`Old Master Jobs Deleted: ${deletedCount}`);
    console.log(`Already-Flat Jobs Updated: ${alreadyFlatCount}`);
    console.log(`Single-Post Jobs Flattened: ${singleCount}`);
    console.log(`Multi-Post Jobs Expanded into: ${expandedCount} new jobs`);

    const newTotal = await collection.countDocuments();
    console.log(`New Total Jobs in 'oldjobs' collection: ${newTotal}`);

    process.exit(0);

  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

runOldJobsMigration();
