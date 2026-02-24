# JobSarthi API — Architecture Documentation

> Author: Vishal Kumar
> Last Updated: February 2026
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
7. [Authentication Flow](#7-authentication-flow)
8. [Caching Strategy](#8-caching-strategy)
9. [Scalability Setup](#9-scalability-setup)
10. [Environment Variables](#10-environment-variables)
11. [How to Run Locally](#11-how-to-run-locally)

---

## 1. Project Overview

JobSarthi is a **Government Job Information API** that provides:
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
jobsarthiapiv2/
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

### Public Routes (No login required)

| Method | Endpoint | Description | Query Params |
|---|---|---|---|
| GET | `/getJobs` | All jobs with pagination | `page`, `limit`, `search` |
| GET | `/hompageJobs` | Jobs for homepage (limited fields) | — |
| GET | `/getJobs/:id` | Single job by MongoDB ID | — |
| GET | `/getadmitcards` | All admit cards with pagination | `page`, `limit`, `category`, `search` |
| GET | `/getresultcards` | All results with pagination | `page`, `limit`, `category`, `search` |
| GET | `/announcement` | Latest 4 jobs + 4 admit cards + 4 results | — |
| GET | `/Jobs-category/:type` | Jobs filtered by domain type | type = Central/State/Railway etc. |
| GET | `/logout` | Clear auth cookie | — |

### Auth Routes

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| POST | `/userSignup` | Register new user | 40 req/hour per IP |
| GET | `/verify-email?token=` | Verify email address | — |
| POST | `/login` | Login and get JWT cookie | 40 req/15min per IP |

### Protected Routes (JWT cookie required)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/user/profile` | Get logged-in user details |
| POST | `/user/save-preferences` | Save job preferences |
| GET | `/getUserData` | Get saved preferences |
| GET | `/user/preferencesJobs` | Get personalized job recommendations |

### Health Check

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
DBURL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/jobsarthi

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
cd jobsarthiapiv2

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
