import { expectedStrokes, legacyLandingRow, type DecodedRound, type DecodedThrow } from "./rounds";
import type { RangeSession } from "./sessions";
import type { DbDisc } from "./bag";

// ---- geometry ----
const toRad = (d: number) => (d * Math.PI) / 180;
function haversineFt(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 3.28084;
}
function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return Math.atan2(y, x);
}
// signed cross-track (perpendicular) distance in ft of `land` from the rel→target line: + = right, − = left
function crossTrackFt(rel: { lat: number; lng: number }, target: { lat: number; lng: number }, land: { lat: number; lng: number }): number {
  const R = 6371000 * 3.28084;
  const d13 = haversineFt(rel, land) / R; // angular
  const xt = Math.asin(Math.sin(d13) * Math.sin(bearing(rel, land) - bearing(rel, target)));
  return xt * R;
}

const real = (t: DecodedThrow) => t.discName !== "Score";
const teeShotsOf = (h: DecodedRound["holes"][number]) => h.throws.filter(real);

// ==== 1. Drive dispersion (on-course GPS drives + range shots) ====
export interface DispersionPoint { offset: number; distance: number; ob: boolean }
export interface Dispersion { points: DispersionPoint[]; avgOffset: number; count: number }
export function driveDispersion(rounds: DecodedRound[], range: RangeSession[]): Dispersion {
  const pts: DispersionPoint[] = [];
  for (const r of rounds) {
    if (!r.isComplete) continue;
    for (const h of r.holes) {
      if (!h.played) continue;
      const tee = teeShotsOf(h)[0];
      if (!tee || (tee.lie && tee.lie !== "tee")) continue;
      if (tee.lat == null || tee.lng == null || tee.landLat == null || tee.landLng == null || tee.targetLat == null || tee.targetLng == null) continue;
      const offset = crossTrackFt({ lat: tee.lat, lng: tee.lng }, { lat: tee.targetLat, lng: tee.targetLng }, { lat: tee.landLat, lng: tee.landLng });
      const dist = haversineFt({ lat: tee.lat, lng: tee.lng }, { lat: tee.landLat, lng: tee.landLng });
      if (Math.abs(offset) > 300 || dist < 100) continue; // drop nonsense
      pts.push({ offset, distance: Math.round(dist), ob: tee.result === "OB" });
    }
  }
  for (const s of range) for (const sh of s.shots) if (sh.distanceFeet >= 100) pts.push({ offset: sh.lateralOffsetFeet, distance: Math.round(sh.distanceFeet), ob: sh.zone === "Miss Left" || sh.zone === "Miss Right" });
  const avgOffset = pts.length ? pts.reduce((a, p) => a + p.offset, 0) / pts.length : 0;
  return { points: pts, avgOffset, count: pts.length };
}

// ==== 2. Bag, measured — per-disc on-course drive distance × fade ====
export interface DiscDot { name: string; distance: number; stability: number; count: number }
export interface BagMeasured { discs: DiscDot[]; gap: { lo: number; hi: number } | null; minD: number; maxD: number }
export function bagMeasured(rounds: DecodedRound[], catalog: DbDisc[]): BagMeasured {
  const cat = new Map(catalog.map((d) => [d.name.toLowerCase(), d]));
  const m = new Map<string, { sum: number; count: number }>();
  for (const r of rounds) { if (!r.isComplete) continue; for (const h of r.holes) { if (!h.played) continue; const tee = teeShotsOf(h)[0]; if (!tee || (tee.lie && tee.lie !== "tee")) continue; const d = tee.distance ?? 0; if (d < 100) continue; const e = m.get(tee.discName) ?? { sum: 0, count: 0 }; e.sum += d; e.count++; m.set(tee.discName, e); } }
  const discs: DiscDot[] = [];
  for (const [name, e] of m) {
    const c = cat.get(name.toLowerCase());
    if (!c || typeof c.turn !== "number" || typeof c.fade !== "number") continue; // need a known fade → no assumptions
    if (e.count < 2) continue;
    discs.push({ name, distance: Math.round(e.sum / e.count), stability: c.turn + c.fade, count: e.count });
  }
  discs.sort((a, b) => a.distance - b.distance);
  // biggest distance gap between consecutive discs
  let gap: { lo: number; hi: number } | null = null, best = 0;
  for (let i = 1; i < discs.length; i++) { const g = discs[i].distance - discs[i - 1].distance; if (g > best && g >= 35) { best = g; gap = { lo: discs[i - 1].distance, hi: discs[i].distance }; } }
  const minD = discs.length ? discs[0].distance : 0, maxD = discs.length ? discs[discs.length - 1].distance : 0;
  return { discs, gap, minD, maxD };
}

