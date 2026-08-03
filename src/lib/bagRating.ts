// Faithful port of the app's BagRater.rate (iOS RecommendationEngine.rateBag).
// 5 weighted components: slot 30%, role 30%, depth 15%, speed-spread 10%, fit 15%.

import { type FlightDisc, type Cat, type Tier, type DbDisc, CAT_META, normCat } from "./bag";

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

// iOS slot stability ranges (Models 2.swift BagSlotType.stabilityRange). NOTE these OVERLAP at 1.5
// (a disc at 1.5 fills BOTH the straight and overstable slots) and -0.5 is understable (US inclusive;
// straight starts at -0.49). Slot coverage uses range membership, NOT single-tier tierFor().
const TIER_RANGE: Record<Tier, [number, number]> = { US: [-10, -0.5], ST: [-0.49, 1.5], OS: [1.5, 10] };
const tierHas = (t: Tier, stab: number): boolean => stab >= TIER_RANGE[t][0] && stab <= TIER_RANGE[t][1];

// Wear factor by condition (iOS DiscCondition.wearFactor).
const WEAR_FACTOR: Record<string, number> = { "Brand New": 0, "Slightly Used": 0.3, "Seasoned": 0.7, "Beat In": 1.2, "Very Beat In": 1.8 };

// iOS scores the disc AFTER Disc.withWear(wear) (Models 2.swift): EVERY component uses these numbers,
// not the factory numbers. If the disc has ANY custom flight override, those win (per field, else
// factory) and condition wear is skipped; otherwise condition adjusts turn/fade (speed/glide stay
// factory). turn -= wf*0.5 (more understable), fade = max(0, fade - wf*0.3).
function withWear(d: FlightDisc): { sp: number; turn: number; fade: number } {
  const sp = d.speed as number, turn = d.turn as number, fade = d.fade as number;
  const hasCustom = d.customSpeed != null || d.customGlide != null || d.customTurn != null || d.customFade != null;
  if (hasCustom) return { sp: d.customSpeed ?? sp, turn: d.customTurn ?? turn, fade: d.customFade ?? fade };
  const wf = WEAR_FACTOR[d.condition ?? ""] ?? 0;
  return { sp, turn: turn - wf * 0.5, fade: Math.max(0, fade - wf * 0.3) };
}

// Depth ONLY: iOS re-applies adjustedFlightNumbers(wear) on top of the already-withWear disc, so
// condition wear lands a second time for non-custom discs (and once on custom discs). Match that.
function depthStability(effTurn: number, effFade: number, condition?: string): number {
  const wf = WEAR_FACTOR[condition ?? ""] ?? 0;
  return (effTurn - wf * 0.5) + Math.max(0, effFade - wf * 0.3);
}

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
    .map((d) => {
      const w = withWear(d); // effective flight numbers used by every component (iOS scores post-withWear)
      return {
        name: d.name,
        cat: d.category,
        sp: w.sp,
        gl: d.glide ?? 0,
        stab: w.turn + w.fade,
        fade: w.fade,
        adjStab: depthStability(w.turn, w.fade, d.condition), // depth re-applies wear on top
      };
    });
  if (bag.length === 0) return emptyRating(ceiling);

  const byCat = (c: Cat) => bag.filter((d) => d.cat === c);

  // 1. Slot coverage (30%) — range membership per iOS (overlaps at 1.5), not single-tier tierFor
  let totalSlotsCovered = 0;
  for (const c of SLOT_CATS) for (const t of TIERS) if (byCat(c).some((d) => tierHas(t, d.stab))) totalSlotsCovered++;
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
    // iOS sorts/diffs by WEAR-ADJUSTED stability here (only the depth component does this).
    const sorted = [...cd].sort((a, b) => a.adjStab - b.adjStab);
    let roles = 1;
    for (let i = 1; i < sorted.length; i++) if (Math.abs(sorted[i].adjStab - sorted[i - 1].adjStab) > 1.0) roles++;
    depthPoints += 15 + Math.min(roles, 4) * 2.5;
  }
  const depth = Math.min(100, Math.trunc(depthPoints));

  // 4. Speed spread (10%)
  const buckets = [[1, 3], [4, 6], [7, 9], [10, 12], [13, 15]];
  const hit = buckets.filter(([lo, hi]) => bag.some((d) => d.sp >= lo && d.sp <= hi)).length;
  const speedSpread = hit === 5 ? 100 : hit === 4 ? 92 : hit === 3 ? 75 : hit === 2 ? 50 : hit === 1 ? 25 : 0;

  // 5. Player fit (15%) — iOS applies a +1 GRACE BAND to the ceiling for at-or-below and the
  // over-ceiling penalty; the ideal-range bonus still uses the raw ceiling.
  const total = bag.length;
  const fitCeiling = ceiling + 1;
  const atOrBelow = bag.filter((d) => d.sp <= fitCeiling).length;
  let fitPoints = (atOrBelow / total) * 60;
  const idealCount = bag.filter((d) => d.sp >= ceiling - 3 && d.sp <= ceiling).length;
  fitPoints += idealCount >= 2 ? 25 : idealCount === 1 ? 15 : 0;
  fitPoints -= (bag.filter((d) => d.sp > fitCeiling).length / total) * 30;
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
      .filter((d) => normCat(d.category) === cat && !bagNames.has(d.name.toLowerCase()) && tierHas(tier, d.turn + d.fade));
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
    if (!byCat(c).some((d) => tierHas(t, d.stab))) {
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
