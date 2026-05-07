import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { store } from "@/lib/store";

// ── Types ──────────────────────────────────────────────────────────────────
interface ApplicationData {
  name: string;
  email: string;
  role: string;
  experience: string;
  skills: string;
  resumeBuffer?: Buffer;
  resumeFilename?: string;
  resumeMimeType?: string;
  cvText?: string; // extracted CV text
}

interface GeneratedTask {
  title: string;
  scenario: string;
  requirements: string[];
  deliverables: string[];
  evaluation_criteria: string[];
  deadline_days: number;
  difficulty: string;
}

// ── Role Category Detection ────────────────────────────────────────────────
type RoleCategory = "design" | "development" | "qa" | "devops" | "product";

function detectRoleCategory(role: string): RoleCategory {
  const r = role.toLowerCase();
  if (r.includes("designer") || r.includes("ui") || r.includes("ux") || r.includes("visual")) {
    return "design";
  }
  if (r.includes("qa") || r.includes("tester") || r.includes("sdet") || r.includes("quality")) {
    return "qa";
  }
  if (r.includes("devops") || r.includes("sre") || r.includes("cloud") || r.includes("infrastructure")) {
    return "devops";
  }
  if (r.includes("product manager") || r.includes("product owner") || r.includes("business analyst") || r.includes("pm ")) {
    return "product";
  }
  // Default: development
  return "development";
}

// ── Seniority Detection ────────────────────────────────────────────────────
function detectSeniority(experience: string): { label: string; years: number } {
  const e = experience.toLowerCase();
  if (e.includes("7+") || e.includes("lead") || e.includes("architect")) return { label: "Senior", years: 7 };
  if (e.includes("5") || e.includes("senior")) return { label: "Senior", years: 5 };
  if (e.includes("3")) return { label: "Mid-level", years: 3 };
  if (e.includes("1")) return { label: "Junior", years: 1 };
  return { label: "Junior", years: 0 };
}

// ── Category-specific prompt builder ──────────────────────────────────────
function buildPrompt(data: ApplicationData, category: RoleCategory, seniority: { label: string; years: number }): string {
  const cvSection = data.cvText
    ? `\nExtracted CV Summary:\n${data.cvText.slice(0, 800)}\n`
    : "";

  const categoryInstructions: Record<RoleCategory, string> = {
    design: `
- This is a DESIGN role. Generate a UI/UX design task ONLY.
- Task must involve: Figma wireframes, user flows, design systems, prototyping, or visual design.
- DO NOT include any coding, programming, or GitHub repo tasks.
- Deliverables should be Figma files, design specs, or PDF presentations.
- Junior: Simple screen redesign or component design (~3 hours).
- Mid-level: Full user flow with wireframes + prototype (~6 hours).
- Senior: Design system or end-to-end UX audit (~8 hours).`,

    development: `
- This is a DEVELOPMENT role. Generate a coding task.
- Match the tech stack to the candidate's skills and role.
- Junior: Small CRUD app or UI component (~3 hours).
- Mid-level: Full feature with API + frontend (~6 hours).
- Senior: Architecture design + implementation (~8 hours).
- Deliverable: GitHub repository link.`,

    qa: `
- This is a QA/Testing role. Generate a testing task ONLY.
- Task must involve: writing test cases, automation scripts, bug reports, or test plans.
- Tools: Selenium, Cypress, Jest, Postman, or manual testing.
- Junior: Write test cases for a simple feature (~3 hours).
- Mid-level: Build an automation test suite (~6 hours).
- Senior: Design a full QA strategy + automation framework (~8 hours).`,

    devops: `
- This is a DevOps/Infrastructure role. Generate a CI/CD or infrastructure task.
- Task must involve: Docker, Kubernetes, CI/CD pipelines, cloud infrastructure, or monitoring.
- Junior: Write a Dockerfile + basic CI pipeline (~3 hours).
- Mid-level: Set up full CI/CD with deployment (~6 hours).
- Senior: Design scalable infrastructure with IaC (~8 hours).`,

    product: `
- This is a Product Management role. Generate a product/strategy task.
- Task must involve: PRD writing, roadmap planning, user story creation, or competitive analysis.
- NO coding required.
- Junior: Write user stories for a feature (~3 hours).
- Mid-level: Create a mini PRD for a product feature (~6 hours).
- Senior: Full product roadmap + go-to-market strategy (~8 hours).`,
  };

  return `You are a senior hiring manager at Sensussoft.
Generate a practical take-home assessment task for this candidate.

Candidate Profile:
- Name: ${data.name}
- Role Applied: ${data.role}
- Experience: ${data.experience} (approx ${seniority.years} years — ${seniority.label} level)
- Skills: ${data.skills}
- Role Category: ${category}
${cvSection}
Task Generation Rules:
${categoryInstructions[category]}

STRICT RULES:
- The task MUST match the role category exactly.
- A designer must NEVER receive a coding task.
- A developer must NEVER receive a Figma/design task.
- Use the candidate's actual skills from their profile and CV.
- Make the task feel realistic and specific to their background.
- Deadline: 3 days.
- Include exactly 4 evaluation criteria.

Return ONLY valid JSON with these exact keys (no markdown, no code fences):
{
  "title": "string",
  "difficulty": "${seniority.label}",
  "scenario": "string (2-3 sentences describing the task context)",
  "requirements": ["string", "string", "string", "string"],
  "deliverables": ["string", "string"],
  "evaluation_criteria": ["string", "string", "string", "string"],
  "deadline_days": 3
}`;
}

