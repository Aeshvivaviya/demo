# Sensussoft Hiring Platform — Documentation

## Project Overview

Yeh ek **AI-powered job application platform** hai jo Sensussoft company ke liye banaya gaya hai. Jab koi candidate apply karta hai, system automatically:

1. Candidate ka resume aur profile analyze karta hai
2. AI se ek custom coding task generate karta hai
3. Candidate ke email pe task PDF ke saath bhejta hai
4. GitHub pe candidate ke liye ek dedicated repo create karta hai
5. Jab candidate code push karta hai, progress track karta hai aur update email bhejta hai

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI (Task Generation) | Groq SDK (LLaMA 3.3 70B) |
| Database | Upstash Redis (serverless) |
| Email | Nodemailer + Gmail SMTP |
| PDF Generation | PDFKit |
| Version Control Integration | GitHub REST API + Webhooks |
| Deployment | Vercel |

---

## Project Structure

```
task-manager/
├── src/
│   ├── app/
│   │   ├── page.tsx                        # Main landing page (candidate form)
│   │   ├── layout.tsx                      # Root layout
│   │   ├── globals.css                     # Global styles
│   │   ├── admin/
│   │   │   ├── page.tsx                    # Admin login page
│   │   │   └── dashboard/
│   │   │       └── page.tsx                # Admin dashboard
│   │   ├── progress/
│   │   │   └── page.tsx                    # Candidate progress tracker
│   │   └── api/
│   │       ├── submit/
│   │       │   └── route.ts                # Main submission handler
│   │       ├── progress/
│   │       │   └── route.ts                # Progress fetch API
│   │       ├── admin/
│   │       │   ├── login/route.ts          # Admin login API
│   │       │   ├── logout/route.ts         # Admin logout API
│   │       │   └── submissions/route.ts    # Submissions CRUD API
│   │       └── webhook/
│   │           └── github/route.ts         # GitHub push webhook handler
│   └── lib/
│       ├── store.ts                        # Redis data store (with in-memory fallback)
│       └── adminAuth.ts                    # Admin credential check
├── .env.local                              # Environment variables (local)
├── vercel.json                             # Vercel deployment config
└── package.json
```

---

## Pages

### 1. Landing Page (`/`)

Candidate-facing public page. Sections:

- **Navbar** — Logo, navigation links, "Apply Now" CTA, Admin link
- **Hero** — Headline, stats (500+ applicants, <30s delivery, 100% AI powered)
- **Features** — 6 feature cards (AI Tasks, Instant Delivery, Role-Specific, Secure, Resume Analysis, Stand Out)
- **How it Works** — 3-step process (Fill Form → Upload Resume → Get Task)
- **Application Form** — Candidate submits:
  - Full Name
  - Email Address
  - Role Applying For
  - Years of Experience (dropdown: Fresher to Lead/Architect)
  - Skills (textarea)
  - Resume upload (PDF/DOC/DOCX, max 5MB, drag & drop supported)
- **Footer**

Form submit karne ke baad `/api/submit` call hota hai.

---

### 2. Admin Login (`/admin`)

Password-protected admin portal.

- Username + Password form
- Default credentials: `admin` / `sensussoft@123` (env vars se override ho sakta hai)
- Login successful hone pe `admin_session` cookie set hoti hai (httpOnly, 8 hours)
- Redirect to `/admin/dashboard`

---

### 3. Admin Dashboard (`/admin/dashboard`)

Session-protected page. Features:

- **Stats cards** — Total, Pending, Reviewed, Rejected counts
- **Filter buttons** — All / Pending / Reviewed / Rejected
- **Search bar** — Name, email, ya role se search
- **Submissions table** — Applicant name, email, role, experience, status, date
- **Detail panel** — Click karo kisi row pe:
  - Full candidate details
  - Task title jo generate hua
  - GitHub repo link
  - Status update buttons (Pending / Reviewed / Rejected)
  - Delete button

---

### 4. Progress Tracker (`/progress?email=...`)

Candidate apna progress dekh sakta hai email se.

- URL: `/progress?email=candidate@example.com`
- Animated progress bar (color changes: blue → cyan → green)
- Status messages based on percentage
- Auto-refresh every 30 seconds
- Manual refresh button

---

## API Routes

### `POST /api/submit`

Main application submission endpoint.

**Request:** `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| name | string | ✅ |
| email | string | ✅ |
| role | string | ✅ |
| experience | string | ✅ |
| skills | string | ✅ |
| resume | File (PDF/DOC/DOCX) | Optional |

**Header:** `x-webhook-secret: <secret>` (agar `WEBHOOK_SECRET` env set hai)

**Process (in order):**
1. Form data parse karo
2. Groq AI se task generate karo (JSON format mein)
3. GitHub pe candidate ke liye unique repo banao
4. Repo mein `TASK.md` file add karo
5. GitHub webhook register karo (push events ke liye)
6. PDF generate karo (PDFKit)
7. Email bhejo candidate ko (task PDF + resume attachment)
8. Submission Redis mein save karo

**Response:**
```json
{
  "success": true,
  "message": "Task generated and emailed successfully",
  "task_title": "Build a REST API with Authentication"
}
```

---

### `GET /api/progress?email=...`

Candidate ka progress fetch karo.

**Response:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "React Developer",
  "taskTitle": "Build a Todo App with React",
  "progress": 65,
  "lastUpdated": "2026-05-07T10:30:00Z",
  "submittedAt": "2026-05-05T08:00:00Z"
}
```

