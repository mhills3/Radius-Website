import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Reads the monthly Brand Insights aggregate at adminInsights/current — written server-side by the
// insightsSnapshot Cloud Function, staff-read-gated in rules. Returns null when the doc doesn't exist
// yet (first run pending) or the reader isn't staff, so the dashboard falls back to the baked pilot.

export interface LiveSlice { label: string; n: number }
export interface LiveMold { name: string; brand: string; n: number }
export interface LiveGridCell { cell: string; n: number; pct: number }
export interface LiveArmRow { arm: string; attempts: number; makePct: number; missLeftPct: number; missRightPct: number }
export interface LivePutter { disc: string; brand: string | null; attempts: number; makePct: number; missLeftPct: number; missRightPct: number }

export interface LiveInsights {
  asOf: string;
  updatedAt?: number;
  totals: {
    players: number; rounds: number; activePlayers: number; proMembers: number;
    withBag: number; bagSlots: number; avgBagSize: number; ratedPlayers: number; ratingRolloutPct: number;
  };
  base: {
    armSpeed: LiveSlice[]; style: LiveSlice[]; hand: LiveSlice[];
    gender: { slices: LiveSlice[]; set: number };
    maxDistance: LiveSlice[]; ratingTiers: LiveSlice[];
    brandShare: LiveSlice[]; topMolds: LiveMold[];
  };
  putting: {
    coverage: { roundDocs: number; decoded: number; shotByShotRounds: number; shots: number; shotsWithGps: number; putts: number; zonedMisses: number };
    grid: LiveGridCell[]; mostCommon: { cell: string | null; pct: number };
    missLeftPct: number; missRightPct: number;
    makeRate: { C1: number; C1att: number; C2: number; C2att: number };
    byArm: LiveArmRow[]; perPutter: LivePutter[]; minSample: number;
  };
}

export async function getLiveInsights(): Promise<LiveInsights | null> {
  try {
    const snap = await getDoc(doc(db, "adminInsights", "current"));
    if (!snap.exists()) return null;
    const d = snap.data() as Record<string, unknown>;
    const ts = d.updatedAt as { toMillis?: () => number } | undefined;
    return { ...(d as unknown as LiveInsights), updatedAt: ts?.toMillis?.() };
  } catch {
    return null; // not staff / offline → baked pilot
  }
}
