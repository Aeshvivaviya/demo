import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { store } from "@/lib/store";
import type { Submission } from "@/lib/store";

// GitHub Webhook handler for push events
export async function POST(req: NextRequest) {
  try {
    const event = req.headers.get("x-github-event");
    
    // Only handle push events
    if (event !== "push") {
      return NextResponse.json({ message: "Event ignored" }, { status: 200 });
    }

    const payload = await req.json();
    
    // Extract repo info
    const repoUrl = payload.repository?.html_url;
    const pusherEmail = payload.pusher?.email || payload.head_commit?.author?.email;
    const commits = payload.commits || [];
    
    if (!repoUrl || !pusherEmail) {
      return NextResponse.json({ error: "Missing repo or email" }, { status: 400 });
    }

    console.log(`📦 GitHub push from ${pusherEmail} to ${repoUrl}`);
    console.log(`📝 ${commits.length} commits`);

    // Find submission by repo URL or pusher email
    const submissions = await store.getAll();
    const repoName = repoUrl.replace("https://github.com/", "").toLowerCase();

    console.log(`📋 Total submissions in store: ${submissions.length}`);
    console.log(`📋 Pusher email: ${pusherEmail}`);
    
    let submission = submissions.find(s => {
      if (s.githubRepo) {
        const storedRepo = s.githubRepo.replace("https://github.com/", "").toLowerCase();
        return storedRepo === repoName || repoUrl.toLowerCase().includes(storedRepo);
      }
      return s.email.toLowerCase() === pusherEmail.toLowerCase();
    });

    // Fallback: use most recent submission
    if (!submission && submissions.length > 0) {
      submission = submissions[0]; // most recent is first (store adds to front)
      console.log(`⚠️ No exact match, using most recent submission: ${submission.email}`);
    }
    
    if (!submission) {
      console.log(`⚠️ No submission found at all in store`);
      return NextResponse.json({ message: "No matching submission" }, { status: 200 });
    }

    console.log(`📋 Matched submission: ${submission.email}`);

    const progress = await analyzeTaskProgress(payload, submission.taskTitle || "");
    
    await store.updateProgress(submission.email, progress);
    
    console.log(`✅ Updated progress for ${submission.email}: ${progress}%`);

    // Send progress update email to the candidate
    await sendProgressEmail(submission, progress, commits, repoUrl);
    console.log(`📧 Progress email sent to ${submission.email}`);

    return NextResponse.json({ 
      success: true, 
      email: submission.email,
      progress 
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Send progress update email to candidate
async function sendProgressEmail(
  submission: Submission,
  progress: number,
  commits: { message?: string }[],
  repoUrl: string
): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn("⚠️ Gmail credentials not set, skipping progress email");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, ""),
    },
  });

  // Build commit list for email
  const commitLines = commits
    .slice(0, 5)
    .map((c: any) => `<li style="margin:4px 0;color:#555;">${c.message || "Update"}</li>`)
    .join("");

  // Progress bar color based on percentage
  const barColor =
    progress >= 80 ? "#27ae60" :
    progress >= 50 ? "#2E75B6" : "#1F4E79";

  const statusMessage =
    progress >= 80
      ? "🎉 Amazing work! You're almost done. Make sure to submit your GitHub repo link."
      : progress >= 50
      ? "💪 Great progress! You're halfway there. Keep pushing!"
      : progress > 0
      ? "🚀 Good start! Keep committing code to increase your progress."
      : "📌 Files detected. Keep building to increase your completion score.";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#333;margin:0 auto;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1F4E79,#2E75B6);padding:28px 30px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:white;margin:0;font-size:22px;">📊 Progress Update</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0 0;font-size:14px;">Sensussoft Hiring Team</p>
      </div>

      <!-- Body -->
      <div style="background:#f8f9fa;padding:28px 30px;border-radius:0 0 12px 12px;border:1px solid #e9ecef;">
        <h2 style="color:#1F4E79;margin-top:0;">Hi ${submission.name},</h2>
        <p style="color:#555;">We noticed you just pushed code to your repository. Here's your latest progress update for the task: <b>${submission.taskTitle || "Your Task"}</b></p>

        <!-- Progress Bar -->
        <div style="background:white;border-radius:10px;padding:20px;margin:20px 0;border:1px solid #dee2e6;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-weight:bold;color:#1F4E79;font-size:15px;">Task Completion</span>
            <span style="font-size:24px;font-weight:900;color:#1F4E79;">${progress}%</span>
          </div>
          <div style="background:#e9ecef;border-radius:20px;height:18px;overflow:hidden;">
            <div style="background:linear-gradient(90deg,${barColor},#2E75B6);height:100%;width:${progress}%;border-radius:20px;"></div>
          </div>
          <p style="margin:10px 0 0 0;font-size:13px;color:#888;text-align:right;">Updated just now</p>
        </div>

        <!-- Status Message -->
        <div style="background:#f0f7ff;border-left:4px solid #2E75B6;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
          <p style="margin:0;font-size:14px;color:#1F4E79;">${statusMessage}</p>
        </div>

        ${commitLines ? `
        <!-- Recent Commits -->
        <div style="background:white;border-radius:8px;padding:16px 20px;border:1px solid #dee2e6;margin-bottom:20px;">
          <h4 style="color:#1F4E79;margin:0 0 10px 0;font-size:14px;">📝 Recent Commits</h4>
          <ul style="padding-left:18px;margin:0;">${commitLines}</ul>
        </div>
        ` : ""}

        <!-- Repo Link -->
        <div style="text-align:center;margin-bottom:20px;">
          <a href="${repoUrl}" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#1F4E79,#2E75B6);color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:bold;">
            🔗 View Repository
          </a>
        </div>

        <p style="color:#888;font-size:13px;margin-bottom:0;">
          Keep up the great work!<br/>
          <b>Sensussoft Hiring Team</b>
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Sensussoft Careers" <${process.env.GMAIL_USER}>`,
    to: submission.email,
    subject: `Sensussoft — Progress Update: ${progress}% Complete 🚀`,
    html,
    text: `Hi ${submission.name},\n\nYour task progress has been updated to ${progress}%.\n\nTask: ${submission.taskTitle || "Your Task"}\n\n${statusMessage}\n\nRepo: ${repoUrl}\n\nKeep up the great work!\nSensussoft Hiring Team`,
  });
}

