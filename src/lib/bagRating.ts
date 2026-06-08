// Faithful port of the app's BagRater.rate (iOS RecommendationEngine.rateBag).
// 5 weighted components: slot 30%, role 30%, depth 15%, speed-spread 10%, fit 15%.

import { type FlightDisc, type Cat, type Tier, type DbDisc, CAT_META, tierFor, normCat } from "./bag";

export interface BagRating {
  overall: number;
  grade: string;
  tagline: string;
  identity: string[];
  breakdown: { slotCoverage: number; roleCoverage: number; depth: number; speedSpread: number; playerFit: number };
  roles: { label: string; covered: boolean }[];
  gaps: { label: string; category: Cat; tier: Tier; suggestion?: string }[];
  strengths: string[];
  ceiling: number;
  scored: number;
}

const SLOT_CATS: Cat[] = ["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"];
const TIERS: Tier[] = ["US", "ST", "OS"];
const TIER_LABEL: Record<Tier, string> = { US: "Understable", ST: "Straight", OS: "Overstable" };

export function ceilingFor(armSpeed?: string): number {
  switch ((armSpeed || "").toUpperCase()) {
    case "BEGINNER": return 7;
    case "RECREATIONAL": return 9;
    case "ADVANCED": return 13;
    case "PRO": return 15;
    default: return 11; // INTERMEDIATE
  }
}

const POPULAR = ["Innova", "Discraft", "Dynamic Discs", "Dynamic Disc", "MVP", "Axiom", "Discmania", "Latitude 64", "Westside", "Kastaplast", "Prodigy", "Gateway"];

function emptyRating(ceiling: number): BagRating {
  return {
    overall: 0, grade: "—", tagline: "Add discs to start scoring your bag", identity: [],
    breakdown: { slotCoverage: 0, roleCoverage: 0, depth: 0, speedSpread: 0, playerFit: 0 },
    roles: [], gaps: [], strengths: [], ceiling, scored: 0,
  };
}