// ── CV Text Extraction ─────────────────────────────────────────────────────
async function extractCvText(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf") {
      // Use a simple text extraction approach for Vercel compatibility
      // pdf-parse has ESM issues on Vercel, so we extract readable text directly
      const text = buffer.toString("latin1");
      // Extract text between BT and ET markers (PDF text blocks)
      const matches = text.match(/BT[\s\S]*?ET/g) || [];
      const extracted = matches
        .join(" ")
        .replace(/\(([^)]+)\)/g, "$1 ")
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (extracted.length > 50) return extracted.slice(0, 1500);
      // Fallback: extract any readable ASCII text from PDF
      const readable = text
        .replace(/[^\x20-\x7E\n]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return readable.slice(0, 1500);
    }
    if (
      mimeType === "application/msword" ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value?.slice(0, 1500) || "";
    }
  } catch (err) {
    console.warn("⚠️ CV text extraction failed:", err);
  }
  return "";
}

// ── GitHub: Create a unique repo for the candidate ────────────────────────
async function createGitHubRepo(
  data: ApplicationData,
  task: GeneratedTask
): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GITHUB_USER;

  if (!token || !username) {
    return process.env.GITHUB_REPO_URL || "https://github.com/Aeshvivaviya/demo";
  }

  const cleanName = data.name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
  const cleanRole = data.role.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-");
  const timestamp = Date.now();
  const repoName = `${cleanName}-${cleanRole}-${timestamp}-demo-task`;

  const createRes = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      name: repoName,
      description: `Technical assignment for ${data.name} (${data.role})`,
      private: false,
      auto_init: true,
    }),
  });

  if (!createRes.ok) {
    console.error("GitHub repo creation failed:", await createRes.json());
    return process.env.GITHUB_REPO_URL || "https://github.com/Aeshvivaviya/demo";
  }

  const repoData = await createRes.json();
  const repoUrl: string = repoData.html_url;

  // Add TASK.md
  const taskContent = buildTaskMarkdown(data, task);
  await fetch(`https://api.github.com/repos/${username}/${repoName}/contents/TASK.md`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      message: "Add TASK.md",
      content: Buffer.from(taskContent).toString("base64"),
    }),
  });

  // Register webhook
  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/github`
    : null;

  if (webhookUrl) {
    const hookRes = await fetch(`https://api.github.com/repos/${username}/${repoName}/hooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push"],
        config: { url: webhookUrl, content_type: "json", insecure_ssl: "0" },
      }),
    });
    if (hookRes.ok) console.log(`🔗 Webhook registered → ${webhookUrl}`);
    else console.warn("⚠️ Webhook registration failed");
  }

  console.log(`✅ GitHub repo created: ${repoUrl}`);
  return repoUrl;
}

