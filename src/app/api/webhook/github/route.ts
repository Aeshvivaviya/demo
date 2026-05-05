import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { store } from "@/lib/store";

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
    
    const submission = submissions.find(s => {
      if (s.githubRepo) {
        const storedRepo = s.githubRepo.replace("https://github.com/", "").toLowerCase();
        return storedRepo === repoName || repoUrl.toLowerCase().includes(storedRepo);
      }
      return s.email === pusherEmail;
    }) || submissions[submissions.length - 1];
    
    if (!submission) {
      console.log(`⚠️ No submission found for repo ${repoUrl}`);
      return NextResponse.json({ message: "No matching submission" }, { status: 200 });
    }

    console.log(`📋 Matched submission: ${submission.email}`);

    const progress = await analyzeTaskProgress(payload, submission.taskTitle || "");
    
    await store.updateProgress(submission.email, progress);
    
    console.log(`✅ Updated progress for ${pusherEmail}: ${progress}%`);

    return NextResponse.json({ 
      success: true, 
      email: pusherEmail,
      progress 
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Analyze task progress using AI
async function analyzeTaskProgress(payload: any, taskTitle: string): Promise<number> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
  
  // Extract file changes
  const commits = payload.commits || [];
  const addedFiles: string[] = [];
  const modifiedFiles: string[] = [];
  
  commits.forEach((commit: any) => {
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
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 10,
    });

    const text = completion.choices[0]?.message?.content?.trim() || "0";
    const progress = parseInt(text, 10);
    
    return isNaN(progress) ? 0 : Math.min(100, Math.max(0, progress));
  } catch (err) {
    console.error("AI analysis failed:", err);
    // Fallback: simple heuristic
    return Math.min(100, allFiles.length * 10);
  }
}
