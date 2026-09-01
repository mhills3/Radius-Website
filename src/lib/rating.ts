// Radius Rating engine — a 1:1 port of iOS `enum RadiusRatingEngine`
// (RecommendationEngine 2.swift, branch radius-rating). The rating number a
// player sees IN THE APP is computed on-device by this same math and mirrored
// to Firestore (users/{id}.radiusRating). On web we (a) READ that mirrored,
// authoritative number for other players, and (b) recompute it here from the
// signed-in user's own rounds for the trajectory + per-round cards, which are
// not mirrored. Keep this math identical to iOS — do not "improve" it.
//
// Spec section references (§n) match the iOS comments.

// MARK: Calibration (§5) — iOS default is 18.0, remote-overridable via
// config/ratings.calibrationOffset. The mirrored number already baked in
// whatever offset the app used; this default only affects web-recomputed
// numbers for the owner before their app has synced.
export const CALIBRATION_OFFSET = 18.0;

// ---- Geometry inputs the SSA math needs, per course hole ----
export interface RatingHole {
  holeNumber: number;
  distance: number;                 // stored tee→basket feet
  calculatedDistanceFt?: number;    // GPS path (tee→elbows→basket) feet; 0/undef if unmapped
  holeType?: string;                // "Open" | "Wooded" | "Semi-Wooded" | "Island" | "Water Carry"
  fairwayShape?: string;            // "Straight" | "Dogleg Left" | "Dogleg Right" | "S-Turn"
  elbows?: { lat: number; lng: number }[];
  elevationFeet?: number;           // raw GPS elevation delta (may be noisy)
}

// ---- Round inputs ----
export interface RatingRoundHole {
  holeNumber: number;
  score: number;        // throws + OB penalties (already computed)
  holeDistance: number; // round's own tee→basket feet (engine fallback)
}
export interface RatingRoundLike {
  gameMode?: string;    // must be "None" (default) to be rated
  layoutId?: string | null;
  holes: RatingRoundHole[];
}
export interface RatingCourseLike {
  holes: RatingHole[];
  layouts?: { id: string; holes: RatingHole[] }[];
}

// MARK: Layout difficulty — Tier 0 geometry prior (§2.1)
export function feetPerThrow(hole: RatingHole): number {
  let base: number;
  switch (hole.holeType) {
    case "Open": base = 320; break;
    case "Semi-Wooded": base = 285; break;
    case "Wooded": base = 250; break;
    case "Island":
    case "Water Carry": base = 285; break; // penalty-shaped, terrain unknown
    default: base = 250; break;            // iOS decodes unknown holeType → .wooded
  }
  // A bent line plays tighter than its type suggests.
  const bent = (hole.fairwayShape && hole.fairwayShape !== "Straight") || (hole.elbows?.length ?? 0) > 0;
  return Math.max(235, bent ? base - 15 : base);
}

/** iOS CourseHole.saneElevationFeet — GPS altitude clamped to a 20% grade. */
export function saneElevationFeet(hole: RatingHole): number | null {
  if (typeof hole.elevationFeet !== "number") return null;
  const calc = hole.calculatedDistanceFt ?? 0;
  const length = Math.max(calc > 0 ? calc : hole.distance, 60);
  const cap = length * 0.2;
  return Math.min(Math.max(hole.elevationFeet, -cap), cap);
}

/** Elevation term for SSA — sane value, then clamped to ±60 ft for the math. */
export function ratingElevationFeet(hole: RatingHole): number {
  return Math.min(Math.max(saneElevationFeet(hole) ?? 0, -60), 60);
}

export function holeSSA(hole: RatingHole): number | null {
  const calc = hole.calculatedDistanceFt ?? 0;
  const len = calc > 0 ? calc : hole.distance;
  if (len < 60) return null; // no usable length → hole unratable
  const eff = Math.max(60, len + 3.0 * ratingElevationFeet(hole));
  return 1.667 + eff / feetPerThrow(hole);
}

// MARK: Compression curve PPT(ssa18) (§3) — community fit, |r| > 0.999, pivot 50.4 → 10.0
export function pointsPerThrow(ssa18: number): number {
  return ssa18 > 50.3289725
    ? (-0.225067 * ssa18 + 21.3858)
    : (-0.487095 * ssa18 + 34.5734);
}

// MARK: Round rating (§3)
export interface RoundRating {
  rating: number;      // calibrated, truncated
  ssa: number;         // summed hole SSAs for the holes played
  holesPlayed: number;
  score: number;
  expectedScore: number; // "plays N for a 1000-rated player"
}

/**
 * §2.4 eligibility + §3 math. Returns null (unrated) when the round doesn't
 * qualify — callers show "—", never a fabricated number.
 */
