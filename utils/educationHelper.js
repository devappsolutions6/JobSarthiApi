// 🎓 AspirantCareer Centralized Education and Qualification Helper
// This is the absolute single source of truth for ranks, codes, regex patterns, and normalization rules.

// ⚙️ AspirantCareer Application Constants
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
  "10th":        "10th|matriculat|ssc|secondary school|matric|high school|7th|8th|6th|middle school",
  "12th":        "12th|10\\+2|intermediate|hsc|higher secondary|senior secondary|class 12|class xii",
  "diploma":     "diploma|iti|polytechnic|gnm|anm|nursing|d\\.el\\.ed|d\\.ed\\b|vocational|mechanic",
  "graduate":    "degree|b\\.tech|b\\.e\\b|bachelor|b\\.sc|b\\.a\\b|b\\.com|graduation|engineering degree|graduate|ll\\.?b\\b|law degree|mbbs|b\\.?ed\\b|bba\\b|bca\\b|b\\.c\\.a\\b|ca\\b|cma\\b|cs\\b|icwa\\b|b\\.el\\.ed\\b|b\\.pharm\\b|b\\.?arch\\b|b\\.?des\\b|bams\\b|bhms\\b|bpt\\b",
  "postgraduate":"master|m\\.tech|m\\.e\\b|m\\.sc|m\\.a\\b|m\\.com|post.?graduate|mba|phd|doctorate|mca\\b|m\\.c\\.a\\b|m\\.pharm\\b|m\\.?arch\\b|m\\.?des\\b|md\\b|ms\\b|dnb\\b|dmre\\b",
};

// Pre-compile regexes for O(1) creation time during normalization
const DEGREE_REGEXES = {
  "10th": new RegExp(DEGREE_PATTERNS["10th"], "i"),
  "12th": new RegExp(DEGREE_PATTERNS["12th"], "i"),
  "diploma": new RegExp(DEGREE_PATTERNS["diploma"], "i"),
  "graduate": new RegExp(DEGREE_PATTERNS["graduate"], "i"),
  "postgraduate": new RegExp(DEGREE_PATTERNS["postgraduate"], "i"),
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
  if (DEGREE_REGEXES.postgraduate.test(lower)) return "EDU_POSTGRAD";
  if (DEGREE_REGEXES.graduate.test(lower)) return "EDU_GRAD";
  if (DEGREE_REGEXES.diploma.test(lower)) return "EDU_DIPLOMA";
  if (DEGREE_REGEXES["12th"].test(lower)) return "EDU_12TH";
  if (DEGREE_REGEXES["10th"].test(lower)) return "EDU_10TH";
  return "EDU_ANY";
}

const LEGACY_USER_LEVEL_MAP = Object.freeze({
  "postgraduate": "EDU_POSTGRAD", "master": "EDU_POSTGRAD", "post graduate": "EDU_POSTGRAD",
  "graduate": "EDU_GRAD", "bachelor": "EDU_GRAD", "degree": "EDU_GRAD", "graduation": "EDU_GRAD",
  "diploma": "EDU_DIPLOMA", "iti": "EDU_DIPLOMA", "polytechnic": "EDU_DIPLOMA",
  "12th": "EDU_12TH", "intermediate": "EDU_12TH", "hsc": "EDU_12TH",
  "10th": "EDU_10TH", "matric": "EDU_10TH", "ssc": "EDU_10TH"
});

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
  return LEGACY_USER_LEVEL_MAP[lower] || null;
}

/**
 * Precomputed eligible codes map for O(1) lookup
 */
const ELIGIBLE_CODES_MAP = Object.freeze({
  "EDU_10TH": ["EDU_10TH"],
  "EDU_12TH": ["EDU_10TH", "EDU_12TH"],
  "EDU_DIPLOMA": ["EDU_10TH", "EDU_12TH", "EDU_DIPLOMA"],
  "EDU_GRAD": ["EDU_10TH", "EDU_12TH", "EDU_DIPLOMA", "EDU_GRAD"],
  "EDU_POSTGRAD": ["EDU_10TH", "EDU_12TH", "EDU_DIPLOMA", "EDU_GRAD", "EDU_POSTGRAD"],
  "EDU_ANY": [] 
});

/**
 * Returns all standard EDU_* codes that the user qualifies for (cascade).
 * Input MUST be a standard code (e.g. "EDU_GRAD") — migration ensures this.
 * No runtime normalization — direct O(1) rank lookup only.
 * e.g. "EDU_GRAD" -> ["EDU_10TH", "EDU_12TH", "EDU_DIPLOMA", "EDU_GRAD"]
 */
function getEligibleLevelCodes(userEducationLevel) {
  if (!userEducationLevel) return [];
  // Direct O(1) lookup - much faster than runtime array generation and filtering
  return ELIGIBLE_CODES_MAP[userEducationLevel] || [];
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
