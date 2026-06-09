# Job Schema Specification

This document defines the schema structure and the standard allowed codes for job database entries. 

---

## 🎓 Standard Education Level Codes (`levelCode`)


To ensure exact matching in the recommendation engine and prevent server crashes, the `levelCode` field in `eligibility.education[]` must strictly match one of the following standardized codes. **Do not use custom codes like `EDU_PG` or `EDU_LLB`.**

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

## 🗂️ Multi-Post Jobs (Parent/Child Relationship)

**CRITICAL RULE:** We no longer store multiple posts inside a nested `eligibility.posts` array. 
If a single official notification contains multiple distinct posts (e.g., "Assistant Superintendent" and "Warehouse Assistant"), you must create **MULTIPLE INDEPENDENT JSON DOCUMENTS** in the database, one for each post. 

These individual post documents act as separate "cards" on the frontend but are linked together using the following fields:
* **`notificationGroupId`**: The common master job code (e.g., `OSWC-2026-ASST`). All sub-jobs from the same notification MUST share this exact ID.
* **`masterTitle`**: The full title of the official notification (shared exactly across all sub-jobs).
* **`jobCode` & `urlTitle`**: Must be unique for each sub-job. We append `-P1`, `-P2`, etc., to the master codes.
* **`title`**: Should be the specific short name of the individual post (e.g., "Assistant Superintendent").

---

## 📝 Manual Entry Template (Parent/Child Example)

This is the exact structure you need to use when manually creating JSONs for the database. These are **real records pulled from the production DB** showing how a Parent card (`isPrimaryPost: true`) and a Child card (`isPrimaryPost: false`) are structured and linked.

> [!WARNING]
> **CRITICAL: Date Fields & Validation**
> All date fields (e.g., `importantDates.*.date`, `createdAt`) MUST be stored as proper **valid MongoDB Date objects**, not raw strings or `Invalid Date` objects. Passing an `Invalid Date` (which holds a `NaN` value) will trigger a Mongoose `CastError` and crash background services like recommendation engines.
> * **Verification**: Always ensure date objects are valid in your scripts using `!isNaN(new Date(val).getTime())`.
> * **Fallbacks**: If a date is unknown or not specified, explicitly set it to `null` instead of raw strings or corrupted values.

> [!IMPORTANT]
> **CRITICAL: Status Field Must Exist**
> The `status` field (e.g., `"active"`, `"upcoming"`, `"expired"`) **must be explicitly defined** in the MongoDB document. Do not rely on Mongoose default values when inserting or importing documents directly via raw MongoDB scripts. Because the API filters strictly on `{ status: "active" }` at the database level, documents missing this field will **not** be returned or published.

### 1. Primary/Parent Job Document (`isPrimaryPost: true`)

This is the main card. Notice `isPrimaryPost: true`.

