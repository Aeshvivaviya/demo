"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Submission {
  id: string;
  name: string;
  email: string;
  role: string;
  experience: string;
  skills: string;
  resumeFilename?: string;
  taskTitle?: string;
  githubRepo?: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "rejected";
}

const STATUS_CONFIG = {
  pending:  { label: "Pending",  color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  reviewed: { label: "Reviewed", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
  rejected: { label: "Rejected", color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

export default function AdminDashboard() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/submissions");
      if (res.status === 401) {
        router.push("/admin");
        return;
      }
      const data = await res.json();
      setSubmissions(data.submissions ?? []);
    } catch {
      setError("Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin");
  };

  const updateStatus = async (id: string, status: Submission["status"]) => {
    setActionLoading(id + status);
    try {
      await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, status } : null);
    } finally {
      setActionLoading(null);
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm("Delete this submission?")) return;
    setActionLoading(id + "delete");
    try {
      await fetch("/api/admin/submissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      if (selected?.id === id) setSelected(null);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = submissions.filter((s) => {
    const matchFilter = filter === "all" || s.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const stats = {
    total: submissions.length,
    pending: submissions.filter((s) => s.status === "pending").length,
    reviewed: submissions.filter((s) => s.status === "reviewed").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-500 opacity-[0.04] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-blue-600 opacity-[0.05] rounded-full blur-[130px]" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]">
                S
              </div>
              <span className="text-white font-bold text-base tracking-tight">
                Sensus<span className="text-cyan-400">soft</span>
              </span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400 text-sm font-medium">Admin Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchSubmissions}
              className="text-slate-400 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-slate-800"
              title="Refresh"
            >
              🔄
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm border border-slate-700 hover:border-red-500/40 px-4 py-2 rounded-lg"
            >
              <span>⎋</span> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total", value: stats.total, icon: "📋", color: "text-slate-300", border: "border-slate-700" },
            { label: "Pending", value: stats.pending, icon: "⏳", color: "text-yellow-400", border: "border-yellow-500/20" },
            { label: "Reviewed", value: stats.reviewed, icon: "✅", color: "text-cyan-400", border: "border-cyan-500/20" },
            { label: "Rejected", value: stats.rejected, icon: "❌", color: "text-red-400", border: "border-red-500/20" },
          ].map((s) => (
            <div key={s.label} className={`bg-slate-900/60 border ${s.border} rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-widest">{s.label}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "reviewed", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wide transition-all duration-200 border ${
                  filter === f
                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or role..."
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <svg className="animate-spin h-8 w-8 text-cyan-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-slate-500 text-sm">Loading submissions...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-400 text-center">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-16 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-slate-400 font-medium">No submissions found</p>
            <p className="text-slate-600 text-sm mt-1">
              {submissions.length === 0 ? "Waiting for first application..." : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Table */}
            <div className={`flex-1 min-w-0 ${selected ? "hidden lg:block" : ""}`}>
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Applicant</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden md:table-cell">Role</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden lg:table-cell">Experience</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Status</th>
                        <th className="text-left px-5 py-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden sm:table-cell">Date</th>
                        <th className="px-5 py-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className={`border-b border-slate-800/60 cursor-pointer transition-colors hover:bg-slate-800/40 ${
                            selected?.id === s.id ? "bg-cyan-500/5 border-l-2 border-l-cyan-500" : ""
                          }`}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 rounded-lg flex items-center justify-center text-cyan-400 font-bold text-xs flex-shrink-0">
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-slate-200 text-sm">{s.name}</p>
                                <p className="text-slate-500 text-xs">{s.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-300 hidden md:table-cell">{s.role}</td>
                          <td className="px-5 py-4 text-slate-400 text-xs hidden lg:table-cell">{s.experience}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${STATUS_CONFIG[s.status].color}`}>
                              {STATUS_CONFIG[s.status].label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-500 text-xs hidden sm:table-cell whitespace-nowrap">
                            {new Date(s.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelected(s); }}
                              className="text-slate-500 hover:text-cyan-400 transition-colors text-xs font-medium"
                            >
                              View →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-slate-600 text-xs mt-3 text-right">
                Showing {filtered.length} of {submissions.length} submissions
              </p>
            </div>

            {/* Detail Panel */}
            {selected && (
              <div className="w-full lg:w-96 flex-shrink-0">
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl overflow-hidden sticky top-24">
                  {/* Header */}
                  <div className="relative px-6 py-5 border-b border-slate-700/60">
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 rounded-xl flex items-center justify-center text-cyan-400 font-bold">
                          {selected.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-semibold">{selected.name}</p>
                          <p className="text-slate-500 text-xs">{selected.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelected(null)}
                        className="text-slate-500 hover:text-white transition-colors text-xl leading-none"
                        aria-label="Close"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Status</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${STATUS_CONFIG[selected.status].color}`}>
                        {STATUS_CONFIG[selected.status].label}
                      </span>
                    </div>

                    {/* Details */}
                    {[
                      { label: "Role", value: selected.role },
                      { label: "Experience", value: selected.experience },
                      { label: "Skills", value: selected.skills },
                      ...(selected.resumeFilename ? [{ label: "Resume", value: selected.resumeFilename }] : []),
                      ...(selected.taskTitle ? [{ label: "Task Generated", value: selected.taskTitle }] : []),
                      { label: "Submitted", value: formatDate(selected.submittedAt) },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">{item.label}</p>
                        <p className="text-slate-300 text-sm leading-relaxed">{item.value}</p>
                      </div>
                    ))}

                    {/* GitHub Repo Link */}
                    {selected.githubRepo && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">GitHub Repo</p>
                        <a
                          href={selected.githubRepo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-2 rounded-lg transition-all duration-200 break-all"
                        >
                          <span>🐙</span>
                          <span className="truncate">{selected.githubRepo.replace("https://github.com/", "")}</span>
                          <span className="flex-shrink-0">↗</span>
                        </a>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Update Status</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["pending", "reviewed", "rejected"] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => updateStatus(selected.id, st)}
                            disabled={selected.status === st || actionLoading === selected.id + st}
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border disabled:opacity-40 disabled:cursor-not-allowed ${
                              selected.status === st
                                ? STATUS_CONFIG[st].color
                                : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                            }`}
                          >
                            {actionLoading === selected.id + st ? "..." : STATUS_CONFIG[st].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteSubmission(selected.id)}
                      disabled={actionLoading === selected.id + "delete"}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-40"
                    >
                      {actionLoading === selected.id + "delete" ? "Deleting..." : "🗑 Delete Submission"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
