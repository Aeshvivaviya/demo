# 📘 Sensussoft AI Hiring System — Complete Documentation

> **Project Name:** Sensussoft Hiring System  
> **Framework:** Next.js 16 (App Router)  
> **Language:** TypeScript  
> **Deployed On:** Vercel  
> **Database:** Upstash Redis  

---

## 📌 1. Project Overview (Project Kya Hai?)

Yeh ek **AI-powered automated hiring system** hai jo Sensussoft company ke liye banaya gaya hai.

**Kaam kya karta hai:**
- Candidate apna form bharta hai aur resume upload karta hai
- System automatically AI se ek unique coding task generate karta hai
- Candidate ke liye GitHub par ek naya repo create hota hai
- Task ka PDF banta hai aur email mein bheja jaata hai
- Jab candidate code push karta hai, progress automatically track hoti hai
- Admin dashboard se saari submissions manage ki ja sakti hain

---

## 🗂️ 2. Project Folder Structure

```
task-manager/
│
├── src/
│   ├── app/
│   │   ├── page.tsx                    ← Main landing page (candidate form)
│   │   ├── layout.tsx                  ← Root HTML layout
│   │   ├── globals.css                 ← Global CSS styles
│   │   │
│   │   ├── admin/
│   │   │   ├── page.tsx                ← Admin login page
│   │   │   └── dashboard/
│   │   │       └── page.tsx            ← Admin dashboard page
│   │   │
│   │   ├── progress/
│   │   │   └── page.tsx                ← Candidate progress tracking page
│   │   │
│   │   └── api/
│   │       ├── submit/
│   │       │   └── route.ts            ← Main form submission API
│   │       │
│   │       ├── progress/
│   │       │   └── route.ts            ← Progress fetch API
│   │       │
│   │       ├── webhook/
│   │       │   └── github/
│   │       │       └── route.ts        ← GitHub webhook handler
│   │       │
│   │       └── admin/
│   │           ├── login/
│   │           │   └── route.ts        ← Admin login API
│   │           ├── logout/
│   │           │   └── route.ts        ← Admin logout API
│   │           └── submissions/
│   │               └── route.ts        ← Submissions CRUD API
│   │
│   └── lib/
│       ├── store.ts                    ← Redis + in-memory data store
│       └── adminAuth.ts                ← Admin credentials check
│
├── .env.local                          ← Secret environment variables
├── package.json                        ← Project dependencies
├── next.config.ts                      ← Next.js configuration
├── vercel.json                         ← Vercel deployment config
└── tsconfig.json                       ← TypeScript configuration
```

---

## 🔄 3. Complete System Flow

```
┌─────────────────────────────────────────────────────────┐
│                    CANDIDATE SIDE                        │
└─────────────────────────────────────────────────────────┘

Step 1: Candidate website par jaata hai
        URL: https://yourapp.vercel.app

Step 2: Form bharta hai
        - Name, Email, Role, Experience, Skills, Resume

Step 3: "Submit Application" click karta hai
        → POST /api/submit

Step 4: System automatically karta hai:
        a) Groq AI se unique coding task generate karta hai
        b) GitHub par naya repo create karta hai
           (e.g., john-doe-react-dev-1746123456-demo-task)
        c) Repo mein TASK.md file add karta hai
        d) Repo par webhook register karta hai
        e) Task ka PDF generate karta hai
        f) Candidate ko email bhejta hai (task + PDF + repo link)
        g) Redis mein submission save karta hai

Step 5: Candidate email check karta hai
        → GitHub repo link milta hai
        → PDF attachment milta hai

Step 6: Candidate code likhta hai aur repo mein push karta hai

Step 7: GitHub webhook trigger hota hai
        → POST /api/webhook/github

Step 8: System:
        a) Groq AI se progress % calculate karta hai
        b) Redis mein progress update karta hai
        c) Candidate ko progress email bhejta hai
           "Aapne 65% task complete kar liya! 🚀"

┌─────────────────────────────────────────────────────────┐
│                     ADMIN SIDE                           │
└─────────────────────────────────────────────────────────┘

Step 1: Admin /admin par jaata hai
Step 2: Login karta hai (admin / sensussoft@123)
Step 3: Dashboard par saari submissions dekhta hai
Step 4: Filter/Search karta hai
Step 5: Submission click karta hai → details dekhta hai
Step 6: GitHub repo link par click karta hai → repo open hota hai
Step 7: Status update karta hai: Pending → Reviewed / Rejected
Step 8: Zarurat ho to submission delete karta hai
```