---

### `POST /api/admin/login`

Admin login.

**Request:**
```json
{ "username": "admin", "password": "sensussoft@123" }
```

**Response:** Sets `admin_session` cookie on success.

---

### `POST /api/admin/logout`

Admin logout — clears session cookie.

---

### `GET /api/admin/submissions`

Saari submissions fetch karo. Session required.

### `PATCH /api/admin/submissions`

Status update karo.

```json
{ "id": "uuid", "status": "reviewed" }
```

### `DELETE /api/admin/submissions`

Submission delete karo.

```json
{ "id": "uuid" }
```

---

### `POST /api/webhook/github`

GitHub push event webhook handler.

**Flow:**
1. `x-github-event: push` header check karo
2. Pusher email ya repo URL se submission dhundo
3. Groq AI se pushed files analyze karke progress % calculate karo
4. Redis mein progress update karo
5. Candidate ko progress update email bhejo

---

## Data Model

### `Submission` (Redis mein store hota hai)

```typescript
interface Submission {
  id: string;              // UUID
  name: string;
  email: string;
  role: string;
  experience: string;
  skills: string;
  resumeFilename?: string;
  taskTitle?: string;      // AI-generated task ka title
  submittedAt: string;     // ISO timestamp
  status: "pending" | "reviewed" | "rejected";
  githubRepo?: string;     // Created repo URL
  taskProgress?: number;   // 0-100
  lastUpdated?: string;    // Last GitHub push timestamp
}
```

---

## AI Task Generation

Groq API use hoti hai (LLaMA models). System teen models try karta hai fallback ke saath:

1. `llama-3.3-70b-versatile` (primary)
2. `llama-3.1-8b-instant` (fallback)
3. `gemma2-9b-it` (last resort)

Task difficulty experience ke hisaab se:

| Experience | Difficulty | Estimated Time |
|---|---|---|
| 0–2 years | Junior | ~3 hours |
| 3–5 years | Mid-level | ~6 hours |
| 6+ years | Senior | ~8 hours |

Generated task mein hota hai:
- Title
- Scenario (2-3 sentences)
- Requirements (4 items)
- Deliverables
- Evaluation Criteria (4 items)
- Deadline (days)

---

## GitHub Integration

Har candidate ke liye ek unique public repo create hota hai:

**Repo name format:** `{firstname-lastname}-{role}-{timestamp}-demo-task`

Repo mein:
- Default `README.md` (auto-init)
- `TASK.md` — full task details with candidate info

Webhook bhi register hota hai jo har push pe `/api/webhook/github` call karta hai.

---

## Email System

Nodemailer + Gmail SMTP use hota hai.

**Candidate ko milta hai:**
- HTML email with task details, requirements, deliverables, evaluation criteria
- GitHub repo link (button)
- PDF attachment (task document)
- Resume attachment (agar upload kiya ho)

**Progress update email** (har GitHub push pe):
- Progress bar (HTML)
- Recent commits list
- Motivational message based on % completion
- Repo link button

---

## Data Storage

**Primary:** Upstash Redis (serverless, Vercel ke saath compatible)

**Fallback:** In-memory store (`globalThis.submissions`) — development ya Redis unavailable hone pe use hota hai. Note: Vercel deployments mein in-memory data persist nahi hota.

**Environment variables for Redis:**
- `KV_REST_API_URL` ya `UPSTASH_REDIS_REST_URL`
- `KV_REST_API_TOKEN` ya `UPSTASH_REDIS_REST_TOKEN`

---

## Environment Variables

`.env.local` mein yeh set karo:

```env
# AI
GROQ_API_KEY=your_groq_api_key

# Email
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password

# GitHub
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_USER=your_github_username
GITHUB_REPO_URL=https://github.com/fallback/repo   # fallback if token not set

# App URL (for webhook registration)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Admin Auth
ADMIN_USERNAME=admin
ADMIN_PASSWORD=sensussoft@123

# Redis (Upstash)
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# Optional: webhook security
WEBHOOK_SECRET=your_secret
```

---

## Local Development

```bash
cd task-manager
npm install
npm run dev
```

App `http://localhost:3000` pe chalega.

> Note: `npm run dev` pehle port 3000 kill karta hai (`kill-port`), phir Next.js start karta hai.

---

## Deployment (Vercel)

`vercel.json` already configured hai:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

Vercel dashboard mein saare environment variables add karo.

---

## Security Notes

- Admin session cookie: `httpOnly`, `secure` (production mein), `sameSite: strict`, 8 hours expiry
- Webhook secret header optional but recommended (`WEBHOOK_SECRET`)
- Admin credentials env vars se override ho sakte hain (default hardcoded values production mein change karo)
- Resume files server pe store nahi hote — sirf email attachment ke liye buffer mein rakhe jaate hain

---

## Known Limitations

- In-memory fallback store Vercel pe persist nahi karta (Redis required for production)
- `roleMiddleware.js` file project mein hai lekin currently Next.js routes mein use nahi ho rahi (legacy file)
- `.env` file mein purane React app variables hain (`REACT_APP_*`) jo is project mein use nahi hote
