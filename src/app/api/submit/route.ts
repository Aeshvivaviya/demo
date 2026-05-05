import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
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

// ── Groq: Generate custom task as JSON ────────────────────────────────────
async function generateTask(data: ApplicationData): Promise<GeneratedTask> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

  // Parse experience years from string like "1-2 years", "7+ years"
  const expStr = data.experience.toLowerCase();
  let expYears = 0;
  if (expStr.includes("7+") || expStr.includes("lead") || expStr.includes("architect")) expYears = 7;
  else if (expStr.includes("5") || expStr.includes("senior")) expYears = 5;
  else if (expStr.includes("3")) expYears = 3;
  else if (expStr.includes("1")) expYears = 1;

  const prompt = `You are a senior engineering manager at Sensussoft.
Generate a practical take-home task for this candidate.

Candidate:
- Name: ${data.name}
- Role applied: ${data.role}
- Experience: ${data.experience} (approx ${expYears} years)
- Skills: ${data.skills}

Rules:
- Junior (0-2y): small CRUD/UI exercise, ~3 hours of work.
- Mid (3-5y): full feature with API + frontend, ~6 hours.
- Senior (6+y): architecture problem + small implementation, ~8 hours.
- Match the tech stack to the role applied.
- Deliverable: a GitHub repo link.
- Deadline: 3 days.
- Include 4 evaluation criteria.

Return ONLY valid JSON with these exact keys:
{
  "title": "string",
  "difficulty": "Junior | Mid-level | Senior",
  "scenario": "string (2-3 sentences)",
  "requirements": ["string", "string", "string", "string"],
  "deliverables": ["string", "string"],
  "evaluation_criteria": ["string", "string", "string", "string"],
  "deadline_days": number
}

No markdown, no code fences, just raw JSON.`;

  const modelsToTry = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"];

  for (const modelName of modelsToTry) {
    try {
      const completion = await groq.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      });

      let text = completion.choices[0]?.message?.content || "";
      // Strip markdown code fences if model wraps JSON
      text = text.replace(/```json|```/g, "").trim();

      const parsed: GeneratedTask = JSON.parse(text);
      console.log(`✅ Task generated with model: ${modelName}`);
      return parsed;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`⚠️ Model ${modelName} failed: ${msg}, trying next...`);
    }
  }

  throw new Error("All AI models failed. Please check your GROQ_API_KEY.");
}

// ── PDFKit: Generate PDF buffer ────────────────────────────────────────────
async function generatePDF(data: ApplicationData, task: GeneratedTask): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 80).fill("#1F4E79");
    doc.fillColor("white").fontSize(22).font("Times-Bold")
      .text("Sensussoft — Practical Task", 50, 25);
    doc.fontSize(11).font("Times-Roman")
      .text("AI-Generated Candidate Assessment", 50, 52);

    doc.moveDown(3);

    // ── Candidate Info ──
    doc.fillColor("#1F4E79").fontSize(14).font("Times-Bold")
      .text("Candidate Details");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#2E75B6").lineWidth(1).stroke();
    doc.moveDown(0.5);

    doc.fillColor("#333").fontSize(11).font("Times-Roman");
    doc.text(`Name:        ${data.name}`);
    doc.text(`Email:       ${data.email}`);
    doc.text(`Role:        ${data.role}`);
    doc.text(`Experience:  ${data.experience}`);
    doc.text(`Skills:      ${data.skills}`);
    doc.moveDown(1.5);

    // ── Difficulty Badge ──
    const diffColor = task.difficulty === "Senior" ? "#c0392b" :
      task.difficulty === "Mid-level" ? "#e67e22" : "#27ae60";
    doc.roundedRect(50, doc.y, 100, 22, 5).fill(diffColor);
    doc.fillColor("white").fontSize(10).font("Times-Bold")
      .text(task.difficulty, 50, doc.y - 17, { width: 100, align: "center" });
    doc.moveDown(1.5);

    // ── Task Title ──
    doc.fillColor("#1F4E79").fontSize(16).font("Times-Bold")
      .text(task.title);
    doc.moveDown(0.5);

    // ── Scenario ──
    doc.fillColor("#555").fontSize(11).font("Times-Roman")
      .text(task.scenario, { lineGap: 4 });
    doc.moveDown(1.5);

    // ── Requirements ──
    doc.fillColor("#1F4E79").fontSize(13).font("Times-Bold").text("Requirements");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#2E75B6").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fillColor("#333").fontSize(11).font("Times-Roman");
    task.requirements.forEach((req, i) => {
      doc.text(`${i + 1}.  ${req}`, { lineGap: 3 });
    });
    doc.moveDown(1.5);

    // ── Deliverables ──
    doc.fillColor("#1F4E79").fontSize(13).font("Times-Bold").text("Deliverables");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#2E75B6").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fillColor("#333").fontSize(11).font("Times-Roman");
    task.deliverables.forEach((d) => {
      doc.text(`•  ${d}`, { lineGap: 3 });
    });
    doc.moveDown(1.5);

    // ── Evaluation Criteria ──
    doc.fillColor("#1F4E79").fontSize(13).font("Times-Bold").text("Evaluation Criteria");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#2E75B6").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fillColor("#333").fontSize(11).font("Times-Roman");
    task.evaluation_criteria.forEach((c) => {
      doc.text(`✓  ${c}`, { lineGap: 3 });
    });
    doc.moveDown(1.5);

    // ── Deadline ──
    doc.rect(50, doc.y, 495, 36).fill("#EBF3FB");
    doc.fillColor("#1F4E79").fontSize(12).font("Times-Bold")
      .text(`Deadline: ${task.deadline_days} days from receipt of this email`, 60, doc.y - 26);
    doc.moveDown(2);

    // ── Footer ──
    doc.fillColor("#999").fontSize(9).font("Times-Roman")
      .text("This task was AI-generated by Sensussoft Hiring System based on the candidate's profile.",
        50, doc.page.height - 50, { align: "center" });

    doc.end();
  });
}