export function rate(round: RatingRoundLike, course: RatingCourseLike | null): RoundRating | null {
  if ((round.gameMode ?? "None") !== "None") return null;
  const played = round.holes.filter((h) => h.score > 0);
  if (played.length < 9) return null;

  // Layout-aware hole set: the layout actually played beats the default.
  let layoutHoles: RatingHole[] = [];
  if (course) {
    const lid = round.layoutId;
    const layout = lid ? course.layouts?.find((l) => l.id === lid) : undefined;
    layoutHoles = layout ? layout.holes : course.holes;
  }

  let ssaSum = 0;
  let score = 0;
  for (const h of played) {
    const ch = layoutHoles.find((c) => c.holeNumber === h.holeNumber);
    const s = ch ? holeSSA(ch) : null;
    let hSSA: number;
    if (s != null) {
      hSSA = s;
    } else if (h.holeDistance >= 60) {
      // Round carries its own tee-to-basket distance — the moderate-foliage
      // prior when the course hole can't be resolved.
      hSSA = 1.667 + h.holeDistance / 285.0;
    } else {
      return null; // a played hole with no usable length → unrated
    }
    ssaSum += hSSA;
    score += h.score;
  }

  const n = played.length;
  const ssa18 = (ssaSum * 18.0) / n;
  const ppt = (pointsPerThrow(ssa18) * 18.0) / n;
  const raw = 1000.0 + (ssaSum - score) * ppt - CALIBRATION_OFFSET;
  const clamped = Math.min(Math.max(raw, 0), 1400);
  return {
    rating: Math.floor(clamped),
    ssa: ssaSum,
    holesPlayed: n,
    score,
    expectedScore: Math.round(ssaSum),
  };
}

// MARK: Player rating — best 8 of the most recent 20 (§4)
export interface RatedRound {
  rating: number;
  holesPlayed: number;
  date: number; // epoch ms
}
export interface PlayerRating {
  value: number;
  roundsUsed: number;  // rounds in the best-N mean
  roundsRated: number; // rated rounds in the 24-month pool (≤20)
  provisional: boolean; // fewer than 8 rated rounds
}

export function playerRating(rated: RatedRound[], now: number = Date.now()): PlayerRating | null {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - 24);
  const cutoffMs = cutoff.getTime();
  const pool = rated
    .filter((r) => r.date >= cutoffMs)
    .sort((a, b) => b.date - a.date)
    .slice(0, 20);
  if (pool.length < 3) return null; // hidden under 3 (§4)
  const take = pool.length >= 20 ? 8 : Math.max(1, Math.ceil(pool.length * 0.4));
  const best = [...pool].sort((a, b) => b.rating - a.rating).slice(0, take);
  // Holes-weighted mean: a 9-hole round carries half a vote.
  let wSum = 0;
  let rSum = 0;
  for (const r of best) {
    const w = r.holesPlayed / 18.0;
    wSum += w;
    rSum += r.rating * w;
  }
  if (wSum <= 0) return null;
  return {
    value: Math.floor(rSum / wSum),
    roundsUsed: best.length,
    roundsRated: pool.length,
    provisional: pool.length < 8,
  };
}

// MARK: §6.1 — the published anchor values as executable checks (pre-calibration).
// Mirrors iOS validateRatingMath(); used by scripts/verify to gate the port.
export function validateRatingMath(): string[] {
  const results: string[] = [];
  const check = (score: number, ssa: number, expect: number, tolerance = 2) => {
    const ppt = pointsPerThrow(ssa);
    const r = Math.floor(1000.0 + (ssa - score) * ppt);
    const pass = Math.abs(r - expect) <= tolerance;
    results.push(`${pass ? "PASS" : "FAIL"} ${score} @ SSA ${ssa} → ${r} (want ${expect}±${tolerance})`);
  };
  check(45, 58, 1108);
  check(44, 57.5, 1113);
  check(58, 67, 1057, 4);
  check(50, 50.4, 1004); // pivot: PPT exactly ~10
  const pptPivot = pointsPerThrow(50.4);
  results.push(`${Math.abs(pptPivot - 10.0) < 0.15 ? "PASS" : "FAIL"} PPT(50.4) = ${pptPivot.toFixed(2)} (want ≈10.0)`);
  const ppt44 = pointsPerThrow(44);
  results.push(`${Math.abs(ppt44 - 13.0) < 1.0 ? "PASS" : "FAIL"} PPT(44) = ${ppt44.toFixed(2)} (want ≈13)`);
  const ppt68 = pointsPerThrow(68);
  results.push(`${Math.abs(ppt68 - 6.0) < 1.0 ? "PASS" : "FAIL"} PPT(68) = ${ppt68.toFixed(2)} (want ≈6)`);
  return results;
}
