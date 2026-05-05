// Redis-backed store using Upstash
// Data persists across Vercel deployments

import { Redis } from "@upstash/redis";

export interface Submission {
  id: string;
  name: string;
  email: string;
  role: string;
  experience: string;
  skills: string;
  resumeFilename?: string;
  taskTitle?: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "rejected";
  githubRepo?: string;
  taskProgress?: number;
  lastUpdated?: string;
}

// Initialize Redis client using Vercel/Upstash env vars
function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const SUBMISSIONS_KEY = "submissions";

export const store = {
  async getAll(): Promise<Submission[]> {
    const redis = getRedis();
    if (!redis) return getFallbackStore().getAll();
    try {
      const data = await redis.get<Submission[]>(SUBMISSIONS_KEY);
      return data ?? [];
    } catch {
      return getFallbackStore().getAll();
    }
  },

  async add(submission: Omit<Submission, "id" | "submittedAt" | "status">): Promise<Submission> {
    const redis = getRedis();
    const newEntry: Submission = {
      ...submission,
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
      status: "pending",
    };

    if (!redis) return getFallbackStore().add(submission);

    try {
      const existing = await redis.get<Submission[]>(SUBMISSIONS_KEY) ?? [];
      await redis.set(SUBMISSIONS_KEY, [newEntry, ...existing]);
    } catch {
      return getFallbackStore().add(submission);
    }
    return newEntry;
  },

  async updateStatus(id: string, status: Submission["status"]): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return getFallbackStore().updateStatus(id, status);
    try {
      const list = await redis.get<Submission[]>(SUBMISSIONS_KEY) ?? [];
      const idx = list.findIndex((s) => s.id === id);
      if (idx === -1) return false;
      list[idx] = { ...list[idx], status };
      await redis.set(SUBMISSIONS_KEY, list);
      return true;
    } catch {
      return false;
    }
  },

  async updateProgress(email: string, progress: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return getFallbackStore().updateProgress(email, progress);
    try {
      const list = await redis.get<Submission[]>(SUBMISSIONS_KEY) ?? [];
      const idx = list.findIndex((s) => s.email.toLowerCase() === email.toLowerCase());
      if (idx === -1) return false;
      list[idx] = { ...list[idx], taskProgress: progress, lastUpdated: new Date().toISOString() };
      await redis.set(SUBMISSIONS_KEY, list);
      return true;
    } catch {
      return false;
    }
  },

  async delete(id: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return getFallbackStore().delete(id);
    try {
      const list = await redis.get<Submission[]>(SUBMISSIONS_KEY) ?? [];
      const filtered = list.filter((s) => s.id !== id);
      if (filtered.length === list.length) return false;
      await redis.set(SUBMISSIONS_KEY, filtered);
      return true;
    } catch {
      return false;
    }
  },
};

// ── In-memory fallback (dev / no Redis) ──────────────────────────────────
const globalStore = globalThis as typeof globalThis & { submissions?: Submission[] };
if (!globalStore.submissions) globalStore.submissions = [];

function getFallbackStore() {
  return {
    getAll(): Submission[] {
      return globalStore.submissions ?? [];
    },
    add(submission: Omit<Submission, "id" | "submittedAt" | "status">): Submission {
      const newEntry: Submission = {
        ...submission,
        id: crypto.randomUUID(),
        submittedAt: new Date().toISOString(),
        status: "pending",
      };
      globalStore.submissions = [newEntry, ...(globalStore.submissions ?? [])];
      return newEntry;
    },
    updateStatus(id: string, status: Submission["status"]): boolean {
      const list = globalStore.submissions ?? [];
      const idx = list.findIndex((s) => s.id === id);
      if (idx === -1) return false;
      list[idx] = { ...list[idx], status };
      return true;
    },
    updateProgress(email: string, progress: number): boolean {
      const list = globalStore.submissions ?? [];
      const idx = list.findIndex((s) => s.email === email);
      if (idx === -1) return false;
      list[idx] = { ...list[idx], taskProgress: progress, lastUpdated: new Date().toISOString() };
      return true;
    },
    delete(id: string): boolean {
      const list = globalStore.submissions ?? [];
      const before = list.length;
      globalStore.submissions = list.filter((s) => s.id !== id);
      return (globalStore.submissions?.length ?? 0) < before;
    },
  };
}
