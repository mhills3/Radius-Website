import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// The kills the stores never show. Jetsam/memory terminations and watchdog
// kills are invisible in App Store Connect and Play Console crash reporting;
// the apps' MetricKit pipeline (appDiagnostics) is the only fleet-wide record.
// Served by the `adminStability` callable (staff re-checked server-side,
// 30-min cache in adminInsights/stability). One row per day × app version.

export interface StabilityRow {
  day: string;            // "YYYY-MM-DD" (UTC)
  version: string;        // appVersion the payload reported
  daily: number;          // dailyMetrics payloads = active-user-day proxy
  users: number;          // distinct uids that sent anything
  memoryLimit: number;    // jetsam memory-cap exits (foreground)
  watchdog: number;       // 0x8BADF00D watchdog kills
  abnormal: number;
  sig9: number;           // SIGKILL crash payloads (system terminations)
  sig9Users: number;
  sig6: number;           // SIGABRT (real aborts — uncaught exceptions etc.)
  otherCrash: number;
  peakP50: number;        // peakMemoryMB percentiles across the day's payloads
  peakP90: number;
  peakMax: number;
  killRate: number | null; // (memoryLimit + sig9) / daily
  killsLE26: number;      // OS split: iOS <=26 had the 3D live map pre-3.3.5
  kills27: number;
  docsLE26: number;
  docs27: number;
}

export interface AdminStability {
  generatedAt: number;
  computeMs: number;
  windowDays: number;
  docsScanned: number;
  rows: StabilityRow[];
  cached?: boolean;
}

export async function getAdminStability(force = false): Promise<AdminStability> {
  const fn = httpsCallable<{ force?: boolean }, AdminStability>(functions, "adminStability");
  const res = await fn(force ? { force: true } : {});
  return res.data;
}
