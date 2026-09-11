// Radius Brand Insights — PILOT snapshot data.
// Hand-pulled 2026-09-10 from the readable user docs (bags, arm speed, gender, hand, style, Game IQ)
// so we have the real shape of the sellable data in our back pocket. This is a static baked snapshot,
// NOT live — the extraction pipeline (runs with admin creds) will make it authoritative and add the
// shot-level layers (putting misses, real-vs-stamped flight) that aren't in user docs.
//
// Denominators differ by field and that MATTERS — say which cohort each number is over:
//   • onboarding cohort — bags / arm speed / hand / style / gender: set at signup, broad.
//   • active cohort — rounds logged: ~1,142 of 9,102 signups have played ≥1 round.
//   • rated cohort — a computed Game IQ needs enough rounds: 244 players.
// Nothing here is per-person; only rolled-up counts. Never expose an individual.

export const PILOT_AS_OF = "Sep 10, 2026";

export const TOTALS = {
  players: 9102,        // all signups (aggregation count)
  rounds: 7018,         // sum of roundsPlayed
  activePlayers: 1142,  // logged ≥1 round
  proMembers: 548,      // isPro === true
  withBag: 6527,        // users whose bag was readable
  bagSlots: 88399,      // total brand-mapped discs across all bags
  avgBagSize: 13.9,
  ratedPlayers: 244,    // Game IQ > 0
  ratingRolloutPct: 2.7,// % with the new mirrored radiusRating (just starting)
};

export interface Slice { label: string; n: number; color?: string }

// ── the base: who plays Radius (onboarding cohort) ─────────────────────────
export const ARM_SPEED: Slice[] = [
  { label: "Intermediate", n: 4305, color: "#f6c165" },
  { label: "Recreational", n: 2279, color: "#8fd3a6" },
  { label: "Advanced", n: 1420, color: "#6fb2ff" },
  { label: "Beginner", n: 522, color: "#b78c59" },
  { label: "Pro", n: 296, color: "#d98cf0" },
];
export const STYLE: Slice[] = [
  { label: "Backhand", n: 4524, color: "#f6c165" },
  { label: "Both", n: 3473, color: "#6fb2ff" },
  { label: "Forehand", n: 825, color: "#ef8f6b" },
];
export const HAND: Slice[] = [
  { label: "Right", n: 8157, color: "#8fd3a6" },
  { label: "Left", n: 665, color: "#d98cf0" },
];
export const GENDER: Slice[] = [
  { label: "Male", n: 5491, color: "#6fb2ff" },
  { label: "Female", n: 82, color: "#f6a8c0" },
];
export const GENDER_SET = 5573; // reported gender (of 9,102)

export const MAX_DISTANCE: Slice[] = [
  { label: "< 300 ft", n: 1483 },
  { label: "300–349", n: 43 },
  { label: "350–399", n: 2275 },
  { label: "400–449", n: 860 },
  { label: "450+ ft", n: 220 },
];

// ── rating tiers (rated cohort — Game IQ) ──────────────────────────────────
export const RATING_TIERS: Slice[] = [
  { label: "Rookie", n: 0, color: "#b78c59" },
  { label: "Amateur", n: 23, color: "#a6adb8" },
  { label: "Competitor", n: 36, color: "#8fd3a6" },
  { label: "Advanced", n: 66, color: "#8cc7eb" },
  { label: "Pro", n: 117, color: "#a673d9" },
  { label: "Champion", n: 2, color: "#d9404d" },
];

// ── the money view: brand share of every bagged disc ───────────────────────
export const BRAND_SHARE: Slice[] = [
  { label: "Discraft", n: 19195 },
  { label: "Innova", n: 17571 },
  { label: "Axiom", n: 10964 },
  { label: "MVP", n: 9516 },
  { label: "Discmania", n: 7993 },
  { label: "Latitude 64", n: 4618 },
  { label: "Dynamic Discs", n: 3577 },
  { label: "Prodigy", n: 2712 },
  { label: "Kastaplast", n: 2121 },
  { label: "Westside", n: 1785 },
  { label: "Streamline", n: 956 },
  { label: "Gateway", n: 873 },
];

export interface Mold { name: string; brand: string; n: number }
export const TOP_MOLDS: Mold[] = [
  { name: "Buzzz", brand: "Discraft", n: 2256 },
  { name: "Zone", brand: "Discraft", n: 2038 },
  { name: "Destroyer", brand: "Innova", n: 1939 },
  { name: "Trail", brand: "MVP", n: 1634 },
  { name: "Hex", brand: "Axiom", n: 1544 },
  { name: "Wraith", brand: "Innova", n: 1264 },
  { name: "Luna", brand: "Discraft", n: 1226 },
  { name: "Crave", brand: "Axiom", n: 1194 },
  { name: "Firebird", brand: "Innova", n: 1103 },
  { name: "Envy", brand: "Axiom", n: 1041 },
  { name: "Berg", brand: "Kastaplast", n: 920 },
  { name: "Proxy", brand: "Axiom", n: 804 },
];