export function rateBag(allDiscs: FlightDisc[], armSpeed: string | undefined, catalog: DbDisc[]): BagRating {
  const ceiling = ceilingFor(armSpeed);
  const bag = allDiscs
    .filter((d) => d.speed != null && d.turn != null && d.fade != null && SLOT_CATS.includes(d.category))
    .map((d) => ({
      name: d.name,
      cat: d.category,
      sp: d.speed as number,
      gl: d.glide ?? 0,
      stab: (d.turn as number) + (d.fade as number),
      fade: d.fade as number,
    }));
  if (bag.length === 0) return emptyRating(ceiling);

  const byCat = (c: Cat) => bag.filter((d) => d.cat === c);

  // 1. Slot coverage (30%)
  let totalSlotsCovered = 0;
  for (const c of SLOT_CATS) for (const t of TIERS) if (byCat(c).some((d) => tierFor(d.stab) === t)) totalSlotsCovered++;
  const slotCoverage = Math.min(100, Math.trunc((totalSlotsCovered / 12) * 110));

  // 2. Role coverage (30%) — 7 roles × 14
  const RV = 14;
  const roleDefs: { label: string; ok: boolean }[] = [
    { label: "Straight shot", ok: bag.some((d) => d.stab >= -0.5 && d.stab <= 1.0) },
    { label: "Turnover / anhyzer", ok: bag.some((d) => d.stab < -0.5) },
    { label: "Hyzer / overstable", ok: bag.some((d) => d.stab > 1.5) },
    { label: "Headwind driver", ok: bag.some((d) => d.stab > 1.5 && d.sp >= 7) },
    { label: "Touch approach", ok: bag.some((d) => d.cat === "PUTTER" && d.sp >= 3 && d.sp <= 4) || bag.some((d) => d.cat === "PUTTER" && d.stab > 1.5) },
    { label: "Workable distance", ok: bag.some((d) => d.sp >= 9 && d.sp <= ceiling) },
    { label: "Utility / escape", ok: bag.some((d) => d.stab > 1.5 && d.fade >= 3) },
  ];
  const roleCoverage = Math.min(100, roleDefs.filter((r) => r.ok).length * RV);

  // 3. Depth (15%)
  let depthPoints = 0;
  for (const c of SLOT_CATS) {
    const cd = byCat(c);
    if (cd.length === 0) continue;
    if (cd.length === 1) { depthPoints += 12; continue; }
    const sorted = [...cd].sort((a, b) => a.stab - b.stab);
    let roles = 1;
    for (let i = 1; i < sorted.length; i++) if (Math.abs(sorted[i].stab - sorted[i - 1].stab) > 1.0) roles++;
    depthPoints += 15 + Math.min(roles, 4) * 2.5;
  }
  const depth = Math.min(100, Math.trunc(depthPoints));

  // 4. Speed spread (10%)
  const buckets = [[1, 3], [4, 6], [7, 9], [10, 12], [13, 15]];
  const hit = buckets.filter(([lo, hi]) => bag.some((d) => d.sp >= lo && d.sp <= hi)).length;
  const speedSpread = hit === 5 ? 100 : hit === 4 ? 92 : hit === 3 ? 75 : hit === 2 ? 50 : hit === 1 ? 25 : 0;

  // 5. Player fit (15%)
  const total = bag.length;
  const atOrBelow = bag.filter((d) => d.sp <= ceiling).length;
  let fitPoints = (atOrBelow / total) * 60;
  const idealCount = bag.filter((d) => d.sp >= ceiling - 3 && d.sp <= ceiling).length;
  fitPoints += idealCount >= 2 ? 25 : idealCount === 1 ? 15 : 0;
  fitPoints -= (bag.filter((d) => d.sp > ceiling).length / total) * 30;
  const playerFit = Math.max(0, Math.min(100, Math.trunc(fitPoints)));

  const overall = Math.max(0, Math.min(100, Math.trunc(slotCoverage * 0.3 + roleCoverage * 0.3 + depth * 0.15 + speedSpread * 0.1 + playerFit * 0.15)));
  const grade = overall >= 95 ? "A" : overall >= 85 ? "B" : overall >= 75 ? "C" : overall >= 65 ? "D" : "F";
  const tagline =
    overall >= 95 ? "Elite build — keep dialing it in" :
    overall >= 85 ? "Great build — fine-tune to reach elite" :
    overall >= 75 ? "Solid bag — a few gaps to fill" :
    overall >= 65 ? "Coming together — keep adding pieces" :
    "Early days — build out the basics";

  // Identity
  const us = bag.filter((d) => d.stab < -0.5).length;
  const os = bag.filter((d) => d.stab > 1.5).length;
  const high = bag.filter((d) => d.sp >= 10).length;
  const low = bag.filter((d) => d.sp <= 6).length;
  const identity: string[] = [];
  identity.push(os / total > 0.5 ? "Overstable-heavy" : us / total > 0.4 ? "Understable-leaning" : "Balanced stability");
  identity.push(high / total > 0.5 ? "Distance-heavy" : low / total > 0.5 ? "Control-focused" : "Balanced speed");
  identity.push(total < 10 ? "Minimalist" : total >= 15 && total <= 22 ? "Tournament-ready" : total > 22 ? "Loaded" : "Building");

  // Strengths
  const putters = byCat("PUTTER").length, mids = byCat("MIDRANGE").length, fairways = byCat("FAIRWAY").length, drivers = byCat("DISTANCE").length;
  const strengths: string[] = [];
  if (putters >= 3) strengths.push("Strong putter game");
  if (mids >= 2 && byCat("MIDRANGE").some((d) => d.stab < 0)) strengths.push("Versatile midrange arsenal");
  if (fairways >= 2) strengths.push("Good fairway selection");
  if (drivers >= 3) strengths.push("Deep distance lineup");
  if (slotCoverage >= 100) strengths.push("Complete slot coverage");
  if (speedSpread >= 90) strengths.push("Full speed range covered");
  if (roleCoverage >= 85) strengths.push("Covers all key roles");
  if (playerFit >= 80) strengths.push("Well-matched to your arm");
  if (total >= 15 && total <= 22) strengths.push("Tournament-ready size");

  // Gaps — uncovered slots with a suggested disc from the catalog
  const bagNames = new Set(allDiscs.map((d) => d.name.toLowerCase()));
  const suggest = (cat: Cat, tier: Tier): string | undefined => {
    const matches = catalog
      .filter((d) => normCat(d.category) === cat && !bagNames.has(d.name.toLowerCase()) && tierFor(d.turn + d.fade) === tier);
    if (!matches.length) return undefined;
    matches.sort((a, b) => {
      const pa = POPULAR.indexOf(a.manufacturer); const pb = POPULAR.indexOf(b.manufacturer);
      const ra = pa === -1 ? 99 : pa; const rb = pb === -1 ? 99 : pb;
      return ra - rb || a.name.localeCompare(b.name);
    });
    return matches[0].name;
  };
  const gaps: BagRating["gaps"] = [];
  for (const c of SLOT_CATS) for (const t of TIERS) {
    if (!byCat(c).some((d) => tierFor(d.stab) === t)) {
      gaps.push({ label: `${TIER_LABEL[t]} ${CAT_META[c].short.toLowerCase()}`, category: c, tier: t, suggestion: suggest(c, t) });
    }
  }

  return {
    overall, grade, tagline, identity,
    breakdown: { slotCoverage, roleCoverage, depth, speedSpread, playerFit },
    roles: roleDefs.map((r) => ({ label: r.label, covered: r.ok })),
    gaps, strengths, ceiling, scored: bag.length,
  };
}
