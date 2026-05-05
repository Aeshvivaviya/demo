"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface ProgressData {
  name: string;
  email: string;
  role: string;
  taskTitle: string;
  progress: number;
  lastUpdated: string | null;
  submittedAt: string;
}

function ProgressContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchProgress = useCallback(async () => {
    if (!email) {
      setError("No email provided.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/progress?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Something went wrong.");
        setLoading(false);
        return;
      }
      const json: ProgressData = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    fetchProgress();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchProgress, 30000);
    return () => clearInterval(interval);
  }, [fetchProgress]);

  const progressColor =
    (data?.progress ?? 0) >= 80
      ? "from-emerald-500 to-green-400"
      : (data?.progress ?? 0) >= 50
      ? "from-cyan-500 to-blue-500"
      : "from-blue-600 to-cyan-500";

  const progressLabel =
    (data?.progress ?? 0) >= 80
      ? "Almost Done! 🎉"
      : (data?.progress ?? 0) >= 50
      ? "Good Progress! 💪"
      : (data?.progress ?? 0) > 0
      ? "In Progress... 🚀"
      : "Not Started Yet";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100 flex items-center justify-center px-4">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-cyan-500 opacity-[0.05] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600 opacity-[0.06] rounded-full blur-[130px]" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]">
            S
          </div>
          <span className="text-white font-bold text-xl tracking-tight">
            Sensus<span className="text-cyan-400">soft</span>
          </span>
        </div>

        {loading ? (
          <div className="bg-slate-900/80 border border-slate-700/60 rounded-3xl p-10 text-center">
            <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400">Loading your progress...</p>
          </div>
        ) : error ? (
          <div className="bg-slate-900/80 border border-red-500/30 rounded-3xl p-10 text-center">
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-white font-bold text-xl mb-2">Not Found</h2>
            <p className="text-slate-400 text-sm">{error}</p>
            <a
              href="/"
              className="inline-block mt-6 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-xl"
            >
              Go Back Home
            </a>
          </div>
        ) : data ? (
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(34,211,238,0.06)]">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 px-8 py-6 border-b border-slate-700/60 relative">
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />
              <h1 className="text-white font-bold text-lg">📊 Task Progress</h1>
              <p className="text-slate-400 text-sm mt-0.5">Live tracking for your submission</p>
            </div>

            <div className="px-8 py-8 space-y-6">
              {/* Candidate Info */}
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Name</span>
                  <span className="text-slate-200 font-medium">{data.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Role</span>
                  <span className="text-slate-200 font-medium">{data.role}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Task</span>
                  <span className="text-cyan-400 font-medium text-right max-w-[60%]">{data.taskTitle}</span>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-300 font-semibold text-sm">Completion</span>
                  <span className="text-2xl font-extrabold text-white">{data.progress}%</span>
                </div>

                {/* Progress bar */}
                <div className="bg-slate-800 rounded-full h-5 overflow-hidden border border-slate-700/50">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${progressColor} transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,211,238,0.4)]`}
                    style={{ width: `${data.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500">{progressLabel}</span>
                  <span className="text-xs text-slate-500">
                    {data.lastUpdated
                      ? `Updated: ${new Date(data.lastUpdated).toLocaleString()}`
                      : "No updates yet"}
                  </span>
                </div>
              </div>

              {/* Status message */}
              <div className={`rounded-2xl p-4 border text-sm ${
                data.progress >= 80
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : data.progress >= 50
                  ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                  : data.progress > 0
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                  : "bg-slate-800/60 border-slate-700/40 text-slate-400"
              }`}>
                {data.progress >= 80
                  ? "🎉 Great work! You're almost done. Make sure to submit your GitHub repo link."
                  : data.progress >= 50
                  ? "💪 You're making solid progress! Keep pushing code to update your progress."
                  : data.progress > 0
                  ? "🚀 You've started! Keep committing code to your GitHub repo to track progress."
                  : "📌 Push your code to the GitHub repository to start tracking your progress."}
              </div>

              {/* Submitted at */}
              <p className="text-xs text-slate-600 text-center">
                Task assigned on {new Date(data.submittedAt).toLocaleDateString()}
              </p>

              {/* Refresh button */}
              <button
                onClick={() => { setLoading(true); fetchProgress(); }}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-400 text-sm font-medium py-2.5 rounded-xl transition-all duration-200"
              >
                🔄 Refresh Progress
              </button>

              <p className="text-xs text-slate-600 text-center">
                Auto-refreshes every 30 seconds · Last checked: {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ProgressContent />
    </Suspense>
  );
}
