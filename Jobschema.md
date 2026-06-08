# Job Schema Specification

This document defines the schema structure and the standard allowed codes for job database entries. 

---

## 🎓 Standard Education Level Codes (`levelCode`)

To ensure exact matching in the recommendation engine and prevent server crashes, the `levelCode` field in `eligibility.posts[].education[]` must strictly match one of the following standardized codes. **Do not use custom codes like `EDU_PG` or `EDU_LLB`.**

| Code | Level Description | Examples / Keywords |
|---|---|---|
| **`EDU_10TH`** | 10th Pass / Matriculation | SSC, Secondary School, High School |
| **`EDU_12TH`** | 12th Pass / Intermediate | HSC, Higher Secondary, Senior Secondary |
| **`EDU_DIPLOMA`** | Diploma / ITI | Polytechnic, ITI, trade certificates |
| **`EDU_GRAD`** | Graduate (Bachelor's Degree) | B.Tech, B.Sc, B.A, B.Com, LLB, B.Ed, etc. |
| **`EDU_POSTGRAD`** | Post Graduate (Master's/PhD) | Master's, M.Tech, MBA, M.Sc, M.A, PhD, etc. |
| **`EDU_ANY`** | Open to All | No educational constraints |

---

## 💼 Standard Job Domains (`jobDomains`)

The `jobDomains` array field should only contain the following standard values:
* `"Central"`
* `"State"`
* `"Defence"`
* `"Police"`
* `"Railway"`
* `"Teaching"`
* `"Banking"`
* `"PSU"`
* `"Medical"`
* `"Engineering"`
* `"Other"`

## 🎯 AI Generated Flat Arrays

**CRITICAL:** The computationally expensive `pre("save")` hooks have been removed from the backend to maximize performance. **Your AI Agent or job scraping tool MUST generate a perfectly flattened payload**, including the `recommendationTargets` object and the flat arrays for search, before sending it to the API to be saved. 

### 1. Recommendation Targets (`recommendationTargets`)
This object is used directly for instant 1-to-1 matching in the recommendation engine.

* **`minEducationRank`**: The absolute lowest rank required across all posts (e.g., 2 for 12th pass).
* **`eligibleStreams` / `eligibleSpecializations`**: Exact arrays of accepted streams and specializations (must be lowercase).
* **`age`**:
    * `asOnDate`: The official date age is calculated from (must be a valid Date).
    * `maxObc` / `maxScSt`: Pre-calculated with standard category relaxations.
* **`genders` / `categories`**: Which demographics have at least 1 vacancy available (lowercase).
* **`organizationTypes` / `roles`**: Must perfectly match the frontend `ORG_TYPES` and `QUICK_INTERESTS` constants to ensure they match User Preferences.
* **`selectionFlags`**: Boolean values representing the stages present in the selection process.

### 2. Search & Filter Arrays
The AI must extract a unique, flattened list of these fields from the complex nested objects to allow fast database querying.

* **`streams`**: Array of lowercase strings (e.g., `["arts", "science"]`).
* **`specializations`**: Array of lowercase strings (e.g., `["computer science", "electrical"]`).
* **`searchTokens`**: Combine job domains, tags, roles, and conducting body into a single lowercase array to power the global text search (e.g., `["banking", "finance", "sbi", "clerk"]`).

---

## 📝 Example JSON Document

> [!WARNING]
> **CRITICAL: Date Fields & Validation**
> All date fields (e.g., `importantDates.*.date`, `createdAt`) MUST be stored as proper **valid MongoDB Date objects**, not raw strings or `Invalid Date` objects. Passing an `Invalid Date` (which holds a `NaN` value) will trigger a Mongoose `CastError` and crash background services like recommendation engines.
> * **Verification**: Always ensure date objects are valid in your scripts using `!isNaN(new Date(val).getTime())`.
> * **Fallbacks**: If a date is unknown or not specified, explicitly set it to `null` instead of raw strings or corrupted values.

> [!IMPORTANT]
> **CRITICAL: Status Field Must Exist**
> The `status` field (e.g., `"active"`, `"upcoming"`, `"expired"`) **must be explicitly defined** in the MongoDB document. Do not rely on Mongoose default values when inserting or importing documents directly via raw MongoDB scripts. Because the API filters strictly on `{ status: "active" }` at the database level, documents missing this field will **not** be returned or published.

```json
{
  "jobCode": "OSWC-2026-ASST",
  "urlTitle": "oswc-recruitment-2026-assistant-superintendent-posts",
  "title": "OSWC Recruitment 2026 Apply Online for 30 Assistant Superintendent and Warehouse Assistant Posts",
  "shortDescription": "Odisha State Warehousing Corporation (OSWC) has released a notification for the recruitment of Assistant Superintendent and Warehouse Assistant posts. Eligible graduates can apply online starting May 15, 2026.",
  "description": "Candidates are invited to apply for various vacancies at OSWC. Selection will be based on a competitive written examination followed by standard document verification.",
  "conductingBody": "Odisha State Warehousing Corporation",
  "department": "Food, Supplies & Consumer Welfare Department",
  "organization": "OSWC",
  "postType": "regular",
  "jobDomains": [
    "State",
    "PSU"
  ],
  "location": "Odisha",
  "stateEligibility": [
    "Odisha"
  ],
  "examLanguages": [
    "English",
    "Odia"
  ],
  "isActive": true,
  "status": "active",
  "isFeatured": true,
  "isPinned": false,
  "salaryRange": {
    "min": 25500,
    "max": 81100,
    "currency": "INR",
    "unit": "monthly",
    "note": "Level 7 Pay Matrix under ORSP Rules"
  },
  "vacancies": {
    "total": 30,
    "isTentative": false,
    "breakup": [
      {
        "postCode": "ASST_SUP",
        "name": "Assistant Superintendent",
        "organization": "OSWC",
        "posts": 15,
        "ageMin": 21,
        "ageMax": 38,
        "payScale": {
          "level": "7",
          "min": 25500,
          "max": 81100,
          "currency": "INR"
        },
        "categoryWiseAvailable": true,
        "categoryWise": {
          "UR": 8,
          "SEBC": 2,
          "SC": 3,
          "ST": 2
        }
      },
      {
        "postCode": "WH_ASST",
        "name": "Warehouse Assistant",
        "organization": "OSWC",
        "posts": 15,
        "ageMin": 21,
        "ageMax": 38,
        "payScale": {
          "level": "5",
          "min": 21700,
          "max": 69100,
          "currency": "INR"
        },
        "categoryWiseAvailable": false
      }
    ]
  },
  "ageCriteria": {
    "type": "number",
    "numberBased": {
      "min": 21,
      "max": 38
    },
    "relaxationRules": [
      {
        "category": "SC",
        "years": 5,
        "note": "Standard reservation guidelines apply"
      },
      {
        "category": "ST",
        "years": 5,
        "note": "Standard reservation guidelines apply"
      },
      {
        "category": "OBC",
        "years": 3,
        "note": "Applicable for SEBC candidates in state lists"
      }
    ]
  },
  "eligibility": {
    "posts": [
      {
        "postName": "Assistant Superintendent",
        "age": {
          "min": 21,
          "max": 38
        },
        "education": [
          {
            "level": "Graduate (B.Tech, B.Sc, B.A, B.Com, etc.)",
            "levelCode": "EDU_GRAD",
            "stream": "any",
            "specialization": "any",
            "minMarks": 50,
            "required": true
          }
        ],
        "experience": {
          "required": false,
          "minYears": 0
        }
      },
      {
        "postName": "Warehouse Assistant",
        "age": {
          "min": 21,
          "max": 38
        },
        "education": [
          {
            "level": "Graduate (B.Tech, B.Sc, B.A, B.Com, etc.)",
            "levelCode": "EDU_GRAD",
            "stream": "any",
            "specialization": "any",
            "required": true
          }
        ],
        "experience": {
          "required": false,
          "minYears": 0
        }
      }
    ],
    "generalRequirements": [
      "Must be a citizen of India",
      "Must be able to speak, read, and write in Odia",
      "Must have passed Middle School Examination with Odia as a language subject"
    ]
  },
  "physicalCriteria": {
    "applicable": false
  },
  "selectionProcess": [
    {
      "order": 1,
      "stage": "written",
      "description": "OMR or Computer Based Competitive Written Test (MCQ format)",
      "qualifying": true,
      "marksWeightage": 100
    },
    {
      "order": 2,
      "stage": "document_verification",
      "description": "Verification of academic certificates, caste status, and age proofs.",
      "qualifying": true,
      "marksWeightage": 0
    }
  ],
  "applicationFee": [
    {
      "category": "General",
      "amount": 500,
      "refundable": false
    },
    {
      "category": "SC/ST/SEBC",
      "amount": 200,
      "refundable": false
    }
  ],
  "importantDates": {
    "notificationDate": {
      "date": { "$date": "2026-05-10T00:00:00.000Z" },
      "tentative": false
    },
    "applyStart": {
      "date": { "$date": "2026-05-15T00:00:00.000Z" },
      "tentative": false
    },
    "applyEnd": {
      "date": { "$date": "2026-06-14T23:59:59.000Z" },
      "tentative": false
    },
    "feeLastDate": {
      "date": { "$date": "2026-06-15T23:59:59.000Z" },
      "tentative": false
    },
    "examDate": {
      "date": { "$date": "2026-08-20T00:00:00.000Z" },
      "tentative": true,
      "note": "Date is tentative and subject to changes."
    }
  },
  "links": {
    "notification": "https://oswc.in/recruitments/advertisement_2026.pdf",
    "applyOnline": "https://oswc.in/apply",
    "officialWebsite": "https://oswc.in"
  },
  "tags": [
    "graduates",
    "assistant",
    "superintendent",
    "odisha"
  ],
  "searchKeywords": [
    "oswc",
    "assistant superintendent",
    "warehouse assistant",
    "odisha state warehousing corporation"
  ],
  "targetCategories": [
    "General",
    "SC",
    "ST",
    "OBC"
  ],
  "streams": [
    "any"
  ],
  "specializations": [
    "any"
  ],
  "searchTokens": [
    "state",
    "psu",
    "graduates",
    "assistant",
    "superintendent",
    "odisha",
    "oswc",
    "assistant superintendent",
    "warehouse assistant",
    "odisha state warehousing corporation",
    "food, supplies & consumer welfare department"
  ],
  "recommendationTargets": {
    "minEducationRank": 4,
    "eligibleStreams": [],
    "eligibleSpecializations": [],
    "age": {
      "asOnDate": { "$date": "2026-05-15T00:00:00.000Z" },
      "min": 21,
      "maxGen": 38,
      "maxObc": 41,
      "maxScSt": 43
    },
    "genders": ["male", "female"],
    "categories": ["ur", "sebc", "sc", "st"],
    "organizationTypes": ["State", "PSU"],
    "roles": ["Assistant"],
    "selectionFlags": {
      "hasWrittenTest": true,
      "hasPhysicalTest": false,
      "hasInterview": false
    }
  },
  "popularityScore": 0,
  "viewCount": 0,
  "saveCount": 0,
  "meta": {
    "dataCompleteness": "full",
    "source": "Official Gazetted Notification",
    "notes": "Verified against the latest ORSP matrix values."
  },
  "isRecommendationProcessed": false,
  "schemaVersion": 3
}
```
