require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const Job = require("../models/Job");
const { EDUCATION_RANKS } = require("../utils/educationHelper");

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Fuzzy mapping for existing domains/orgs to new exact constants
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

async function migrateRecommendationTargets() {
  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(process.env.DBURL || "mongodb://localhost:27017/jobsarthi");
    console.log(`Connected to MongoDB: ${conn.connection.host}`);

    console.log("Fetching jobs to migrate...");
    const jobs = await Job.find({}).lean();
    let updateOps = [];

    for (const job of jobs) {
      let minEduRank = 99;
      let streamsSet = new Set();
      let specSet = new Set();

      // 1. Education
      if (job.eligibility?.education) {
        for (const edu of job.eligibility.education) {
          const rank = EDUCATION_RANKS[edu.levelCode] || 99;
          if (rank < minEduRank) minEduRank = rank;
          
          if (edu.stream && edu.stream.trim().toLowerCase() !== "any") streamsSet.add(edu.stream.trim().toLowerCase());
          if (edu.specialization && edu.specialization.trim().toLowerCase() !== "any") specSet.add(edu.specialization.trim().toLowerCase());
        }
      }
      if (minEduRank === 99) minEduRank = 0; // Default to 0 if no education found

      // 2. Vacancies (Genders & Categories)
      let gendersSet = new Set();
      let categoriesSet = new Set();
      let hasVacancyBreakup = false;

      if (job.vacancies && (job.vacancies.genderWise || job.vacancies.categoryWise)) {
        hasVacancyBreakup = true;
        const post = job.vacancies;
        // Genders
        if (post.genderWise) {
          const m = post.genderWise.male || post.genderWise.Male || 0;
          const f = post.genderWise.female || post.genderWise.Female || 0;
          if (m > 0) gendersSet.add("male");
          if (f > 0) gendersSet.add("female");
        }
        // Categories
        if (post.categoryWise) {
          for (const cat of ["gen", "obc", "sc", "st", "ews"]) {
             if (post.categoryWise[cat] > 0 || post.categoryWise[cat.toUpperCase()] > 0) {
               categoriesSet.add(cat);
             }
          }
        }
      }

      // If no breakup exists or it's empty, assume open for all to prevent hiding the job
      if (!hasVacancyBreakup || gendersSet.size === 0) {
        gendersSet.add("male");
        gendersSet.add("female");
      }
      if (!hasVacancyBreakup || categoriesSet.size === 0) {
        ["gen", "obc", "sc", "st", "ews"].forEach(c => categoriesSet.add(c));
      }

      // 3. Age
      let baseMin = 18;
      let baseMax = 27;
      let asOnDate = null;
      if (job.ageCriteria?.numberBased) {
        baseMin = job.ageCriteria.numberBased.min || baseMin;
        baseMax = job.ageCriteria.numberBased.max || baseMax;
      }
      
      // Calculate relaxations heuristically based on standard rules if not explicitly set
      let maxObc = baseMax + 3;
      let maxScSt = baseMax + 5;
      if (job.ageCriteria?.relaxationRules) {
        for (const rule of job.ageCriteria.relaxationRules) {
          const cat = (rule.category || "").toLowerCase();
          if (cat.includes("obc")) maxObc = baseMax + (rule.years || 3);
          if (cat.includes("sc") || cat.includes("st")) maxScSt = baseMax + (rule.years || 5);
        }
      }

      // Try to find age calculation date (fallback to applyEnd or Date.now)
      if (job.importantDates?.applyEnd?.date) {
        asOnDate = new Date(job.importantDates.applyEnd.date);
      }

      // 4. Job Identity
      let orgTypesSet = new Set();
      let rolesSet = new Set();
      
      const searchTokens = job.searchTokens || [];
      const orgRaw = [job.conductingBody, job.department, ...(job.jobDomains || [])].filter(Boolean).map(s => s.toLowerCase());
      
      // Map organizations
      for (const raw of orgRaw) {
        for (const [key, val] of Object.entries(ORG_TYPES_MAP)) {
          if (raw.includes(key)) orgTypesSet.add(val.toLowerCase()); // keep lowercase for matching
        }
      }

      // Map roles
      const textCorpus = `${job.title} ${searchTokens.join(" ")}`.toLowerCase();
      for (const role of QUICK_INTERESTS) {
        if (textCorpus.includes(role.toLowerCase())) {
          rolesSet.add(role.toLowerCase());
        }
      }

      // 5. Selection Flags
      const stagesStr = (job.selectionProcess || []).map(s => (s.stage || "").toLowerCase() + " " + (s.description || "").toLowerCase()).join(" ");
      const hasWrittenTest = /written|cbt|exam|tier|prelim|main/i.test(stagesStr) || stagesStr.length === 0; // Default to true if empty
      const hasPhysicalTest = /pet|physical|medical|pst/i.test(stagesStr);
      const hasInterview = /interview|viva|personality/i.test(stagesStr);

      const recommendationTargets = {
        minEducationRank: minEduRank,
        eligibleStreams: Array.from(streamsSet),
        eligibleSpecializations: Array.from(specSet),
        age: {
          asOnDate: asOnDate,
          min: baseMin,
          maxGen: baseMax,
          maxObc: maxObc,
          maxScSt: maxScSt,
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

      updateOps.push({
        updateOne: {
          filter: { _id: job._id },
          update: { $set: { recommendationTargets } }
        }
      });

      // Execute in batches of 100
      if (updateOps.length >= 100) {
        await Job.collection.bulkWrite(updateOps);
        updateOps = [];
      }
    }

    if (updateOps.length > 0) {
      await Job.collection.bulkWrite(updateOps);
    }

    console.log(`Successfully migrated recommendationTargets for ${jobs.length} jobs.`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

migrateRecommendationTargets();
