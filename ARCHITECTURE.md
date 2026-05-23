# aspirantcareer.in API — Architecture Documentation

> Author: Vishal Kumar
> Last Updated: March 2026
> Deployed On: Render
> Frontend: https://www.aspirantcareer.in  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Architecture Diagram](#4-architecture-diagram)
5. [Database Models](#5-database-models)
6. [API Reference](#6-api-reference)
   - 6.1 [Public Routes](#61-public-routes)
   - 6.2 [Search API](#62-search-api-new) ⭐ New
   - 6.3 [Auth Routes](#63-auth-routes)
   - 6.4 [Protected Routes](#64-protected-routes)
   - 6.5 [Bookmark API](#65-bookmark-api-new) ⭐ New
   - 6.6 [Health Check](#66-health-check)
7. [Authentication Flow](#7-authentication-flow)
8. [Caching Strategy](#8-caching-strategy)
9. [Scalability Setup](#9-scalability-setup)
10. [Environment Variables](#10-environment-variables)
11. [How to Run Locally](#11-how-to-run-locally)

---

## 1. Project Overview

aspirantcareer.in is a **Government Job Information API** that provides:
- Latest government job listings with full details
- Admit card releases
- Exam results
- User account system with job preferences
- Personalized job recommendations based on user profile
- Announcement/notification system

The API serves the frontend website **aspirantcareer.in** which helps Indian students
track government job openings, admit cards, and results in one place.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js v5 |
| Database | MongoDB (via Mongoose v8) |
| Caching | Redis (via ioredis) — optional |
| Authentication | JWT stored in httpOnly cookies |
| Email | Nodemailer + Gmail SMTP |
| Password | bcryptjs |
| Rate Limiting | express-rate-limit |
| Compression | compression (gzip) |
| Process Manager | Node.js cluster (built-in) |
| Hosting | Render |

---

## 3. Folder Structure

```
aspirantcareer-apiv2/
│
├── index.js              # Express app — middleware, routes, server start
├── cluster.js            # Node.js cluster — forks one worker per CPU core
│
├── config/
│   └── db.js             # MongoDB connection with pool configuration
│
├── models/
│   └── webmodel.js       # All Mongoose schemas and models
│
├── controller/
│   ├── webController.js      # Jobs, Admit Cards, Results, Announcements
│   ├── authController.js     # Signup and Login
│   ├── userController.js     # Profile, Preferences, Job Recommendations
│   └── verifyEmailController.js  # Email verification handler
│
├── routes/
│   └── webroutes.js      # All route definitions — public + protected
│
├── middleware/
│   ├── auth.js           # JWT verification middleware
│   └── rateLimiter.js    # Rate limiting for signup and login routes
│
├── utils/
│   ├── emailService.js   # Nodemailer — sends verification emails
│   ├── cache.js          # Redis cache — get, set, clear
│   └── validation.js     # Input validation helpers
│
└── ARCHITECTURE.md       # This file
```

---

## 4. Architecture Diagram

```
                          INTERNET
                             │
                    ┌────────▼────────┐
                    │   Render CDN    │  (HTTPS termination)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  cluster.js     │  Master process
                    │  (Node Cluster) │  Forks N workers (1 per CPU)
                    └────────┬────────┘
                             │ fork
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──┐  ┌────────▼──┐  ┌───────▼───┐
     │ Worker 1  │  │ Worker 2  │  │ Worker N  │  Each runs index.js
     │ (Express) │  │ (Express) │  │ (Express) │
     └────────┬──┘  └────────┬──┘  └───────┬───┘
              └──────────────┼──────────────┘
                             │
               ┌─────────────┼─────────────┐
               │                           │
      ┌────────▼────────┐       ┌──────────▼──────────┐
      │  Redis Cache    │       │  MongoDB Atlas       │
      │  (ioredis)      │       │  (Mongoose pool=10)  │
      │  TTL: 5 min     │       │  Collections:        │
      └─────────────────┘       │  - jobs              │
                                │  - admitcards        │
                                │  - results           │
                                │  - accounts          │
                                │  - userpreferences   │
                                │  - announcements     │
                                └──────────────────────┘
```

---

## 5. Database Models

All models are defined in [models/webmodel.js](models/webmodel.js).

### 5.1 Jobs (`jobs` collection)

The most detailed model. Stores complete job information.

| Field | Type | Description |
|---|---|---|
| `title` | String | Job title e.g. "SSC GD Constable 2025" |
| `jobCode` | String (unique) | e.g. "SSC-GD-2025" |
| `department` | String | e.g. SSC, UPSC, RRB |
| `conductingBody` | String | Exam conducting organization |
| `jobDomains` | [String] | Enum: Central, State, Defence, Police, Railway, Banking, Teaching, PSU, Medical, Engineering, Other |
| `location` | String | Default: "All India" |
| `isActive` | Boolean | Whether job is currently active |
| `vacancies` | Object | total count + breakup by post/category/gender |
| `eligibility` | Object | education requirements + complex rules for teaching/defence |
| `ageCriteria` | Object | age range or DOB range + relaxation rules |
| `physicalCriteria` | Object | height, chest, running — for police/defence jobs |
| `selectionProcess` | [Object] | stages: CBT, PET, Interview etc. |
| `applicationFee` | [Object] | fee per category (GEN/OBC/SC/ST) |
| `importantDates` | Object | applyStart, applyEnd, examDate, admitCardDate, resultDate |
| `links` | Object | notification PDF, apply online, syllabus, official website |
| `tags` | [String] | e.g. "10th Pass", "Police", "SSC" |
| `searchKeywords` | [String] | indexed for search |

**Indexes:** `title` (text), `jobCode`, `jobDomains`, `eligibility.education.level`, `tags`

---

### 5.2 AdmitCard (`AdmitCard` collection)

| Field | Type | Description |
|---|---|---|
| `title` | String | e.g. "SSC GD 2025 Admit Card" |
| `description` | String | Additional details |
| `releaseDate` | Date | When admit card was released |
| `examDate` | Date | Exam date |
| `category` | String | Job category |

---

### 5.3 Result (`result` collection)

| Field | Type | Description |
|---|---|---|
| `title` | String | e.g. "SSC GD 2025 Result" |
| `description` | String | Additional details |
| `ReleaseDate` | Date | When result was declared |
| `DownloadLink` | String | URL to download result PDF |

---

### 5.4 User Account (`accounts` collection)

| Field | Type | Description |
|---|---|---|
| `firstName` | String | User's first name |
| `lastName` | String | User's last name |
| `email` | String (unique) | Login email |
| `password` | String | bcrypt hashed |
| `isVerified` | Boolean | Email verified or not |
| `verificationToken` | String | Token sent via email |

---

### 5.5 User Preferences (`userpreferences` collection)

Linked to user via `userId` (ref: accounts).

| Field | Type | Description |
|---|---|---|
| `userId` | ObjectId | Reference to accounts |
| `education.levels` | [String] | e.g. ["graduate", "12th"] |
| `education.stream` | [String] | e.g. ["science", "arts"] |
| `preferredLocations` | [String] | e.g. ["Uttar Pradesh", "All India"] |
| `category` | String | gen / obc / sc / st / ews |
| `gender` | String | male / female / any |
| `organizationTypes` | [String] | e.g. ["police", "railway"] |
| `interests` | [String] | e.g. ["constable", "clerk"] |

---

### 5.6 Announcement (`announcement` collection)

| Field | Type | Description |
|---|---|---|
| `title` | String | Announcement text |
| `status` | String | Status label |
| `link` | String | URL |
| `orderNo` | Number | Display order |
| `isActive` | Boolean | Show/hide |

---

## 6. API Reference

Base URL: `https://api.aspirantcareer.in/web/api`

---

### 6.1 Public Routes

| Method | Endpoint | Description | Query Params |
|---|---|---|---|
| GET | `/search` | **Job search with suggestions** ⭐ | `q`, `limit` |
| GET | `/getJobs` | All jobs with pagination | `page`, `limit`, `search` |
| GET | `/hompageJobs` | Jobs for homepage (limited fields) | — |
| GET | `/getJobs/:id` | Single job by MongoDB ID | — |
| GET | `/getadmitcards` | All admit cards with pagination | `page`, `limit`, `category`, `search` |
| GET | `/getresultcards` | All results with pagination | `page`, `limit`, `category`, `search` |
| GET | `/announcement` | Latest 4 jobs + 4 admit cards + 4 results | — |
| GET | `/Jobs-category/:type` | Jobs filtered by domain type | type = Central/State/Railway etc. |
| GET | `/exam-calendar` | Upcoming exam dates | `month`, `year`, `category` |
| GET | `/logout` | Clear auth cookie | — |

---

### 6.2 Search API (New)

> Used for real-time autocomplete search suggestions on the frontend.

**Endpoint**

```
GET /web/api/search
```

**Query Parameters**

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `q` | string | Yes | — | Search keyword (min 1 char) |
| `limit` | number | No | `8` | Max results to return (max: 20) |

**Searched Fields**

The API searches across multiple fields simultaneously using a **case-insensitive regex**:

| Field | Example Match |
|---|---|
| `title` | "SSC GD Constable 2025" |
| `department` | "SSC", "UPSC", "RRB" |
| `conductingBody` | "Staff Selection Commission" |
| `jobDomains` | "Railway", "Police", "Banking" |
| `tags` | "10th Pass", "Graduate" |
| `searchKeywords` | Custom indexed keywords |
| `location` | "All India", "Uttar Pradesh" |

**Filters Applied**

- Only `isActive: true` jobs are returned
- Results sorted by `createdAt` descending (newest first)

**Response Fields**

Each result includes only the fields needed for suggestion UI (lightweight response):

```json
{
  "message": "Search results",
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "title": "SSC GD Constable 2025",
      "department": "SSC",
      "conductingBody": "Staff Selection Commission",
      "jobDomains": ["Central", "Police"],
      "location": "All India",
      "vacancies": {
        "total": 39481
      },
      "importantDates": {
        "applyEnd": "2025-03-31T00:00:00.000Z"
      }
    }
  ]
}
```

**Example Requests**

```bash
# Search for "railway" jobs (default 8 results)
GET /web/api/search?q=railway

# Search for "SSC" with 5 results
GET /web/api/search?q=SSC&limit=5

# Search for "UP police constable"
GET /web/api/search?q=UP+police+constable
```

**Example Responses**

Success (results found):
```json
{
  "message": "Search results",
  "data": [
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "title": "RRB Group D 2025",
      "conductingBody": "Railway Recruitment Board",
      "jobDomains": ["Railway"],
      "location": "All India",
      "vacancies": { "total": 32438 },
      "importantDates": { "applyEnd": "2025-04-15T00:00:00.000Z" }
    },
    {
      "_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "title": "RRB NTPC Graduate 2025",
      "conductingBody": "Railway Recruitment Board",
      "jobDomains": ["Railway"],
      "location": "Zone-wise",
      "vacancies": { "total": 11558 },
      "importantDates": { "applyEnd": "2025-05-01T00:00:00.000Z" }
    }
  ]
}
```

Empty query (returns empty array without hitting DB):
```json
{
  "message": "Search results",
  "data": []
}
```

No results found:
```json
{
  "message": "Search results",
  "data": []
}
```

Error:
```json
{
  "error": "Search failed",
  "details": "..."
}
```

**Frontend Usage**

The search API powers the `SearchBar` component (`src/components/Search/SearchBar.tsx`):

```
User types "railway"
       ↓ debounce 280ms
GET /web/api/search?q=railway&limit=8
       ↓
Returns 8 matching jobs
       ↓
Displayed as suggestion dropdown with:
  - Title (matching text highlighted in teal)
  - Conducting body + location
  - Domain color badges
  - Vacancy count + last application date
       ↓
User clicks suggestion
       ↓
Navigates to: /details/[slug]/[_id]
```

**Performance Notes**

- No Redis caching on this endpoint (real-time search must be fresh)
- MongoDB regex query is fast due to `title` index on jobs collection
- Response payload is small (~200–500 bytes per result) — only 7 fields returned
- Debounced at 280ms on frontend to reduce API calls

---

### 6.3 Auth Routes

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| POST | `/userSignup` | Register new user | 40 req/hour per IP |
| POST | `/verify-otp` | Verify OTP sent to email | — |
| POST | `/resend-otp` | Resend OTP to email | — |
| POST | `/login` | Login and get JWT cookie | 40 req/15min per IP |
| POST | `/forgot-password` | Request password reset OTP | Rate limited |
| POST | `/verify-reset-otp` | Verify reset OTP | — |
| POST | `/reset-password` | Set new password | — |

---

### 6.4 Protected Routes (JWT cookie required)

| Method | Endpoint | Description |
|---|---|---|
| GET  | `/user/profile`           | Get logged-in user details |
| POST | `/user/save-preferences`  | Save job preferences |
| GET  | `/getUserData`            | Get saved preferences |
| GET  | `/user/preferencesJobs`   | Get personalized job recommendations |
| POST | `/user/bookmark/:jobId`   | Toggle bookmark (save / unsave) |
| GET  | `/user/bookmark/:jobId`   | Check if a job is bookmarked |
| GET  | `/user/bookmarks`         | Get all bookmarked jobs |

---

### 6.5 Bookmark API ⭐ New

Allows authenticated users to save/unsave jobs across devices.

**Model:** `savedjobs` collection (userId + jobId unique pair)

#### Toggle Bookmark
```
POST /web/api/user/bookmark/:jobId
Auth: Required (JWT cookie)
```
- If job is **not saved** → creates record → returns `{ bookmarked: true }`
- If job **already saved** → deletes record → returns `{ bookmarked: false }`

**Response:**
```json
{ "bookmarked": true, "message": "Job saved to bookmarks" }
```

#### Check Bookmark
```
GET /web/api/user/bookmark/:jobId
Auth: Required (JWT cookie)
```
**Response:**
```json
{ "bookmarked": false }
```

#### Get All Bookmarks
```
GET /web/api/user/bookmarks
Auth: Required (JWT cookie)
```
Returns array of full job objects (title, conductingBody, department, jobDomains, location, vacancies, importantDates, isActive).

**Response:**
```json
{
  "data": [
    {
      "_id": "...",
      "title": "SSC CGL 2025",
      "conductingBody": "SSC",
      "jobDomains": ["Central"],
      "location": "All India",
      "vacancies": { "total": 17727 },
      "importantDates": { "applyEnd": "2025-07-31T00:00:00.000Z" },
      "isActive": true
    }
  ]
}
```

**Frontend behaviour:**
- Logged-in users → API (synced across devices)
- Guest users → localStorage fallback (stored in `js_bookmarks` key)
- `BookmarkButton.tsx` checks auth via `useAuth()` and routes accordingly
- Share buttons in `ShareButtons.tsx` generate WhatsApp, Telegram, and copy-link sharing

---

### 6.6 Health Check

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server status, uptime, process ID |

---

## 7. Authentication Flow

```
1. User signs up → POST /userSignup
      ↓
2. Password hashed with bcryptjs (10 rounds)
   Verification email sent via Gmail SMTP
      ↓
3. User clicks email link → GET /verify-email?token=xxx
   isVerified = true saved in DB
      ↓
4. User logs in → POST /login
   JWT token generated (contains userId)
   Token stored in httpOnly cookie (secure, sameSite=none)
      ↓
5. Protected requests → cookie sent automatically by browser
   auth.js middleware reads cookie → verifies JWT → attaches req.user
      ↓
6. Logout → GET /logout
   Cookie cleared from browser
```

**JWT Config:**
- Stored in: `httpOnly` cookie (not localStorage — safer)
- Cookie flags: `secure: true`, `sameSite: "none"` (required for cross-origin)
- Secret: `process.env.JWT_SECRET`

---

## 8. Caching Strategy

File: [utils/cache.js](utils/cache.js)

| Cached Data | Cache Key Pattern | TTL |
|---|---|---|
| All jobs (paginated) | `jobs_p{page}_l{limit}_s{search}` | 5 min |
| Admit cards (paginated) | `admitcards_p{page}_l{limit}_c{cat}_s{search}` | 5 min |
| Results (paginated) | `results_p{page}_l{limit}_c{cat}_s{search}` | 5 min |

**How it works:**
1. Request comes in
2. Check Redis for cached response
3. If cache hit → return immediately (no MongoDB query)
4. If cache miss → query MongoDB → store in Redis → return response

**Note:** Redis is optional. If `REDIS_URL` is not set in `.env`, the app works normally without caching (just slower).

---

## 9. Scalability Setup

### Clustering ([cluster.js](cluster.js))

Node.js is single-threaded by default — it only uses 1 CPU core.
`cluster.js` spawns one worker process per CPU core, multiplying throughput.

```
Server with 4 cores → 4 workers → can handle ~4x more requests
```

- Master process manages workers
- If a worker crashes, master auto-restarts it
- `npm start` → runs cluster.js
- `npm run start:single` → runs single process (useful for debugging)

### Compression ([index.js](index.js))

`compression` middleware gzip-compresses all API responses.
Reduces response size by **60-70%**, improving speed especially on mobile networks.

### MongoDB Connection Pool ([config/db.js](config/db.js))

```
maxPoolSize: 10  → each worker maintains up to 10 DB connections
```

With 4 workers × 10 connections = 40 total MongoDB connections max.

### Rate Limiting ([middleware/rateLimiter.js](middleware/rateLimiter.js))

| Route | Window | Max Requests |
|---|---|---|
| `/userSignup` | 1 hour | 40 per IP |
| `/login` | 15 minutes | 40 per IP |

---

## 10. Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=5000

# MongoDB
DBURL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/aspirantcareer

# JWT
JWT_SECRET=your_super_secret_key_here

# Email (Gmail SMTP)
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your_gmail_app_password

# Frontend URL (for email links and CORS)
FRONTEND_URL=https://www.aspirantcareer.in

# Redis (optional — app works without this)
REDIS_URL=redis://default:password@host:6379
```

> **Gmail Note:** Use an App Password, not your real Gmail password.
> Generate at: Google Account → Security → 2FA → App Passwords

---

## 11. How to Run Locally

### Prerequisites
- Node.js v18+
- MongoDB Atlas account (or local MongoDB)
- Gmail account with App Password

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd aspirantcareer-apiv2

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Fill in your values

# 4. Run in development mode (single process, auto-restart)
npm run dev

# 5. Run in production mode (multi-core cluster)
npm start
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Development with nodemon (single process) |
| `npm start` | Production with clustering (all CPU cores) |
| `npm run start:single` | Production single process (for debugging) |

---

## Common Issues

| Problem | Cause | Fix |
|---|---|---|
| Cookie not sent | CORS or sameSite issue | Check `credentials: true` in CORS + frontend fetch |
| JWT expired | Token TTL passed | User must login again |
| Redis not connecting | Wrong REDIS_URL | App works without Redis, just check logs |
| Email not sending | Wrong Gmail App Password | Regenerate App Password in Google Account |
| MongoDB timeout | Atlas IP whitelist | Add your server IP to MongoDB Atlas Network Access |