function renderEmail(data: ApplicationData, task: GeneratedTask): string {
  const list = (arr: string[]) =>
    arr.map((x) => `<li style="margin:6px 0">${x}</li>`).join("");

  const difficultyColor =
    task.difficulty === "Senior" ? "#c0392b" :
    task.difficulty === "Mid-level" ? "#e67e22" : "#27ae60";

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;color:#333;margin:0 auto;">
      <div style="background:linear-gradient(135deg,#1F4E79,#2E75B6);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;font-size:26px;">🎯 Your Practical Task</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0 0;">Sensussoft Hiring Team</p>
      </div>

      <div style="background:#f8f9fa;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e9ecef;">
        <h2 style="color:#1F4E79;margin-top:0;">Hi ${data.name},</h2>
        <p>Thanks for applying to <b>Sensussoft</b> for the <b>${data.role}</b> role.
        Below is a short practical task. Please complete it within
        <b>${task.deadline_days} days</b> and reply to this email with your submission.</p>

        <div style="background:white;border-radius:8px;padding:20px;margin:20px 0;border:1px solid #dee2e6;">
          <h3 style="color:#2E75B6;margin-top:0;">${task.title}</h3>
          <span style="background:${difficultyColor};color:white;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;">
            ${task.difficulty}
          </span>
          <p style="margin-top:14px;">${task.scenario}</p>

          <h4 style="color:#1F4E79;">📋 Requirements</h4>
          <ul style="padding-left:20px;">${list(task.requirements)}</ul>

          <h4 style="color:#1F4E79;">📦 Deliverables</h4>
          <ul style="padding-left:20px;">${list(task.deliverables)}</ul>

          <h4 style="color:#1F4E79;">✅ How we will evaluate</h4>
          <ul style="padding-left:20px;">${list(task.evaluation_criteria)}</ul>

          <div style="margin-top:20px;padding:14px 18px;background:#f0f7ff;border-radius:8px;border:1px solid #c8e0f7;">
            <h4 style="color:#1F4E79;margin:0 0 8px 0;">🔗 Task Repository</h4>
            <p style="margin:0;font-size:13px;color:#555;">Fork or clone the repository below to get started:</p>
            <a href="${process.env.GITHUB_REPO_URL || 'https://github.com/Aeshvivaviya/demo'}" 
               style="display:inline-block;margin-top:10px;padding:8px 16px;background:#1F4E79;color:white;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold;">
              📂 ${(process.env.GITHUB_REPO_URL || 'https://github.com/Aeshvivaviya/demo').replace('https://', '')}
            </a>
          </div>

          <div style="margin-top:16px;padding:14px 18px;background:#f8f9fa;border-radius:8px;border:1px solid #dee2e6;">
            <h4 style="color:#1F4E79;margin:0 0 8px 0;">📊 Task Progress</h4>
            <p style="margin:0 0 8px 0;font-size:13px;color:#555;">Your progress will be automatically tracked when you push code to the repository.</p>
            <div style="background:#e9ecef;border-radius:20px;height:20px;overflow:hidden;">
              <div style="background:linear-gradient(90deg,#1F4E79,#2E75B6);height:100%;width:0%;border-radius:20px;transition:width 0.3s;"></div>
            </div>
            <p style="margin:6px 0 0 0;font-size:12px;color:#888;text-align:right;">0% Complete</p>
            <div style="margin-top:12px;text-align:center;">
              <a href="https://demo-six-jet-95.vercel.app/progress?email=${encodeURIComponent(data.email)}"
                 style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#1F4E79,#2E75B6);color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;letter-spacing:0.3px;">
                📈 Check Live Progress
              </a>
            </div>
          </div>
        </div>

        <p style="color:#888;font-size:13px;margin-bottom:0;">
          Good luck!<br/>
          <b>Sensussoft Hiring Team</b><br/>
          <em>This task was AI-generated based on your specific profile.</em>
        </p>
      </div>
    </div>
  `;
}

// ── Nodemailer: Send email with PDF attachment ─────────────────────────────
async function sendEmail(data: ApplicationData, task: GeneratedTask): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, ""),
    },
  });

  // Generate PDF
  console.log("📄 Generating PDF...");
  const pdfBuffer = await generatePDF(data, task);
  const pdfFilename = `Sensussoft_Task_${data.name.replace(/\s+/g, "_")}.pdf`;

  // Build attachments — always include the generated task PDF
  const attachments: { filename: string; content: Buffer; contentType: string }[] = [
    {
      filename: pdfFilename,
      content: pdfBuffer,
      contentType: "application/pdf",
    },
  ];

  // Also attach the candidate's resume if provided
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
    html: renderEmail(data, task),
    text: `Hi ${data.name},\n\nTask: ${task.title}\n\nScenario: ${task.scenario}\n\nRequirements:\n${task.requirements.join("\n")}\n\nDeadline: ${task.deadline_days} days\n\nGood luck!\nSensussoft Hiring Team`,
    attachments,
  });
}

// ── Main API Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // Parse multipart/form-data (resume upload) or fall back to JSON
    let name: string, email: string, role: string, experience: string, skills: string;
    let resumeBuffer: Buffer | undefined;
    let resumeFilename: string | undefined;
    let resumeMimeType: string | undefined;

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
        const arrayBuffer = await file.arrayBuffer();
        resumeBuffer   = Buffer.from(arrayBuffer);
        resumeFilename = file.name;
        resumeMimeType = file.type;
      }
    } else {
      const body: ApplicationData = await req.json();
      ({ name, email, role, experience, skills } = body);
    }

    if (!name || !email || !role || !experience || !skills) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (!process.env.GROQ_API_KEY || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json(
        { error: "Server configuration missing. Check environment variables." },
        { status: 500 }
      );
    }

    // Optional webhook secret check (if WEBHOOK_SECRET is set in env)
    if (process.env.WEBHOOK_SECRET) {
      const secret = req.headers.get("x-webhook-secret");
      if (secret !== process.env.WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const applicationData: ApplicationData = {
      name, email, role, experience, skills,
      resumeBuffer, resumeFilename, resumeMimeType,
    };

    console.log(`\n=== New candidate received ===`);
    console.log(`Name: ${name}`);
    console.log(`Role: ${role}`);
    console.log(`Experience: ${experience}`);
    console.log(`Skills: ${skills}`);
    console.log(`Resume: ${resumeFilename ?? "not provided"}`);

    console.log("🤖 Asking Gemini to generate a task...");
    const task = await generateTask(applicationData);
    console.log("Task generated:", task.title);

    console.log(`📧 Sending email to ${email}...`);
    await sendEmail(applicationData, task);
    console.log("✅ Email sent successfully.");

    // Save to Redis store for admin panel
    await store.add({
      name,
      email,
      role,
      experience,
      skills,
      resumeFilename,
      taskTitle: task.title,
    });

    return NextResponse.json({
      success: true,
      message: "Task generated and emailed successfully",
      task_title: task.title,
    });

  } catch (error: unknown) {
    let errorMessage = "Internal server error";
    let errorStack = undefined;
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    console.error("❌ Error:", error);
    return NextResponse.json({ error: errorMessage, stack: errorStack }, { status: 500 });
  }
}