// ==== 3. Hole by hole — avg score-to-par per hole at the most-played course ====
export interface HoleAvg { hole: number; par: number; avgRel: number; n: number }
export interface HoleByHole { courseName: string; holes: HoleAvg[]; worst: HoleAvg | null; best: HoleAvg | null }
export function holeByHole(rounds: DecodedRound[]): HoleByHole | null {
  const byCourse = new Map<string, DecodedRound[]>();
  for (const r of rounds) { if (!r.isComplete) continue; const k = r.courseName.trim(); if (!k) continue; (byCourse.get(k) ?? byCourse.set(k, []).get(k)!).push(r); }
  let best: { name: string; rounds: DecodedRound[] } | null = null;
  for (const [name, rs] of byCourse) if (rs.length >= 2 && (!best || rs.length > best.rounds.length)) best = { name, rounds: rs };
  if (!best) return null;
  const acc = new Map<number, { relSum: number; n: number; par: number }>();
  for (const r of best.rounds) for (const h of r.holes) { if (!h.played) continue; const e = acc.get(h.holeNumber) ?? { relSum: 0, n: 0, par: h.par }; e.relSum += h.score - h.par; e.n++; e.par = h.par; acc.set(h.holeNumber, e); }
  const holes = [...acc.entries()].map(([hole, e]) => ({ hole, par: e.par, avgRel: e.relSum / e.n, n: e.n })).sort((a, b) => a.hole - b.hole);
  if (!holes.length) return null;
  const worst = holes.reduce((m, h) => (h.avgRel > m.avgRel ? h : m), holes[0]);
  const bestHole = holes.reduce((m, h) => (h.avgRel < m.avgRel ? h : m), holes[0]);
  return { courseName: best.name, holes, worst, best: bestHole };
}

// ==== 4. Cumulative strokes gained for one round ====
export interface RoundSG { perHole: { hole: number; sg: number }[]; cumulative: { hole: number; val: number }[]; worst: { hole: number; sg: number }; total: number }
export function roundStrokesGained(round: DecodedRound): RoundSG | null {
  const perHole: { hole: number; sg: number }[] = [];
  for (const h of round.holes) {
    if (!h.played) continue;
    const logs = h.throws.filter((t) => t.discName !== "Score" && t.distanceToBasket != null);
    let holeSG = 0, contributed = false;
    logs.forEach((log, i) => {
      const prev = logs[i - 1], next = logs[i + 1];
      const legacy = legacyLandingRow(log);
      let startD: number;
      if (legacy) { if (i > 0 && prev && legacyLandingRow(prev) && prev.distanceToBasket != null) startD = prev.distanceToBasket; else return; }
      else if (log.distanceToBasket != null) startD = log.distanceToBasket; else return;
      let endD: number | null = null;
      if (log.madeIt || log.result === "Basket") endD = 0;
      else if (legacy) endD = log.distanceToBasket ?? null;
      else if (next && next.distanceToBasket != null && !legacyLandingRow(next)) endD = next.distanceToBasket;
      else if (log.landLat != null && log.landLng != null && log.targetLat != null && log.targetLng != null) endD = Math.round(haversineFt({ lat: log.landLat, lng: log.landLng }, { lat: log.targetLat, lng: log.targetLng }));
      if (endD != null) { const cost = log.result === "OB" ? 2 : 1; holeSG += expectedStrokes(startD) - cost - expectedStrokes(endD); contributed = true; }
    });
    if (contributed) perHole.push({ hole: h.holeNumber, sg: holeSG });
  }
  if (perHole.length < 3) return null;
  let acc = 0; const cumulative = perHole.map((p) => { acc += p.sg; return { hole: p.hole, val: acc }; });
  const worst = perHole.reduce((m, p) => (p.sg < m.sg ? p : m), perHole[0]);
  return { perHole, cumulative, worst, total: acc };
}
export function latestSGRound(rounds: DecodedRound[]): { round: DecodedRound; sg: RoundSG } | null {
  const sorted = [...rounds].filter((r) => r.isComplete).sort((a, b) => b.date - a.date);
  for (const r of sorted) { const sg = roundStrokesGained(r); if (sg) return { round: r, sg }; }
  return null;
}

// ==== 5. Putt green — every putt by distance + made/miss + miss direction ====
export interface PuttPoint { distance: number; made: boolean; angle: number }
export interface PuttGreen { points: PuttPoint[]; total: number; c1Made: number; c1Att: number; c2Made: number; c2Att: number }
export function puttGreen(rounds: DecodedRound[], putterNames: Set<string>): PuttGreen {
  const pts: PuttPoint[] = [];
  let c1Made = 0, c1Att = 0, c2Made = 0, c2Att = 0, idx = 0;
  for (const r of rounds) {
    if (!r.isComplete) continue;
    for (const h of r.holes) {
      if (!h.played) continue;
      const logs = h.throws.filter((t) => t.discName !== "Score" && t.distanceToBasket != null);
      logs.forEach((log) => {
        const startD = log.distanceToBasket;
        if (startD == null || startD > 66 || log.lie === "tee") return;
        const lie = log.lie ?? "";
        const isPutt = lie.startsWith("putt") || lie === "tap-in" || (log.lat == null && (log.distance ?? 0) === 0 && (log.result === "Basket" || log.result === "Miss Left")) || putterNames.has(log.discName);
        if (!isPutt || startD < 15) return; // C1X+ makeable putts (skip tap-ins) to match the green plot
        const made = Boolean(log.madeIt) || log.result === "Basket";
        if (startD < 34) { c1Att++; if (made) c1Made++; } else { c2Att++; if (made) c2Made++; }
        // angle: use the tapped miss position when present, else spread by index
        let angle: number;
        if (!made && log.missX != null && log.missY != null) angle = Math.atan2(log.missY - 0.5, log.missX - 0.5);
        else angle = idx * 2.399963; // golden angle
        idx++;
        pts.push({ distance: startD, made, angle });
      });
    }
  }
  return { points: pts, total: pts.length, c1Made, c1Att, c2Made, c2Att };
}