function buildTaskMarkdown(data: ApplicationData, task: GeneratedTask): string {
  const reqList = task.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const delList = task.deliverables.map((d) => `- ${d}`).join("\n");
  const evalList = task.evaluation_criteria.map((c) => `- ✅ ${c}`).join("\n");

  return `# ${task.title}

> **Difficulty:** ${task.difficulty} | **Deadline:** ${task.deadline_days} days

## Candidate
- **Name:** ${data.name}
- **Role Applied:** ${data.role}
- **Experience:** ${data.experience}

---

## Scenario
${task.scenario}

---

## Requirements
${reqList}

---

## Deliverables
${delList}

---

## Evaluation Criteria
${evalList}

---

## Submission
Submit your work as per the deliverables above and notify the Sensussoft hiring team.

*This task was AI-generated by Sensussoft Hiring System based on the candidate's profile.*
`;
}

// ── OpenRouter: Generate custom task as JSON ──────────────────────────────
async function generateTask(data: ApplicationData): Promise<GeneratedTask> {
  const category = detectRoleCategory(data.role);
  const seniority = detectSeniority(data.experience);
  const prompt = buildPrompt(data, category, seniority);

  console.log(`🎯 Role category: ${category} | Seniority: ${seniority.label}`);

  // Use openrouter/free router — automatically picks any available free model
  // Fallback to specific free models if router fails
  const modelsToTry = [
    "openrouter/free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-31b-it:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "openai/gpt-oss-20b:free",
    "openai/gpt-oss-120b:free",
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`🤖 Trying model: ${modelName}`);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Sensussoft Hiring Platform",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenRouter error ${res.status}: ${errText}`);
      }

      const json = await res.json();
      let text = json.choices[0]?.message?.content || "";

      // Strip markdown code fences + thinking tags (some models add <think>...</think>)
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      text = text.replace(/```json|```/g, "").trim();

      // Extract JSON object if surrounded by extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response");

      const parsed: GeneratedTask = JSON.parse(jsonMatch[0]);

      // Sanitize — ensure all array fields are actually arrays
      const toArray = (val: unknown): string[] => {
        if (Array.isArray(val)) return val.map(String);
        if (typeof val === "string") return val.split("\n").filter(Boolean);
        return [];
      };
      parsed.requirements = toArray(parsed.requirements);
      parsed.deliverables = toArray(parsed.deliverables);
      parsed.evaluation_criteria = toArray(parsed.evaluation_criteria);
      parsed.title = parsed.title || "Assessment Task";
      parsed.scenario = parsed.scenario || "";
      parsed.difficulty = parsed.difficulty || "Junior";
      parsed.deadline_days = parsed.deadline_days || 3;

      console.log(`✅ Task generated with model: ${modelName} — "${parsed.title}"`);
      return parsed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`⚠️ Model ${modelName} failed: ${msg}, trying next...`);
    }
  }

  throw new Error("All AI models failed. Please check your OPENROUTER_API_KEY or add credits at openrouter.ai/settings/credits");
}