// Analyze task progress using AI (OpenRouter)
async function analyzeTaskProgress(payload: { commits?: { added?: string[]; modified?: string[] }[] }, taskTitle: string): Promise<number> {
  const commits = payload.commits || [];
  const addedFiles: string[] = [];
  const modifiedFiles: string[] = [];

  commits.forEach((commit) => {
    addedFiles.push(...(commit.added || []));
    modifiedFiles.push(...(commit.modified || []));
  });

  const allFiles = [...new Set([...addedFiles, ...modifiedFiles])];

  if (allFiles.length === 0) {
    return 0;
  }

  const prompt = `You are analyzing a candidate's task submission progress.

Task: ${taskTitle}

Files added/modified:
${allFiles.map(f => `- ${f}`).join('\n')}

Based on typical software development tasks, estimate the completion percentage (0-100).

Consider:
- Number and type of files (config, source code, tests, docs)
- File names suggesting features (e.g., "login.ts", "api.ts", "README.md")
- Typical project structure completeness

Return ONLY a number between 0-100, nothing else.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Sensussoft Hiring Platform",
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 10,
      }),
    });

    if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);

    const json = await res.json();
    const text = json.choices[0]?.message?.content?.trim() || "0";
    const progress = parseInt(text, 10);

    return isNaN(progress) ? 0 : Math.min(100, Math.max(0, progress));
  } catch (err) {
    console.error("AI analysis failed:", err);
    // Fallback: simple heuristic
    return Math.min(100, allFiles.length * 10);
  }
}
