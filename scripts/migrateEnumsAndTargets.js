require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const Job = require("../models/Job");
const { EDUCATION_RANKS } = require("../utils/educationHelper");
const {
  LOCATION_CODES, STREAM_CODES, GENDER_CODES, CATEGORY_CODES
} = require("../utils/constants");

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

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

// Heuristic to map 124+ dirty string variants to clean Enum STREAM_CODES
function mapDirtyStreamToEnum(raw) {
  if (!raw || raw.trim() === "" || raw.toLowerCase() === "any") return "STR_ANY";
  const lower = raw.toLowerCase();
  
  if (lower.includes("computer") || lower.includes("it") || lower.includes("bca")) return "STR_ENG_CS_IT";
  if (lower.includes("mech") || lower.includes("auto")) return "STR_ENG_MECH";
  if (lower.includes("civil")) return "STR_ENG_CIVIL";
  if (lower.includes("elec")) return "STR_ENG_ELEC";
  if (lower.includes("eng") || lower.includes("tech")) return "STR_ENG_ANY";
  
  if (lower.includes("bio") || lower.includes("zoo") || lower.includes("bot")) return "STR_SCI_BIO";
  if (lower.includes("chem")) return "STR_SCI_CHEM";
  if (lower.includes("phy") || lower.includes("math")) return "STR_SCI_PHY";
  if (lower.includes("agri")) return "STR_SCI_AGRI";
  if (lower.includes("sci") || lower.includes("b.sc")) return "STR_SCI_ANY";
  
  if (lower.includes("com") || lower.includes("fin") || lower.includes("acc")) return "STR_COMMERCE";
  if (lower.includes("art") || lower.includes("hum") || lower.includes("b.a")) return "STR_ARTS";
  if (lower.includes("law") || lower.includes("llb")) return "STR_LAW";
  if (lower.includes("med") || lower.includes("mbbs") || lower.includes("bds")) return "STR_MEDICAL";
  if (lower.includes("nurs") || lower.includes("pharm")) return "STR_NURSING_PHARMA";
  if (lower.includes("manag") || lower.includes("bba") || lower.includes("mba")) return "STR_MANAGEMENT";
  if (lower.includes("edu") || lower.includes("teach") || lower.includes("b.ed")) return "STR_EDUCATION";
  
  return "STR_ANY";
}

// Heuristic to map raw string locations to LOCATION_CODES
function mapDirtyLocationToEnum(raw) {
  if (!raw) return ["ALL_INDIA"];
  const lower = raw.toLowerCase();
  const codes = [];
  
  if (lower.includes("uttar pradesh") || lower.includes("up")) codes.push("UP");
  if (lower.includes("maharashtra") || lower.includes("mh")) codes.push("MH");
  if (lower.includes("delhi") || lower.includes("dl")) codes.push("DL");
  // ... can expand. Fallback for now:
  if (codes.length === 0) codes.push("ALL_INDIA");
  
  return codes;
}