// ── PDFKit: Generate PDF buffer ────────────────────────────────────────────
async function generatePDF(data: ApplicationData, task: GeneratedTask): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, 80).fill("#1F4E79");
    doc.fillColor("white").fontSize(22).font("Times-Bold").text("Sensussoft — Practical Task", 50, 25);
    doc.fontSize(11).font("Times-Roman").text("AI-Generated Candidate Assessment", 50, 52);
    doc.moveDown(3);

    doc.fillColor("#1F4E79").fontSize(14).font("Times-Bold").text("Candidate Details");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#2E75B6").lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fillColor("#333").fontSize(11).font("Times-Roman");
    doc.text(`Name:        ${data.name}`);
    doc.text(`Email:       ${data.email}`);
    doc.text(`Role:        ${data.role}`);
    doc.text(`Experience:  ${data.experience}`);
    doc.text(`Skills:      ${data.skills}`);
    doc.moveDown(1.5);

    const diffColor = task.difficulty === "Senior" ? "#c0392b" : task.difficulty === "Mid-level" ? "#e67e22" : "#27ae60";
    doc.roundedRect(50, doc.y, 100, 22, 5).fill(diffColor);
    doc.fillColor("white").fontSize(10).font("Times-Bold").text(task.difficulty, 50, doc.y - 17, { width: 100, align: "center" });
    doc.moveDown(1.5);

    doc.fillColor("#1F4E79").fontSize(16).font("Times-Bold").text(task.title);
    doc.moveDown(0.5);
    doc.fillColor("#555").fontSize(11).font("Times-Roman").text(task.scenario, { lineGap: 4 });
    doc.moveDown(1.5);

    doc.fillColor("#1F4E79").fontSize(13).font("Times-Bold").text("Requirements");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#2E75B6").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fillColor("#333").fontSize(11).font("Times-Roman");
    task.requirements.forEach((req, i) => doc.text(`${i + 1}.  ${req}`, { lineGap: 3 }));
    doc.moveDown(1.5);

    doc.fillColor("#1F4E79").fontSize(13).font("Times-Bold").text("Deliverables");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#2E75B6").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fillColor("#333").fontSize(11).font("Times-Roman");
    task.deliverables.forEach((d) => doc.text(`•  ${d}`, { lineGap: 3 }));
    doc.moveDown(1.5);

    doc.fillColor("#1F4E79").fontSize(13).font("Times-Bold").text("Evaluation Criteria");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#2E75B6").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fillColor("#333").fontSize(11).font("Times-Roman");
    task.evaluation_criteria.forEach((c) => doc.text(`✓  ${c}`, { lineGap: 3 }));
    doc.moveDown(1.5);

    doc.rect(50, doc.y, 495, 36).fill("#EBF3FB");
    doc.fillColor("#1F4E79").fontSize(12).font("Times-Bold")
      .text(`Deadline: ${task.deadline_days} days from receipt of this email`, 60, doc.y - 26);
    doc.moveDown(2);

    doc.fillColor("#999").fontSize(9).font("Times-Roman")
      .text("This task was AI-generated by Sensussoft Hiring System based on the candidate's profile.", 50, doc.page.height - 50, { align: "center" });

    doc.end();
  });
}