```text
{
  "title": "School Teacher (Class 1 to 5)",
  "jobCode": "BPSC-TRE-4.0-2026-P1",
  "department": "Bihar Education Department",
  "conductingBody": "Bihar Public Service Commission (BPSC)",
  "jobDomains": [
    "state",
    "teaching"
  ],
  "location": "bihar",
  "description": "Bihar Public Service Commission (BPSC) has released a short notice for TRE 4.0 School Teacher Recruitment 2026 with approximately 44,000+ vacancies across Primary (Class 1-5), Middle (Class 6-8), Secondary TGT (Class 9-10), and Senior Secondary PGT (Class 11-12) levels. Candidates with B.Ed and valid CTET/BTET/STET qualification are eligible. Age calculated as on 01 August 2025.",
  "isActive": true,
  "vacancies": {
    "total": 10778,
    "isTentative": false,
    "categoryWiseAvailable": false,
    "categoryWise": {
      "gen": null,
      "obc": null,
      "sc": null,
      "st": null,
      "ews": null,
      "sebc": null,
      "female": null,
      "other": null
    },
    "genderWise": {
      "male": null,
      "female": null
    },
    "horizontalReservation": {
      "women": 0,
      "exServicemen": 0,
      "pwd": 0
    }
  },
  "eligibility": {
    "age": {
      "min": 18,
      "max": 42
    },
    "education": [
      {
        "degree": "Bachelor's Degree",
        "levelCode": "EDU_GRAD",
        "stream": "Any",
        "specialization": null,
        "minMarks": 50,
        "required": true,
        "_id": "6a1598cc43e313624c31900c"
      },
      {
        "degree": "B.Ed",
        "levelCode": "EDU_GRAD",
        "stream": "Education",
        "specialization": null,
        "minMarks": null,
        "required": true,
        "_id": "6a1598cc43e313624c31900d"
      }
    ],
    "experience": {
      "required": false,
      "minYears": null,
      "field": null
    },
    "alternativeQualifications": [
      {
        "degree": "Bachelor's Degree + D.El.Ed",
        "description": "Bachelor's in any stream with Diploma in Elementary Education",
        "_id": "6a1598cc43e313624c31900e"
      },
      {
        "degree": "10+2 + 2 Year D.El.Ed / Special Diploma",
        "description": "Minimum 50% marks in Intermediate",
        "_id": "6a1598cc43e313624c31900f"
      },
      {
        "degree": "10+2 + 2 Year D.El.Ed",
        "description": "45% marks in Intermediate as per 2002 NCTE Norms",
        "_id": "6a1598cc43e313624c319010"
      },
      {
        "degree": "10+2 + 4 Year B.L.Ed",
        "description": "Minimum 50% marks in Intermediate",
        "_id": "6a1598cc43e313624c319011"
      },
      {
        "degree": "Master's Degree + 3 Year B.Ed-M.Ed",
        "description": "Minimum 55% in Master's Degree",
        "_id": "6a1598cc43e313624c319012"
      }
    ],
    "certifications": [
      "CTET Paper I OR BTET Paper I Qualified"
    ],
    "skills": [],
    "generalRequirements": [
      "Candidates must be domicile of Bihar or fulfill eligibility as per BPSC norms",
      "CTET / BTET / STET qualification mandatory as per post level",
      "Age calculated as on 01 August 2025",
      "Post-wise vacancy split will be available in official detailed notification on bpsc.bih.nic.in"
    ]
  },
  "ageCriteria": {
    "type": "NUMBER",
    "numberBased": {
      "min": 18,
      "max": 42
    },
    "dobBased": {},
    "relaxationRules": [
      {
        "category": "UR Male",
        "years": 0
      },
      {
        "category": "UR Female",
        "years": 3
      },
      {
        "category": "BC / EBC Male & Female",
        "years": 3
      },
      {
        "category": "SC / ST Male & Female",
        "years": 5
      },
      {
        "category": "Special School TRE 4.0",
        "years": null
      }
    ]
  },
  "physicalCriteria": {
    "applicable": false,
    "height": {
      "female": {
        "unit": "cm"
      },
      "male": {
        "unit": "cm"
      }
    },
    "chest": {
      "max": {
        "unit": "cm"
      },
      "min": {
        "unit": "cm"
      }
    },
    "weight": {
      "male": {
        "min": null,
        "max": null,
        "unit": "kg"
      },
      "female": {
        "min": null,
        "max": null,
        "unit": "kg"
      }
    },
    "running": {
      "female": {
        "distance": {
          "unit": "km"
        },
        "time": {
          "unit": "min"
        }
      },
      "male": {
        "distance": {
          "unit": "km"
        },
        "time": {
          "unit": "min"
        }
      }
    },
    "events": []
  },
  "selectionProcess": [
    {
      "order": 1,
      "stage": "Written Examination",
      "description": "Subject-wise written exam conducted by BPSC for all post levels — Primary, Middle, TGT and PGT.",
      "qualifying": false,
      "marksWeightage": null
    },
    {
      "order": 2,
      "stage": "Document Verification (DV)",
      "description": "Verification of educational qualifications, CTET/BTET/STET certificates, category and domicile documents.",
      "qualifying": true,
      "marksWeightage": null
    }
  ],
  "applicationFee": [
    {
      "category": "All Categories",
      "amount": 100,
      "refundable": false
    }
  ],
  "importantDates": {
    "notificationDate": {
      "date": "2026-03-21T00:00:00.000Z",
      "tentative": false,
      "note": ""
    },
    "applyStart": {
      "date": null,
      "tentative": false,
      "note": ""
    },
    "applyEnd": {
      "date": null,
      "tentative": false,
      "note": ""
    },
    "feeLastDate": {
      "date": null,
      "tentative": false,
      "note": ""
    },
    "correctionWindow": {
      "tentative": false
    },
    "examDate": {
      "date": null,
      "tentative": true,
      "note": ""
    },
    "admitCardDate": {
      "date": null,
      "tentative": true,
      "note": ""
    },
    "resultDate": {
      "date": null,
      "tentative": true,
      "note": ""
    },
    "documentVerificationDate": {
      "date": null,
      "tentative": true,
      "note": ""
    },
    "joiningDate": {
      "date": null,
      "tentative": true,
      "note": ""
    }
  },
  "links": {
    "notification": "https://bpsc.bih.nic.in",
    "applyOnline": "https://bpsc.bih.nic.in",
    "syllabus": null,
    "admitCard": null,
    "result": null,
    "answerKey": null,
    "officialWebsite": "https://bpsc.bih.nic.in"
  },
  "tags": [
    "bpsc",
    "bihar",
    "tre 4.0",
    "school teacher",
    "tgt",
    "pgt",
    "primary teacher",
    "middle school teacher",
    "teaching job bihar",
    "b.ed job 2026",
    "ctet btet stet required",
    "44000 posts",
    "state govt job",
    "bihar teacher recruitment 2026",
    "bpsc 2026"
  ],
  "searchKeywords": [
    "bpsc school teacher tre 4.0 recruitment 2026",
    "bpsc tre 4 teacher vacancy 2026",
    "bihar primary school teacher recruitment 2026",
    "bpsc tgt pgt teacher 2026",
    "bihar 44000 teacher vacancy 2026",
    "bpsc middle school teacher class 6 to 8",
    "bpsc teacher class 1 to 5 recruitment",
    "bpsc pgt class 11 12 teacher 2026",
    "bihar teacher bed ctet btet stet job",
    "bpsc.bih.nic.in teacher recruitment 2026",
    "bihar teacher tre 4 apply online",
    "bpsc secondary teacher tgt vacancy 2026"
  ],
  "createdAt": "2026-03-21T10:11:00.000Z",
  "updatedAt": "2026-05-26T12:57:48.096Z",
  "slug": "bpsc-school-teacher-tre-4-recruitment-2026-44000-posts",
  "schemaVersion": 3,
  "status": "active",
  "examLanguages": [
    "Hindi",
    "English"
  ],
  "isFeatured": false,
  "isPinned": false,
  "meta": {
    "dataCompleteness": "full",
    "lastVerifiedAt": "2026-05-19T10:33:41.303Z",
    "source": "official_notification",
    "notes": ""
  },
  "organization": "",
  "popularityScore": 0,
  "postType": "regular",
  "salaryRange": {
    "min": null,
    "max": null,
    "currency": "INR",
    "unit": "monthly",
    "note": ""
  },
  "saveCount": 0,
  "shortDescription": "BPSC School Teacher TRE 4.0 Recruitment 2026 – 44000+ Primary, Middle, TGT & PGT Posts...",
  "stateEligibility": [
    "Bihar"
  ],
  "targetCategories": [
    "State",
    "Teaching"
  ],
  "urlTitle": "bpsc-school-teacher-tre-4-recruitment-2026-44000-posts-p1",
  "viewCount": 0,
  "relatedJobs": [],
  "isRecommendationProcessed": true,
  "notificationGroupId": "BPSC-TRE-4.0-2026",
  "isPrimaryPost": true,
  "masterTitle": "BPSC School Teacher TRE 4.0 Recruitment 2026 – 44000+ Primary, Middle, TGT & PGT Posts"
}
```

