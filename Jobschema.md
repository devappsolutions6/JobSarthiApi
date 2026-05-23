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

---

## 📝 Example JSON Document

> [!WARNING]
> **CRITICAL: Date Fields**
> All date fields (e.g., `importantDates.*.date`, `createdAt`) MUST be stored as proper **MongoDB Date objects**, not raw strings. If you are inserting data manually or via a script, ensure they are cast to `Date` (e.g., using `new Date()` in Node.js or `{"$date": "..."}` in MongoDB JSON imports).

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