function renderEmail(data: ApplicationData, task: GeneratedTask, repoUrl: string): string {
  const list = (arr: string[]) => arr.map((x) => `<li style="margin:6px 0">${x}</li>`).join("");
  const difficultyColor = task.difficulty === "Senior" ? "#c0392b" : task.difficulty === "Mid-level" ? "#e67e22" : "#27ae60";
  const repoDisplay = repoUrl.replace("https://", "");

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#333;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#1F4E79,#2E75B6);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;font-size:26px;">🎯 Your Practical Task</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0 0;">Sensussoft Hiring Team</p>
      </div>
      <div style="background:#f8f9fa;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e9ecef;">
        <h2 style="color:#1F4E79;margin-top:0;">Hi ${data.name},</h2>
        <p>Thanks for applying to <b>Sensussoft</b> for the <b>${data.role}</b> role.
        Below is your personalised assessment task. Please complete it within <b>${task.deadline_days} days</b>.</p>
        <div style="background:white;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #dee2e6;">
          <h3 style="color:#2E75B6;margin-top:0;">${task.title}</h3>
          <span style="background:${difficultyColor};color:white;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;">${task.difficulty}</span>
          <p style="margin-top:14px;">${task.scenario}</p>
          <h4 style="color:#1F4E79;">📋 Requirements</h4>
          <ul style="padding-left:20px;">${list(task.requirements)}</ul>
          <h4 style="color:#1F4E79;">📦 Deliverables</h4>
          <ul style="padding-left:20px;">${list(task.deliverables)}</ul>
          <h4 style="color:#1F4E79;">✅ How we will evaluate</h4>
          <ul style="padding-left:20px;">${list(task.evaluation_criteria)}</ul>
          <div style="margin-top:20px;padding:14px 18px;background:#f0f7ff;border-radius:8px;border:1px solid #c8e0f7;">
            <h4 style="color:#1F4E79;margin:0 0 8px 0;">🔗 Your Task Repository</h4>
            <p style="margin:0;font-size:13px;color:#555;">A dedicated GitHub repository has been created for you:</p>
            <a href="${repoUrl}" style="display:inline-block;margin-top:10px;padding:8px 16px;background:#1F4E79;color:white;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;">
              📂 ${repoDisplay}
            </a>
          </div>
        </div>
        <p style="color:#888;font-size:13px;margin-bottom:0;">
          Good luck!<br/><b>Sensussoft Hiring Team</b><br/>
          <em>This task was AI-generated based on your specific profile.</em>
        </p>
      </div>
    </div>
  `;
}

// ── Nodemailer: Send email ─────────────────────────────────────────────────
async function sendEmail(data: ApplicationData, task: GeneratedTask, repoUrl: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, ""),
    },
  });

  console.log("📄 Generating PDF...");
  const pdfBuffer = await generatePDF(data, task);
  const pdfFilename = `Sensussoft_Task_${data.name.replace(/\s+/g, "_")}.pdf`;

  const attachments: { filename: string; content: Buffer; contentType: string }[] = [
    { filename: pdfFilename, content: pdfBuffer, contentType: "application/pdf" },
  ];

  if (data.resumeBuffer && data.resumeFilename) {
    attachments.push({
      filename: data.resumeFilename,
      content: data.resumeBuffer,
      contentType: data.resumeMimeType || "application/octet-stream",
    });
  }

  await transporter.sendMail({
    from: `"Sensussoft Careers" <${process.env.GMAIL_USER}>`,
    to: data.email,
    subject: `Sensussoft — Practical Task for ${data.role}`,
    html: renderEmail(data, task, repoUrl),
    text: `Hi ${data.name},\n\nTask: ${task.title}\n\nScenario: ${task.scenario}\n\nRequirements:\n${task.requirements.join("\n")}\n\nDeadline: ${task.deadline_days} days\n\nGood luck!\nSensussoft Hiring Team`,
    attachments,
  });
}

// ── Main API Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    let name: string, email: string, role: string, experience: string, skills: string;
    let resumeBuffer: Buffer | undefined;
    let resumeFilename: string | undefined;
    let resumeMimeType: string | undefined;
    let cvText = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name       = (formData.get("name")       as string) || "";
      email      = (formData.get("email")      as string) || "";
      role       = (formData.get("role")       as string) || "";
      experience = (formData.get("experience") as string) || "";
      skills     = (formData.get("skills")     as string) || "";

      const resumeEntry = formData.get("resume");
      if (resumeEntry && typeof resumeEntry !== "string") {
        const file = resumeEntry as File;

        // File size check: max 5MB
        if (file.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: "Resume file must be under 5MB." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        resumeBuffer   = Buffer.from(arrayBuffer);
        resumeFilename = file.name;
        resumeMimeType = file.type;

        // Extract CV text for AI context
        console.log("📖 Extracting CV text...");
        cvText = await extractCvText(resumeBuffer, resumeMimeType);
        if (cvText) console.log(`✅ CV text extracted (${cvText.length} chars)`);
        else console.log("⚠️ CV text extraction returned empty");
      }
    } else {
      const body: ApplicationData = await req.json();
      ({ name, email, role, experience, skills } = body);
    }

    if (!name || !email || !role || !experience || !skills) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({ error: "Server configuration missing. Check environment variables." }, { status: 500 });
    }

    // Webhook secret check
    if (process.env.WEBHOOK_SECRET) {
      const secret = req.headers.get("x-webhook-secret");
      if (secret !== process.env.WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const applicationData: ApplicationData = {
      name, email, role, experience, skills,
      resumeBuffer, resumeFilename, resumeMimeType, cvText,
    };

    const category = detectRoleCategory(role);
    const seniority = detectSeniority(experience);

    console.log(`\n=== New candidate received ===`);
    console.log(`Name: ${name} | Role: ${role} | Category: ${category} | Seniority: ${seniority.label}`);
    console.log(`Experience: ${experience} | Skills: ${skills}`);
    console.log(`Resume: ${resumeFilename ?? "not provided"}`);

    console.log("🤖 Generating AI task...");
    const task = await generateTask(applicationData);
    console.log(`✅ Task generated: "${task.title}"`);

    console.log("🐙 Creating GitHub repo...");
    const repoUrl = await createGitHubRepo(applicationData, task);
    console.log(`✅ Repo: ${repoUrl}`);

    console.log(`📧 Sending email to ${email}...`);
    await sendEmail(applicationData, task, repoUrl);
    console.log("✅ Email sent.");

    await store.add({
      name, email, role, experience, skills,
      resumeFilename,
      taskTitle: task.title,
      githubRepo: repoUrl,
    });

    return NextResponse.json({
      success: true,
      message: "Task generated and emailed successfully",
      task_title: task.title,
      category,
      seniority: seniority.label,
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("❌ Error:", error);
    return NextResponse.json({ error: errorMessage, stack: errorStack }, { status: 500 });
  }
}