---

## 📄 4. Pages (Frontend)

---

### 4.1 Landing Page — `src/app/page.tsx`

**URL:** `/`

**Kya dikhta hai:**
- Sensussoft company ki hiring website
- Hero section with "Apply Now" button
- Features section (6 cards)
- How it Works section (3 steps)
- Application form
- Footer

**Application Form Fields:**

| Field | Type | Validation |
|-------|------|------------|
| Full Name | Text input | Required |
| Email Address | Email input | Required, valid email |
| Role Applying For | Text input | Required |
| Years of Experience | Dropdown | Required |
| Skills | Textarea | Required |
| Resume | File upload | Required, PDF/DOC/DOCX, max 5MB |

**Experience Dropdown Options:**
- 0–1 years (Fresher)
- 1–2 years (Junior)
- 3–5 years (Mid-level)
- 5–7 years (Senior)
- 7+ years (Lead / Architect)

**Submit hone par:**
- Loading state: "Generating Task..." with spinner
- Success: Green message "Task generated and emailed to {email}!"
- Error: Red message with error details

---

### 4.2 Admin Login Page — `src/app/admin/page.tsx`

**URL:** `/admin`

**Kya dikhta hai:**
- Login form (Username + Password)
- Sensussoft branding

**Default Credentials:**
```
Username: admin
Password: sensussoft@123
```

**Login hone par:**
- Cookie set hoti hai: `admin_session=authenticated`
- `/admin/dashboard` par redirect hota hai

---

### 4.3 Admin Dashboard — `src/app/admin/dashboard/page.tsx`

**URL:** `/admin/dashboard`

**Kya dikhta hai:**

**Stats Cards (top):**
| Card | Color | Kya dikhata hai |
|------|-------|-----------------|
| Total | Gray | Saari submissions count |
| Pending | Yellow | Review baaki submissions |
| Reviewed | Cyan | Review ho gayi submissions |
| Rejected | Red | Reject hui submissions |

**Filter Buttons:**
- All / Pending / Reviewed / Rejected

**Search Bar:**
- Name, Email, ya Role se search

**Submissions Table:**
- Applicant (name + email)
- Role
- Experience
- Status badge
- Date
- "View →" button

**Detail Panel (right side, click karne par):**
- Candidate name, email
- Status badge
- Role, Experience, Skills
- Resume filename
- AI generated task title
- GitHub Repo link (clickable button → opens repo)
- Status update buttons (Pending / Reviewed / Rejected)
- Delete button

**Authentication:**
- Cookie check karta hai
- Na ho to `/admin` par redirect

---

### 4.4 Progress Page — `src/app/progress/page.tsx`

**URL:** `/progress?email=candidate@gmail.com`

**Kya dikhta hai:**
- Candidate ka naam, role, task title
- Animated progress bar
- Completion percentage (large number)
- Status message based on %
- Last updated time
- Auto-refresh every 30 seconds
- Manual "Refresh Progress" button

**Progress Colors:**
| Range | Color | Message |
|-------|-------|---------|
| 0% | Gray | "Not Started Yet" |
| 1–49% | Blue | "In Progress... 🚀" |
| 50–79% | Cyan | "Good Progress! 💪" |
| 80–100% | Green | "Almost Done! 🎉" |

---

## 🔌 5. APIs (Backend)

---

### 5.1 POST `/api/submit` — Main Submission API

**File:** `src/app/api/submit/route.ts`

**Request Type:** `multipart/form-data`

**Request Fields:**
```
name        → string (required)
email       → string (required)
role        → string (required)
experience  → string (required)
skills      → string (required)
resume      → File (PDF/DOC/DOCX, max 5MB)
```

**Required Header:**
```
x-webhook-secret: demo-secret-do-not-change
```

**Step-by-step processing:**