async function migrateAll() {
  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(process.env.DBURL || "mongodb://localhost:27017/jobsarthi");
    console.log(`Connected to MongoDB: ${conn.connection.host}`);

    console.log("Fetching jobs to migrate...");
    const jobs = await Job.find({}).lean();
    let updateOps = [];

    for (const job of jobs) {
      // 1. Data Cleaning (Strings -> Enums)
      const locCodes = mapDirtyLocationToEnum(job.location);
      
      let minEduRank = 99;
      let streamsSet = new Set();
      
      if (job.eligibility?.education) {
        for (const edu of job.eligibility.education) {
          const rank = EDUCATION_RANKS[edu.levelCode] || 99;
          if (rank < minEduRank) minEduRank = rank;
          
          if (edu.stream) {
             const code = mapDirtyStreamToEnum(edu.stream);
             streamsSet.add(code);
          } else if (edu.streamCodes && edu.streamCodes.length > 0) {
             edu.streamCodes.forEach(c => streamsSet.add(c));
          } else {
             streamsSet.add("STR_ANY");
          }
        }
      }
      if (minEduRank === 99) minEduRank = 0;
      
      // Update the base document fields to the new schema
      const baseUpdates = {
        locationCodes: locCodes,
        // Since we changed stream to streamCodes array in education, we skip full structural rewrite here and just map targets.
        // The targets are what matter for matching.
      };

      // 2. Targets Generation
      let gendersSet = new Set();
      let categoriesSet = new Set();
      let hasVacancyBreakup = false;

      if (job.vacancies && (job.vacancies.genderWise || job.vacancies.categoryWise)) {
        hasVacancyBreakup = true;
        const post = job.vacancies;
        if (post.genderWise) {
          const m = post.genderWise.male || post.genderWise.Male || 0;
          const f = post.genderWise.female || post.genderWise.Female || 0;
          if (m > 0) gendersSet.add("MALE");
          if (f > 0) gendersSet.add("FEMALE");
        }
        if (post.categoryWise) {
          for (const cat of ["gen", "obc", "sc", "st", "ews"]) {
             if (post.categoryWise[cat] > 0 || post.categoryWise[cat.toUpperCase()] > 0) {
               if (cat === "gen") categoriesSet.add("UR");
               else categoriesSet.add(cat.toUpperCase());
             }
          }
        }
      }

      if (!hasVacancyBreakup || gendersSet.size === 0) {
        gendersSet.add("MALE");
        gendersSet.add("FEMALE");
      }
      if (!hasVacancyBreakup || categoriesSet.size === 0) {
        CATEGORY_CODES.forEach(c => categoriesSet.add(c));
      }

      // Age Math
      let baseMin = 18, baseMax = 27, asOnDate = null;
      if (job.ageCriteria?.numberBased) {
        baseMin = job.ageCriteria.numberBased.min || baseMin;
        baseMax = job.ageCriteria.numberBased.max || baseMax;
      }
      if (job.ageCriteria?.asOnDate) {
        asOnDate = job.ageCriteria.asOnDate;
      } else if (job.importantDates?.applyEnd?.date) {
        asOnDate = new Date(job.importantDates.applyEnd.date);
      }
      
      let maxObc = baseMax + 3, maxScSt = baseMax + 5;
      if (job.ageCriteria?.relaxationRules) {
        for (const rule of job.ageCriteria.relaxationRules) {
          const cat = (rule.category || "").toLowerCase();
          if (cat.includes("obc")) maxObc = baseMax + (rule.years || 3);
          if (cat.includes("sc") || cat.includes("st")) maxScSt = baseMax + (rule.years || 5);
        }
      }

      // Org & Role Flags
      let orgTypesSet = new Set(), rolesSet = new Set();
      const searchTokens = job.searchTokens || [];
      const orgRaw = [job.conductingBody, job.department, ...(job.jobDomains || [])].filter(Boolean).map(s => s.toLowerCase());
      for (const raw of orgRaw) {
        for (const [key, val] of Object.entries(ORG_TYPES_MAP)) {
          if (raw.includes(key)) orgTypesSet.add(val.toLowerCase());
        }
      }
      const textCorpus = `${job.title} ${searchTokens.join(" ")}`.toLowerCase();
      for (const role of QUICK_INTERESTS) {
        if (textCorpus.includes(role.toLowerCase())) rolesSet.add(role.toLowerCase());
      }

      const stagesStr = (job.selectionProcess || []).map(s => (s.stage || "").toLowerCase() + " " + (s.description || "").toLowerCase()).join(" ");
      const hasWrittenTest = /written|cbt|exam|tier|prelim|main/i.test(stagesStr) || stagesStr.length === 0;
      const hasPhysicalTest = /pet|physical|medical|pst/i.test(stagesStr);
      const hasInterview = /interview|viva|personality/i.test(stagesStr);

      const recommendationTargets = {
        minEducationRank: minEduRank,
        streamCodes: Array.from(streamsSet),
        locationCodes: locCodes,
        age: { asOnDate, min: baseMin, maxGen: baseMax, maxObc, maxScSt },
        genders: Array.from(gendersSet),
        categories: Array.from(categoriesSet),
        organizationTypes: Array.from(orgTypesSet),
        roles: Array.from(rolesSet),
        selectionFlags: { hasWrittenTest, hasPhysicalTest, hasInterview }
      };

      updateOps.push({
        updateOne: {
          filter: { _id: job._id },
          update: { 
            $set: { 
              ...baseUpdates,
              recommendationTargets, 
              isRecommendationProcessed: false // trigger engine to re-run
            } 
          }
        }
      });

      if (updateOps.length >= 100) {
        await Job.collection.bulkWrite(updateOps);
        updateOps = [];
      }
    }

    if (updateOps.length > 0) {
      await Job.collection.bulkWrite(updateOps);
    }

    console.log(`Successfully migrated strings to Enum targets for ${jobs.length} jobs.`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

migrateAll();
