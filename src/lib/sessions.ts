import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { resolveCanonicalId } from "./account";

// Practice sessions written by the apps onto users/{uid} as base64-JSON arrays. Read-only on web.
// - rangeSessionsJSON: DrivingRangeSession[]  (id, date, shots[], locationName)
// - puttingSessionsJSON: PuttingSession[]     (id, date, drill, courseName, holeNumber?, putts[])
// - measuredShotsJSON: MeasuredShot[]

function b64ToUtf8(b64: string): string {
  if (typeof atob !== "undefined") { const bin = atob(b64); return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); }
  return Buffer.from(b64, "base64").toString("utf8");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { const a = JSON.parse(v); if (Array.isArray(a)) return a; } catch {}
    try { const a = JSON.parse(b64ToUtf8(v)); if (Array.isArray(a)) return a; } catch {}
  }
  return [];
}
// Swift Date default = seconds since 2001-01-01 (ref). Android may use epoch sec/ms or ISO. Normalize to ms.
const REF = 978307200; // unix seconds at 2001-01-01
function toMs(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) {
    if (v > 1e12) return v;            // epoch ms
    if (v > 1e9) return v * 1000;      // epoch seconds
    if (v > 1e7) return (v + REF) * 1000; // Swift reference-date seconds (2001+)
    return 0;
  }
  if (typeof v === "string") { const t = Date.parse(v); if (!isNaN(t)) return t; }
  return 0;
}
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);

export interface PuttAttempt { distanceFeet: number; made: boolean; timestamp: number }
export interface PuttingSession {
  id: string; date: number; drill: string; courseName: string; holeNumber: number | null;
  putts: PuttAttempt[]; locationName: string;
  attempts: number; makes: number; makePct: number; longestStreak: number;
}
export interface RangeThrow { discName: string; distanceFeet: number; lateralOffsetFeet: number; zone: string; timestamp: number }
export interface PerDisc { disc: string; avgDist: number; avgOffset: number; maxDist: number; count: number }
export interface RangeSession {
  id: string; date: number; locationName: string; shots: RangeThrow[];
  throwCount: number; avgDistance: number; maxDistance: number;
  centerCount: number; leftCount: number; rightCount: number; fairwayPct: number; perDisc: PerDisc[];
}
export interface MeasuredShot { id: string; distance: number; discName: string; courseName: string; holeNumber: number; date: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodePutting(r: any): PuttingSession {
  const putts: PuttAttempt[] = (Array.isArray(r?.putts) ? r.putts : []).map((p: unknown) => { const o = p as Record<string, unknown>; return { distanceFeet: num(o?.distanceFeet), made: !!o?.made, timestamp: toMs(o?.timestamp) }; });
  const attempts = putts.length, makes = putts.filter((p) => p.made).length;
  let streak = 0, best = 0; for (const p of putts) { if (p.made) { streak++; best = Math.max(best, streak); } else streak = 0; }
  return { id: String(r?.id ?? ""), date: toMs(r?.date), drill: String(r?.drill || "Practice"), courseName: String(r?.courseName ?? ""), holeNumber: typeof r?.holeNumber === "number" ? r.holeNumber : null, putts, locationName: String(r?.locationName ?? ""), attempts, makes, makePct: attempts ? makes / attempts : 0, longestStreak: best };
}
const FAIRWAY = new Set(["Center", "Left Fairway", "Right Fairway"]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeRange(r: any): RangeSession {
  const shots: RangeThrow[] = (Array.isArray(r?.shots) ? r.shots : []).map((s: unknown) => { const o = s as Record<string, unknown>; return { discName: String(o?.discName || "Disc"), distanceFeet: num(o?.distanceFeet), lateralOffsetFeet: num(o?.lateralOffsetFeet), zone: String(o?.zone ?? ""), timestamp: toMs(o?.timestamp) }; });
  const n = shots.length;
  const avgDistance = n ? Math.round(shots.reduce((a, s) => a + s.distanceFeet, 0) / n) : 0;
  const maxDistance = n ? Math.round(Math.max(...shots.map((s) => s.distanceFeet))) : 0;
  const z = (name: string) => shots.filter((s) => s.zone === name).length;
  const centerCount = z("Center"), leftCount = z("Left Fairway") + z("Miss Left"), rightCount = z("Right Fairway") + z("Miss Right");
  const fairwayPct = n ? shots.filter((s) => FAIRWAY.has(s.zone)).length / n : 0;
  const m = new Map<string, { dist: number; off: number; max: number; count: number }>();
  for (const s of shots) { const d = m.get(s.discName) ?? { dist: 0, off: 0, max: 0, count: 0 }; d.dist += s.distanceFeet; d.off += s.lateralOffsetFeet; d.max = Math.max(d.max, s.distanceFeet); d.count++; m.set(s.discName, d); }
  const perDisc: PerDisc[] = [...m.entries()].map(([disc, d]) => ({ disc, avgDist: Math.round(d.dist / d.count), avgOffset: Math.round(d.off / d.count), maxDist: Math.round(d.max), count: d.count })).sort((a, b) => b.avgDist - a.avgDist);
  return { id: String(r?.id ?? ""), date: toMs(r?.date), locationName: String(r?.locationName ?? ""), shots, throwCount: n, avgDistance, maxDistance, centerCount, leftCount, rightCount, fairwayPct, perDisc };
}

export interface PracticeSessions { putting: PuttingSession[]; range: RangeSession[]; measured: MeasuredShot[] }

export async function getPracticeSessions(uid: string): Promise<PracticeSessions> {
  const read = async (id: string) => { try { const s = await getDoc(doc(db, "users", id)); return s.exists() ? s.data() : null; } catch { return null; } };
  let d = await read(uid);
  // sessions live under the canonical id — resolve and retry if the raw uid has none
  if (!d || (!d.puttingSessionsJSON && !d.rangeSessionsJSON && !d.measuredShotsJSON)) {
    const cid = await resolveCanonicalId(uid).catch(() => uid);
    if (cid && cid !== uid) { const d2 = await read(cid); if (d2) d = d2; }
  }
  if (!d) return { putting: [], range: [], measured: [] };
  const putting = asArray(d.puttingSessionsJSON).map(decodePutting).filter((s) => s.attempts > 0).sort((a, b) => b.date - a.date);
  const range = asArray(d.rangeSessionsJSON).map(decodeRange).filter((s) => s.throwCount > 0).sort((a, b) => b.date - a.date);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const measured: MeasuredShot[] = asArray(d.measuredShotsJSON).map((m: any) => ({ id: String(m?.id ?? ""), distance: num(m?.distance), discName: String(m?.discName || "Disc"), courseName: String(m?.courseName ?? ""), holeNumber: num(m?.holeNumber), date: toMs(m?.date) })).sort((a, b) => b.date - a.date);
  return { putting, range, measured };
}