#### Step 1 — Groq AI se Task Generate
```
Models try karta hai (order mein):
  1. llama-3.3-70b-versatile  (best)
  2. llama-3.1-8b-instant     (fallback)
  3. gemma2-9b-it              (last resort)

AI ko bheja jaata hai:
  - Candidate ka naam, role, experience, skills

AI return karta hai (JSON):
{
  "title": "Build a Task Manager App",
  "difficulty": "Junior",
  "scenario": "2-3 sentence description...",
  "requirements": ["req1", "req2", "req3", "req4"],
  "deliverables": ["GitHub repo link", "README.md"],
  "evaluation_criteria": ["c1", "c2", "c3", "c4"],
  "deadline_days": 3
}

Difficulty rules:
  0-2 years  → Junior    (~3 hours work)
  3-5 years  → Mid-level (~6 hours work)
  6+ years   → Senior    (~8 hours work)
```

#### Step 2 — GitHub Repo Create
```
Repo name format:
  {name}-{role}-{timestamp}-demo-task

Example:
  john-doe-react-developer-1746123456789-demo-task

GitHub API call:
  POST https://api.github.com/user/repos
  → Public repo create hota hai
  → auto_init: true (README.md auto-create)
```

#### Step 3 — TASK.md Add
```
GitHub API call:
  PUT https://api.github.com/repos/{user}/{repo}/contents/TASK.md

TASK.md mein hota hai:
  - Task title + difficulty + deadline
  - Candidate details
  - Scenario
  - Requirements (numbered)
  - Deliverables (bullets)
  - Evaluation criteria (checkmarks)
  - Submission instructions
```

#### Step 4 — Webhook Register
```
GitHub API call:
  POST https://api.github.com/repos/{user}/{repo}/hooks

Webhook config:
  URL: {NEXT_PUBLIC_APP_URL}/api/webhook/github
  Event: push
  Content-type: json
  Active: true
```

#### Step 5 — PDF Generate (PDFKit)
```
PDF mein hota hai:
  - Blue header: "Sensussoft — Practical Task"
  - Candidate details section
  - Difficulty badge (colored: green/orange/red)
  - Task title (large)
  - Scenario text
  - Requirements (numbered list)
  - Deliverables (bullet list)
  - Evaluation criteria (checkmarks)
  - Deadline box (blue background)
  - Footer text

File name: Sensussoft_Task_{CandidateName}.pdf
```

#### Step 6 — Email Send (Nodemailer + Gmail)
```
From: "Sensussoft Careers" <gmail_user>
To: candidate email
Subject: Sensussoft — Practical Task for {role}

Attachments:
  1. Sensussoft_Task_{Name}.pdf  (generated task)
  2. Candidate's resume          (if uploaded)

Email HTML body mein:
  - Greeting with candidate name
  - Task title + difficulty badge
  - Scenario
  - Requirements list
  - Deliverables list
  - Evaluation criteria
  - GitHub repo button (unique link)
```

#### Step 7 — Redis mein Save
```
Saved data:
{
  id: "uuid",
  name, email, role, experience, skills,
  resumeFilename,
  taskTitle: "AI generated title",
  submittedAt: "ISO timestamp",
  status: "pending",
  githubRepo: "https://github.com/user/repo-name"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Task generated and emailed successfully",
  "task_title": "Build a Task Manager App"
}
```

**Error Responses:**
```json
{ "error": "All fields are required" }           // 400
{ "error": "Server configuration missing" }      // 500
{ "error": "Unauthorized" }                      // 401
```

---

### 5.2 POST `/api/webhook/github` — GitHub Webhook Handler

**File:** `src/app/api/webhook/github/route.ts`

**Trigger:** Jab candidate GitHub repo mein code push karta hai

**Required Header:**
```
x-github-event: push
```

**Processing Steps:**

#### Step 1 — Event Check
```
x-github-event === "push" hona chahiye
Baaki events (create, delete, etc.) ignore hote hain
```

#### Step 2 — Submission Match
```
Priority order:
  1. githubRepo URL match (exact)
  2. Pusher email match
  3. Fallback: most recent submission

Payload se extract karta hai:
  - repository.html_url  → repo URL
  - pusher.email         → pusher email
  - commits[]            → commit list
```

