import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// The Circle's live business numbers — rounds/month, courses/month, activation, builder tiers.
// Served by the `adminPulse` callable (radius-functions), which re-checks staff with the Admin SDK,
// recomputes when the cached adminInsights/pulse doc is older than an hour, and returns the doc.

export interface MonthCount { month: string; n: number } // month = "YYYY-MM" (UTC)
export interface BuilderTier { key: string; threshold: number; grantDays: number; merchTier: string | null; builders: number; awarded: number }
export interface AdminPulse {
  generatedAt: number;
  computeMs: number;
  launchMonth: string;
  rounds: {
    byMonth: MonthCount[]; total: number; imported: number; undated: number; preLaunch: number;
    thisMonth: { month: string; n: number; dayOfMonth: number; daysIn: number; pace: number | null };
  };
  courses: { byMonth: MonthCount[]; total: number; undated: number; countable: number };
  activation: { accounts: number; loggers: number; activated: number; oneAndDone: number };
  builders: { creators: number; tiers: BuilderTier[] };
  cached?: boolean;
}

export async function getAdminPulse(force = false): Promise<AdminPulse> {
  const fn = httpsCallable<{ force?: boolean }, AdminPulse>(functions, "adminPulse");
  const res = await fn(force ? { force: true } : {});
  return res.data;
}
