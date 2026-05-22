// 🎓 JobSarthi Centralized Education and Qualification Helper
// This is the absolute single source of truth for ranks, codes, regex patterns, and normalization rules.

// ⚙️ JobSarthi Application Constants
// Centralized, immutable arrays for application-wide enum validation and configuration.

const JOB_DOMAINS = Object.freeze([
  "Central",
  "State",
  "Defence",
  "Police",
  "Railway",
  "Teaching",
  "Banking",
  "PSU",
  "Medical",
  "Engineering",
  "Other"
]);

const USER_CATEGORIES = Object.freeze([
  "gen",
  "obc",
  "sc",
  "st",
  "ews",
  ""
]);

const GENDERS = Object.freeze([
  "male",
  "female",
  "any"
]);

const SELECTION_PREFERENCES = Object.freeze([
  "any",
  "written",
  "pet",
  "interview"
]);

const SELECTION_STAGES = Object.freeze([
  "written",
  "pet",
  "interview",
  "document_verification",
  "medical_exam"
]);

const EXAM_PHASES = Object.freeze([
  "application",
  "lastDate",
  "admitCard",
  "exam",
  "result"
]);

const EDUCATION_LEVEL_CODES = Object.freeze([
  "EDU_10TH",
  "EDU_12TH",
  "EDU_DIPLOMA",
  "EDU_GRAD",
  "EDU_POSTGRAD",
  "EDU_ANY"
]);

// Standard code -> rank (the only lookup needed after DB is migrated)
const EDUCATION_RANKS = Object.freeze({
  "EDU_10TH":   1,
  "EDU_12TH":   2,
  "EDU_DIPLOMA": 3,
  "EDU_GRAD":   4,
  "EDU_POSTGRAD": 5,
  "EDU_ANY":    0,
});

const DEGREE_PATTERNS = {
  "10th":        "10th|matriculat|ssc|secondary school|matric|high school",
  "12th":        "12th|10\\+2|intermediate|hsc|higher secondary|senior secondary",
  "diploma":     "diploma|iti|polytechnic",
  "graduate":    "degree|b\\.tech|b\\.e\\b|bachelor|b\\.sc|b\\.a\\b|b\\.com|graduation|engineering degree|graduate",
  "postgraduate":"master|m\\.tech|m\\.e\\b|m\\.sc|m\\.a\\b|m\\.com|post.?graduate|mba|phd|doctorate",
};

/**
 * Normalizes any raw degree or job-schema level string to a standard levelCode.
 * After DB migration, this is only needed for parsing freeform job data from scrapers/admins.
 * e.g. "B.Tech" -> "EDU_GRAD", "EDU_GRAD" -> "EDU_GRAD" (passthrough)
 */
function normalizeDegreeToLevelCode(degreeStr) {
  if (!degreeStr) return "EDU_ANY";
  const upper = degreeStr.trim().toUpperCase();
  if (EDUCATION_LEVEL_CODES.includes(upper)) return upper;

  // Direct mapping for common custom/legacy invalid codes
  if (upper === "EDU_PG" || upper === "PG") return "EDU_POSTGRAD";
  if (upper === "EDU_LLB" || upper === "LLB") return "EDU_GRAD";

  const lower = degreeStr.trim().toLowerCase();
  if (new RegExp(DEGREE_PATTERNS.postgraduate, "i").test(lower)) return "EDU_POSTGRAD";
  if (new RegExp(DEGREE_PATTERNS.graduate,    "i").test(lower)) return "EDU_GRAD";
  if (new RegExp(DEGREE_PATTERNS.diploma,     "i").test(lower)) return "EDU_DIPLOMA";
  if (new RegExp(DEGREE_PATTERNS["12th"],     "i").test(lower)) return "EDU_12TH";
  if (new RegExp(DEGREE_PATTERNS["10th"],     "i").test(lower)) return "EDU_10TH";
  return "EDU_ANY";
}

/**
 * Converts any education level string (legacy or standard) to a standard code.
 * After DB migration, this is mainly used by the migration itself and any edge-case
 * incoming data from external sources.
 */
function normalizeUserLevelToCode(userLevel) {
  if (!userLevel) return null;
  const upper = userLevel.trim().toUpperCase();
  if (EDUCATION_LEVEL_CODES.includes(upper)) return upper;
  const lower = userLevel.trim().toLowerCase();
  if (["postgraduate", "master", "post graduate"].includes(lower)) return "EDU_POSTGRAD";
  if (["graduate", "bachelor", "degree", "graduation"].includes(lower)) return "EDU_GRAD";
  if (["diploma", "iti", "polytechnic"].includes(lower)) return "EDU_DIPLOMA";
  if (["12th", "intermediate", "hsc"].includes(lower)) return "EDU_12TH";
  if (["10th", "matric", "ssc"].includes(lower)) return "EDU_10TH";
  return null;
}

/**
 * Returns all standard EDU_* codes that the user qualifies for (cascade).
 * Input MUST be a standard code (e.g. "EDU_GRAD") — migration ensures this.
 * No runtime normalization — direct O(1) rank lookup only.
 * e.g. "EDU_GRAD" -> ["EDU_10TH", "EDU_12TH", "EDU_DIPLOMA", "EDU_GRAD"]
 */
function getEligibleLevelCodes(userEducationLevel) {
  if (!userEducationLevel) return [];
  const rank = EDUCATION_RANKS[userEducationLevel] || 0; // Direct lookup — no trim/toUpperCase needed post-migration
  return [
    { code: "EDU_10TH",    rank: 1 },
    { code: "EDU_12TH",    rank: 2 },
    { code: "EDU_DIPLOMA", rank: 3 },
    { code: "EDU_GRAD",    rank: 4 },
    { code: "EDU_POSTGRAD",rank: 5 }
  ]
    .filter(item => item.rank <= rank)
    .map(item => item.code);
}


module.exports = {
  EDUCATION_RANKS,
  // DEGREE_PATTERNS is intentionally not exported — internal use only by normalizeDegreeToLevelCode
  normalizeDegreeToLevelCode,
  normalizeUserLevelToCode,
  getEligibleLevelCodes,
  // Centralized Application Constants
  JOB_DOMAINS,
  USER_CATEGORIES,
  GENDERS,
  SELECTION_PREFERENCES,
  SELECTION_STAGES,
  EXAM_PHASES,
  EDUCATION_LEVEL_CODES
};