#### Step 3 — AI Progress Analysis
```
Groq AI ko bheja jaata hai:
  - Task title
  - Added files list
  - Modified files list

AI return karta hai: 0-100 (sirf number)

Fallback (agar AI fail ho):
  progress = min(100, files.length × 10)
```

#### Step 4 — Redis Update
```
store.updateProgress(email, progress%)
lastUpdated = current timestamp
```

#### Step 5 — Progress Email Send
```
Subject: Sensussoft — Progress Update: 65% Complete 🚀

Email mein hota hai:
  - Candidate ka naam
  - Task title
  - Visual progress bar (colored)
  - Large % number
  - Status message:
      0-49%  → "Good start! Keep committing..."
      50-79% → "Great progress! Halfway there..."
      80-100% → "Amazing! Almost done..."
  - Recent commits list (max 5)
  - "View Repository" button
```

**Response:**
```json
{
  "success": true,
  "email": "candidate@gmail.com",
  "progress": 65
}
```

---

### 5.3 GET `/api/progress` — Progress Fetch API

**File:** `src/app/api/progress/route.ts`

**Request:**
```
GET /api/progress?email=candidate@gmail.com
```

**Response (Success):**
```json
{
  "name": "John Doe",
  "email": "john@gmail.com",
  "role": "React Developer",
  "taskTitle": "Build a Task Manager App",
  "progress": 65,
  "lastUpdated": "2026-05-06T09:30:00.000Z",
  "submittedAt": "2026-05-05T10:00:00.000Z"
}
```

**Response (Error):**
```json
{ "error": "Email is required" }        // 400
{ "error": "Submission not found" }     // 404
```

---

### 5.4 POST `/api/admin/login` — Admin Login

**File:** `src/app/api/admin/login/route.ts`

**Request:**
```json
{
  "username": "admin",
  "password": "sensussoft@123"
}
```

**Success Response:**
```json
{ "success": true }
```
+ Cookie set: `admin_session=authenticated`
- HttpOnly: true (JS se access nahi)
- Secure: true (production mein HTTPS only)
- SameSite: strict
- MaxAge: 8 hours (28800 seconds)

**Error Response:**
```json
{ "error": "Invalid credentials" }   // 401
```

---

### 5.5 GET/PATCH/DELETE `/api/admin/submissions`

**File:** `src/app/api/admin/submissions/route.ts`

**Authentication:** Cookie `admin_session=authenticated` required (sab methods mein)

**GET — Saari submissions fetch karo:**
```
GET /api/admin/submissions

Response:
{
  "submissions": [
    { id, name, email, role, experience, skills,
      resumeFilename, taskTitle, githubRepo,
      submittedAt, status }
  ]
}
```

**PATCH — Status update karo:**
```
PATCH /api/admin/submissions
Body: { "id": "uuid", "status": "reviewed" }

Status values: "pending" | "reviewed" | "rejected"
```

**DELETE — Submission delete karo:**
```
DELETE /api/admin/submissions
Body: { "id": "uuid" }
```

---

## 🗄️ 6. Data Store — `src/lib/store.ts`

**Primary Storage:** Upstash Redis (Vercel KV)  
**Fallback Storage:** In-memory (development / Redis na ho tab)

**Submission Data Model:**
```typescript
interface Submission {
  id: string           // UUID — auto-generated
  name: string         // Candidate full name
  email: string        // Candidate email
  role: string         // Role applying for
  experience: string   // Experience level
  skills: string       // Skills list
  resumeFilename?: string   // Uploaded resume filename
  taskTitle?: string        // AI generated task title
  submittedAt: string       // ISO timestamp
  status: "pending" | "reviewed" | "rejected"
  githubRepo?: string       // Unique GitHub repo URL
  taskProgress?: number     // 0-100 (webhook se update)
  lastUpdated?: string      // Last webhook update time
}
```

**Store Methods:**

| Method | Parameters | Return | Kya karta hai |
|--------|-----------|--------|---------------|
| `store.getAll()` | — | `Submission[]` | Saari submissions return karta hai |
| `store.add(data)` | submission object | `Submission` | Nayi submission add karta hai |
| `store.updateStatus(id, status)` | id, status | `boolean` | Status change karta hai |
| `store.updateProgress(email, %)` | email, number | `boolean` | Progress % update karta hai |
| `store.delete(id)` | id | `boolean` | Submission delete karta hai |