### 2. Sub/Child Job Document (`isPrimaryPost: false`)

This is the sub-post card. Notice it shares the same `notificationGroupId` and `masterTitle` as the parent, but `isPrimaryPost` is `false`.

```text
{
  "title": "Middle School Teacher (Class 6 to 8)",
  "jobCode": "BPSC-TRE-4.0-2026-P2",
  "department": "Bihar Education Department",
  "conductingBody": "Bihar Public Service Commission (BPSC)",
  "jobDomains": [
    "state",
    "teaching"
  ],
  "location": "bihar",
  "description": "Bihar Public Service Commission (BPSC) has released a short notice for TRE 4.0 School Teacher Recruitment 2026 with approximately 44,000+ vacancies across Primary (Class 1-5), Middle (Class 6-8), Secondary TGT (Class 9-10), and Senior Secondary PGT (Class 11-12) levels. Candidates with B.Ed and valid CTET/BTET/STET qualification are eligible. Age calculated as on 01 August 2025.",
  "isActive": true,
  "vacancies": {
    "total": 8583,
    "isTentative": false,
    "categoryWiseAvailable": false,
    "categoryWise": {
      "gen": null,
      "obc": null,
      "sc": null,
      "st": null,
      "ews": null,
      "sebc": null,
      "female": null,
      "other": null
    },
    "genderWise": {
      "male": null,
      "female": null
    },
    "horizontalReservation": {
      "women": 0,
      "exServicemen": 0,
      "pwd": 0
    }
  },
  "eligibility": {
    "age": {
      "min": 18,
      "max": 42
    },
    "education": [
      {
        "degree": "Graduate / Post Graduate",
        "levelCode": "EDU_POSTGRAD",
        "stream": "Any",
        "specialization": null,
        "minMarks": 50,
        "required": true,
        "_id": "6a1598cc43e313624c319014"
      },
      {
        "degree": "B.Ed",
        "levelCode": "EDU_GRAD",
        "stream": "Education",
        "specialization": null,
        "minMarks": null,
        "required": true,
        "_id": "6a1598cc43e313624c319015"
      }
    ],
    "experience": {
      "required": false,
      "minYears": null,
      "field": null
    },
    "alternativeQualifications": [
      {
        "degree": "Graduate + 2 Year D.Ed",
        "description": "Diploma in Elementary Education",
        "_id": "6a1598cc43e313624c319016"
      },
      {
        "degree": "Graduate + B.Ed",
        "description": "45% marks as per NCTE Norms",
        "_id": "6a1598cc43e313624c319017"
      },
      {
        "degree": "Graduate + B.Ed Special Education",
        "description": "Minimum 50% in Graduation",
        "_id": "6a1598cc43e313624c319018"
      },
      {
        "degree": "Post Graduate + 3 Year B.Ed-M.Ed",
        "description": "Minimum 55% in Post Graduation",
        "_id": "6a1598cc43e313624c319019"
      },
      {
        "degree": "4 Year BA B.Ed / B.Sc B.Ed Integrated",
        "description": "Minimum 50% in Graduation",
        "_id": "6a1598cc43e313624c31901a"
      }
    ],
    "certifications": [],
    "skills": [],
    "generalRequirements": [
      "Candidates must be domicile of Bihar or fulfill eligibility as per BPSC norms",
      "CTET / BTET / STET qualification mandatory as per post level",
      "Age calculated as on 01 August 2025",
      "Post-wise vacancy split will be available in official detailed notification on bpsc.bih.nic.in"
    ]
  },
  "ageCriteria": {
    "type": "NUMBER",
    "numberBased": {
      "min": 18,
      "max": 42
    },
    "dobBased": {},
    "relaxationRules": [
      {
        "category": "UR Male",
        "years": 0
      },
      {
        "category": "UR Female",
        "years": 3
      },
      {
        "category": "BC / EBC Male & Female",
        "years": 3
      },
      {
        "category": "SC / ST Male & Female",
        "years": 5
      },
      {
        "category": "Special School TRE 4.0",
        "years": null
      }
    ]
  },
  "physicalCriteria": {
    "applicable": false,
    "height": {
      "female": {
        "unit": "cm"
      },
      "male": {
        "unit": "cm"
      }
    },
    "chest": {
      "max": {
        "unit": "cm"
      },
      "min": {
        "unit": "cm"
      }
    },
    "weight": {
      "male": {
        "min": null,
        "max": null,
        "unit": "kg"
      },
      "female": {
        "min": null,
        "max": null,
        "unit": "kg"
      }
    },
    "running": {
      "female": {
        "distance": {
          "unit": "km"
        },
        "time": {
          "unit": "min"
        }
      },
      "male": {
        "distance": {
          "unit": "km"
        },
        "time": {
          "unit": "min"
        }
      }
    },
    "events": []
  },
  "selectionProcess": [
    {
      "order": 1,
      "stage": "Written Examination",
      "description": "Subject-wise written exam conducted by BPSC for all post levels — Primary, Middle, TGT and PGT.",
      "qualifying": false,
      "marksWeightage": null
    },
    {
      "order": 2,
      "stage": "Document Verification (DV)",
      "description": "Verification of educational qualifications, CTET/BTET/STET certificates, category and domicile documents.",
      "qualifying": true,
      "marksWeightage": null
    }
  ],
  "applicationFee": [
    {
      "category": "All Categories",
      "amount": 100,
      "refundable": false
    }
  ],
  "importantDates": {
    "notificationDate": {
      "date": "2026-03-21T00:00:00.000Z",
      "tentative": false,
      "note": ""
    },
    "applyStart": {
      "date": null,
      "tentative": false,
      "note": ""
    },
    "applyEnd": {
      "date": null,
      "tentative": false,
      "note": ""
    },
    "feeLastDate": {
      "date": null,
      "tentative": false,
      "note": ""
    },
    "correctionWindow": {
      "tentative": false
    },
    "examDate": {
      "date": null,
      "tentative": true,
      "note": ""
    },
    "admitCardDate": {
      "date": null,
      "tentative": true,
      "note": ""
    },
    "resultDate": {
      "date": null,
      "tentative": true,
      "note": ""
    },
    "documentVerificationDate": {
      "date": null,
      "tentative": true,
      "note": ""
    },
    "joiningDate": {
      "date": null,
      "tentative": true,
      "note": ""
    }
  },
  "links": {
    "notification": "https://bpsc.bih.nic.in",
    "applyOnline": "https://bpsc.bih.nic.in",
    "syllabus": null,
    "admitCard": null,
    "result": null,
    "answerKey": null,
    "officialWebsite": "https://bpsc.bih.nic.in"
  },
  "tags": [
    "bpsc",
    "bihar",
    "tre 4.0",
    "school teacher",
    "tgt",
    "pgt",
    "primary teacher",
    "middle school teacher",
    "teaching job bihar",
    "b.ed job 2026",
    "ctet btet stet required",
    "44000 posts",
    "state govt job",
    "bihar teacher recruitment 2026",
    "bpsc 2026"
  ],
  "searchKeywords": [
    "bpsc school teacher tre 4.0 recruitment 2026",
    "bpsc tre 4 teacher vacancy 2026",
    "bihar primary school teacher recruitment 2026",
    "bpsc tgt pgt teacher 2026",
    "bihar 44000 teacher vacancy 2026",
    "bpsc middle school teacher class 6 to 8",
    "bpsc teacher class 1 to 5 recruitment",
    "bpsc pgt class 11 12 teacher 2026",
    "bihar teacher bed ctet btet stet job",
    "bpsc.bih.nic.in teacher recruitment 2026",
    "bihar teacher tre 4 apply online",
    "bpsc secondary teacher tgt vacancy 2026"
  ],
  "createdAt": "2026-03-21T10:11:00.000Z",
  "updatedAt": "2026-05-26T12:57:48.096Z",
  "slug": "bpsc-school-teacher-tre-4-recruitment-2026-44000-posts",
  "schemaVersion": 3,
  "status": "active",
  "examLanguages": [
    "Hindi",
    "English"
  ],
  "isFeatured": false,
  "isPinned": false,
  "meta": {
    "dataCompleteness": "full",
    "lastVerifiedAt": "2026-05-19T10:33:41.303Z",
    "source": "official_notification",
    "notes": ""
  },
  "organization": "",
  "popularityScore": 0,
  "postType": "regular",
  "salaryRange": {
    "min": null,
    "max": null,
    "currency": "INR",
    "unit": "monthly",
    "note": ""
  },
  "saveCount": 0,
  "shortDescription": "BPSC School Teacher TRE 4.0 Recruitment 2026 – 44000+ Primary, Middle, TGT & PGT Posts...",
  "stateEligibility": [
    "Bihar"
  ],
  "targetCategories": [
    "State",
    "Teaching"
  ],
  "urlTitle": "bpsc-school-teacher-tre-4-recruitment-2026-44000-posts-p2",
  "viewCount": 0,
  "relatedJobs": [],
  "isRecommendationProcessed": true,
  "notificationGroupId": "BPSC-TRE-4.0-2026",
  "isPrimaryPost": false,
  "masterTitle": "BPSC School Teacher TRE 4.0 Recruitment 2026 – 44000+ Primary, Middle, TGT & PGT Posts"
}
```
