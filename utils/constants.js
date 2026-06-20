/**
 * Centralized High-Performance ENUM Constants for Indian Government Exams
 * 
 * Using these constants eliminates slow O(N) string '.includes()' matching
 * and allows for instantaneous O(1) Set intersections in the recommendation engine.
 */

// 1. LOCATION & DOMICILE CODES (States & UTs + All India)
const LOCATION_CODES = [
  "ALL_INDIA",
  "AP", "AR", "AS", "BR", "CG", "GA", "GJ", "HR", "HP", "JH", 
  "KA", "KL", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PB", 
  "RJ", "SK", "TN", "TG", "TR", "UP", "UK", "WB",
  "AN", "CH", "DN", "DL", "JK", "LA", "LD", "PY"
];

// 2. EDUCATION STREAM CODES (Replacing 124+ messy strings)
const STREAM_CODES = [
  "STR_ANY",                  // Any Stream / Any Graduate
  "STR_ENG_ANY",              // Any Engineering
  "STR_ENG_CS_IT",            // Computer Science / IT
  "STR_ENG_MECH",             // Mechanical
  "STR_ENG_CIVIL",            // Civil
  "STR_ENG_ELEC",             // Electrical / Electronics
  "STR_SCI_ANY",              // Any Science (B.Sc)
  "STR_SCI_BIO",              // Biology / Zoology / Botany
  "STR_SCI_CHEM",             // Chemistry
  "STR_SCI_PHY",              // Physics / Maths
  "STR_SCI_AGRI",             // Agriculture
  "STR_COMMERCE",             // B.Com / Finance / Accounts
  "STR_ARTS",                 // B.A. / Humanities
  "STR_LAW",                  // LLB
  "STR_MEDICAL",              // MBBS / BDS
  "STR_NURSING_PHARMA",       // Nursing / Pharmacy
  "STR_MANAGEMENT",           // BBA / MBA
  "STR_EDUCATION"             // B.Ed / Teaching
];

// 3. GENDER CODES
const GENDER_CODES = ["MALE", "FEMALE", "TRANSGENDER", "ANY"];

// 4. CATEGORY CODES
const CATEGORY_CODES = ["UR", "OBC", "SC", "ST", "EWS"];

// 5. MARITAL STATUS CODES
const MARITAL_STATUS_CODES = ["UNMARRIED", "MARRIED", "WIDOWED", "DIVORCED"];

// 6. PWD (PERSONS WITH DISABILITIES) TYPES
const PWD_CATEGORIES = ["OH", "VH", "HH", "MD", "NONE"];

// 7. NCC CERTIFICATE TYPES
const NCC_CERTIFICATES = ["NONE", "A", "B", "C"];

// 8. EXPERIENCE STATUS
const EXPERIENCE_STATUS = ["FRESHER", "EXPERIENCED"];

module.exports = {
  LOCATION_CODES,
  STREAM_CODES,
  GENDER_CODES,
  CATEGORY_CODES,
  MARITAL_STATUS_CODES,
  PWD_CATEGORIES,
  NCC_CERTIFICATES,
  EXPERIENCE_STATUS
};