**Redis Key:** `"submissions"` (single JSON array)

---

## 🔐 7. Admin Authentication — `src/lib/adminAuth.ts`

```typescript
// Default credentials (env vars se override ho sakti hain)
ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin"
ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "sensussoft@123"

// Check function
checkCredentials(username, password) → boolean
```

---

## 📦 8. Dependencies (Packages)

### Production Dependencies

| Package | Version | Kaam |
|---------|---------|------|
| `next` | 16.2.4 | React framework + API routes |
| `react` | 19.2.4 | UI library |
| `react-dom` | 19.2.4 | React DOM rendering |
| `groq-sdk` | ^1.1.2 | Groq AI API (LLaMA models) |
| `nodemailer` | ^8.0.7 | Email send karna (Gmail) |
| `pdfkit` | ^0.18.0 | PDF generate karna |
| `@upstash/redis` | ^1.37.0 | Redis database client |
| `@google/generative-ai` | ^0.24.1 | Google Gemini AI (installed) |

### Dev Dependencies

| Package | Version | Kaam |
|---------|---------|------|
| `typescript` | 5.9.3 | Type checking |
| `tailwindcss` | ^4 | CSS utility classes |
| `eslint` | ^9 | Code linting |
| `@types/node` | 20.19.39 | Node.js types |
| `@types/nodemailer` | ^8.0.0 | Nodemailer types |
| `@types/pdfkit` | ^0.17.6 | PDFKit types |

---

## 🌍 9. Environment Variables

**File:** `.env.local` (gitignore mein hai — commit nahi hoti)

| Variable | Required | Kya hai | Example |
|----------|----------|---------|---------|
| `GROQ_API_KEY` | ✅ | Groq AI API key | `gsk_xxx...` |
| `GMAIL_USER` | ✅ | Gmail sender address | `you@gmail.com` |
| `GMAIL_APP_PASSWORD` | ✅ | Gmail App Password (16 chars) | `abcd efgh ijkl mnop` |
| `GITHUB_TOKEN` | ✅ | GitHub Personal Access Token | `ghp_xxx...` |
| `GITHUB_USER` | ✅ | GitHub username | `Aeshvivaviya` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Deployed app URL | `https://yourapp.vercel.app` |
| `GITHUB_REPO_URL` | ⚠️ | Fallback repo URL | `https://github.com/user/demo` |
| `KV_REST_API_URL` | ⚠️ | Upstash Redis URL | `https://xxx.upstash.io` |
| `KV_REST_API_TOKEN` | ⚠️ | Upstash Redis Token | `AXxx...` |
| `ADMIN_USERNAME` | ⚠️ | Admin username (default: admin) | `admin` |
| `ADMIN_PASSWORD` | ⚠️ | Admin password | `sensussoft@123` |
| `WEBHOOK_SECRET` | ⚠️ | Form submission secret | `demo-secret-do-not-change` |

✅ = Zaruri | ⚠️ = Optional (default value hai)

---

## 🚀 10. Local Development Setup

```bash
# Step 1: Project folder mein jao
cd task-manager

# Step 2: Dependencies install karo
npm install

# Step 3: .env.local file banao aur variables set karo
# (upar table dekho)

# Step 4: Development server start karo
npm run dev

# App open hoga: http://localhost:3000
```

**Available Scripts:**
```bash
npm run dev    # Development server (port 3000)
npm run build  # Production build
npm run start  # Production server
npm run lint   # ESLint check
```

---

## 🌐 11. Vercel Deployment

```
1. GitHub par code push karo
2. vercel.com par jao → New Project
3. GitHub repo import karo
4. Environment Variables add karo (Settings → Environment Variables)
   → Saare variables .env.local se copy karo
5. Deploy karo

Important: NEXT_PUBLIC_APP_URL mein apna Vercel URL daalo
           (e.g., https://demo-ten-nu-59.vercel.app)
           Iske bina GitHub webhook register nahi hoga!
```

---

## 📧 12. Gmail Setup (Email ke liye)

