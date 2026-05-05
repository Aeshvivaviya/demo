import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

// GET /api/progress?email=candidate@example.com
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const submissions = store.getAll();
  const submission = submissions.find(
    (s) => s.email.toLowerCase() === email.toLowerCase()
  );

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: submission.name,
    email: submission.email,
    role: submission.role,
    taskTitle: submission.taskTitle || "Task",
    progress: submission.taskProgress ?? 0,
    lastUpdated: submission.lastUpdated || null,
    submittedAt: submission.submittedAt,
  });
}