```
1. Google Account → Security → 2-Step Verification ON karo
2. Security → App Passwords par jao
3. App: "Mail", Device: "Other" select karo
4. 16-character password generate hoga
5. Woh password GMAIL_APP_PASSWORD mein daalo
   (spaces ke saath ya bina — dono kaam karte hain)
```

---

## 🐙 13. GitHub Token Setup

```
1. GitHub → Settings (top right avatar)
2. Developer Settings → Personal Access Tokens → Tokens (classic)
3. "Generate new token (classic)" click karo
4. Scopes select karo:
   ✅ repo          (full repository access)
   ✅ admin:repo_hook (webhook manage karna)
5. Generate karo → Token copy karo
6. GITHUB_TOKEN mein daalo

Note: Token sirf ek baar dikhta hai — save kar lo!
```

---

## 🗃️ 14. Upstash Redis Setup (Database ke liye)

```
1. upstash.com par account banao
2. New Database create karo
3. Region: us-east-1 (ya nearest)
4. Database open karo → REST API section
5. Copy karo:
   - UPSTASH_REDIS_REST_URL → KV_REST_API_URL mein daalo
   - UPSTASH_REDIS_REST_TOKEN → KV_REST_API_TOKEN mein daalo

Note: Redis na ho to in-memory fallback use hota hai
      (server restart hone par data delete ho jaata hai)
```

---

## 🔁 15. Complete User Journey (Step by Step)

```
👤 CANDIDATE JOURNEY:

1. Website visit karta hai
   → https://yourapp.vercel.app

2. Form bharta hai
   → Name: John Doe
   → Email: john@gmail.com
   → Role: React Developer
   → Experience: 1-2 years (Junior)
   → Skills: React, JavaScript, CSS
   → Resume: resume.pdf (upload)

3. "Submit Application →" click karta hai
   → Loading: "Generating Task..."

4. System 10-15 seconds mein:
   → AI task generate karta hai
   → GitHub repo banata hai:
      "john-doe-react-developer-1746123456-demo-task"
   → TASK.md add karta hai
   → Webhook register karta hai
   → PDF banata hai
   → Email bhejta hai

5. Candidate email check karta hai
   → Subject: "Sensussoft — Practical Task for React Developer"
   → GitHub repo link milta hai
   → PDF attachment milta hai

6. Candidate GitHub repo open karta hai
   → TASK.md padhta hai
   → Code likhna shuru karta hai

7. Candidate code push karta hai
   → git add . && git commit -m "feat: add login" && git push

8. Webhook trigger hota hai
   → AI progress calculate karta hai: 45%
   → Email aata hai: "Aapne 45% task complete kar liya! 🚀"

9. Candidate aur code push karta hai
   → Progress update hoti hai: 80%
   → Email aata hai: "Amazing! Almost done! 🎉"

👨‍💼 ADMIN JOURNEY:

1. /admin par jaata hai
2. Login karta hai: admin / sensussoft@123
3. Dashboard dekhta hai:
   → Total: 5, Pending: 3, Reviewed: 1, Rejected: 1
4. "John Doe" par click karta hai
5. Detail panel mein dekhta hai:
   → Role: React Developer
   → Task: "Build a Todo App with React"
   → GitHub: john-doe-react-developer-... (clickable)
6. GitHub link click karta hai → repo open hota hai
7. Code review karta hai
8. Status "Reviewed" karta hai
```

---

## ⚠️ 16. Important Notes

1. **`.env.local` kabhi GitHub par push mat karo** — gitignore mein hai, safe hai

2. **NEXT_PUBLIC_APP_URL** Vercel par zarur set karo — iske bina webhook kaam nahi karega

3. **Gmail App Password** regular password nahi hai — 2FA enable karke App Password generate karo

4. **GitHub Token** mein `repo` aur `admin:repo_hook` scopes zaruri hain

5. **Redis na ho** to in-memory fallback use hota hai — development ke liye theek hai, production mein Redis lagao

6. **Groq AI** 3 models try karta hai — ek fail ho to doosra use karta hai

7. **Progress tracking** sirf tab kaam karta hai jab `NEXT_PUBLIC_APP_URL` set ho aur webhook register hua ho

---

*Documentation Version: 1.0*  
*Last Updated: May 2026*  
*Project: Sensussoft AI Hiring System*
