import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";
import { resolveCanonicalId } from "./account";

export interface DecodedThrow {
  result: string;
  discName: string;
  distance?: number;
  distanceToBasket?: number;
  madeIt?: boolean;
  shotType?: string;
}
export interface DecodedHole {
  holeNumber: number;
  par: number;
  distance: number;
  score: number; // throws + OB penalties
  played: boolean;
  throws: DecodedThrow[];
}
export interface DecodedRound {
  roundId: string;
  courseName: string;
  date: number;
  isComplete: boolean;
  holes: DecodedHole[];
  totalPar: number;
  total: number;
  relativeToPar: number;
  holesPlayed: number;
  format?: string;
}

// Throw-result palette (iOS ThrowResult, exact colors).
export const RESULTS: { key: string; label: string; color: string; success: number }[] = [
  { key: "Basket", label: "Made", color: "#1ab859", success: 100 },
  { key: "Circle 1", label: "Circle 1", color: "#33c773", success: 100 },
  { key: "Circle 2", label: "Circle 2", color: "#e8d44d", success: 80 },
  { key: "Fairway", label: "Fairway", color: "#4d94fa", success: 60 },
  { key: "Miss", label: "Miss", color: "#ffa600", success: 40 },
  { key: "OB", label: "OB", color: "#e0473f", success: 0 },
];

function resultKey(raw: string): string {
  if (raw === "Miss Left" || raw === "Miss Right") return "Miss";
  if (raw === "Penalty") return "OB";
  return raw;
}

export interface DiscOutcomes {
  counts: Record<string, number>;
  total: number;
  quality: number; // avg successScore 0..100
}

async function inflate(b64: string, compressed: boolean): Promise<string | null> {
  try {
    const bin = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (!compressed) return new TextDecoder().decode(bytes);
    if (typeof DecompressionStream === "undefined") return null;
    for (const fmt of ["deflate-raw", "deflate"]) {
      try {
        const ds = new DecompressionStream(fmt as "deflate-raw" | "deflate");
        return await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
      } catch {
        /* next */
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Normalize a date to ms: handles ms, unix-seconds, and Swift reference-date seconds (2001 epoch).
export function normEpoch(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : 0;
  if (n > 1e12) return n; // already ms
  if (n > 1e9) return n * 1000; // unix seconds
  if (n > 1e7) return (n + 978307200) * 1000; // Swift secondsSinceReferenceDate (2001)
  return fallback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRound(docId: string, data: any): Promise<DecodedRound | null> {
  const b64 = data?.roundDataBase64 as string | undefined;
  if (!b64) return Promise.resolve(null);
  return inflate(b64, data.isCompressed ?? true).then((text) => {
    if (!text) return null;
    try {
      const j = JSON.parse(text);
      const holesArr = Array.isArray(j.holes) ? j.holes : [];
      let totalPar = 0;
      let total = 0;
      let holesPlayed = 0;
      const holes: DecodedHole[] = holesArr.map((h: Record<string, unknown>, i: number) => {
        const tlogs = Array.isArray(h.throwLogs) ? (h.throwLogs as Record<string, unknown>[]) : [];
        const par = typeof h.par === "number" ? (h.par as number) : 3;
        const ob = tlogs.filter((t) => t.result === "OB").length;
        const score = tlogs.length + ob;
        const played = tlogs.length > 0;
        if (played) {
          totalPar += par;
          total += score;
          holesPlayed++;
        }
        return {
          holeNumber: typeof h.holeNumber === "number" ? (h.holeNumber as number) : i + 1,
          par,
          distance: typeof h.holeDistance === "number" ? (h.holeDistance as number) : 0,
          score,
          played,
          throws: tlogs.map((t) => ({
            result: (t.result as string) ?? "Fairway",
            discName: (t.discName as string) ?? "",
            distance: typeof t.distance === "number" ? (t.distance as number) : undefined,
            distanceToBasket: typeof t.distanceToBasket === "number" ? (t.distanceToBasket as number) : undefined,
            madeIt: Boolean(t.madeIt),
            shotType: (t.shotType as string) ?? undefined,
          })),
        };
      });
      return {
        roundId: (j.id as string) ?? docId,
        courseName: (j.courseName as string) ?? data.courseName ?? "Unknown course",
        date: normEpoch(j.date ?? data.date, normEpoch(data.date, 0)),
        isComplete: Boolean(j.isComplete ?? data.isComplete),
        holes,
        totalPar,
        total,
        relativeToPar: total - totalPar,
        holesPlayed,
        format: (j.scoringFormat as string) ?? undefined,
      };
    } catch {
      return null;
    }
  });
}

async function fetchDecodedRounds(canonicalId: string): Promise<DecodedRound[]> {
  try {
    const rs = await getDocs(collection(db, `userBackups/${canonicalId}/rounds`));
    const decoded = await Promise.all(rs.docs.map((d) => parseRound(d.id, d.data())));
    return decoded.filter((r): r is DecodedRound => !!r).sort((a, b) => b.date - a.date);
  } catch {
    return [];
  }
}

export async function getDecodedRounds(uid: string): Promise<DecodedRound[]> {
  return fetchDecodedRounds(await resolveCanonicalId(uid));
}

export async function getDecodedRoundsForCanonical(canonicalId: string): Promise<DecodedRound[]> {
  return fetchDecodedRounds(canonicalId);
}

export interface RoundMeta {
  roundId?: string;
  date: number;
  courseName: string;
  scoreToPar?: number | null;
  holesPlayed?: number;
}

export interface PlayedStat {
  name: string;
  plays: number;
  best: number | null;
  lastDate: number;
}
/** Courses the user has played → plays, best (complete rounds), last date, keyed by lowercased name. */
export async function getPlayedCourses(uid: string): Promise<Map<string, PlayedStat>> {
  const rounds = await getDecodedRounds(uid).catch(() => []);
  const m = new Map<string, PlayedStat>();
  for (const r of rounds) {
    const key = (r.courseName || "").trim().toLowerCase();
    if (!key || key === "unknown course") continue;
    const cur = m.get(key) || { name: r.courseName, plays: 0, best: null, lastDate: 0 };
    cur.plays++;
    if (r.isComplete && typeof r.relativeToPar === "number") cur.best = cur.best == null ? r.relativeToPar : Math.min(cur.best, r.relativeToPar);
    cur.lastDate = Math.max(cur.lastDate, r.date);
    m.set(key, cur);
  }
  return m;
}

/** The signed-in user's decoded rounds played at a given course (most recent first). */
export async function getCourseRoundsForUser(uid: string, courseName: string): Promise<DecodedRound[]> {
  const all = await getDecodedRounds(uid).catch(() => []);
  const key = courseName.trim().toLowerCase();
  return all.filter((r) => (r.courseName || "").trim().toLowerCase() === key && r.holes.some((h) => h.played));
}

/** Count aces across decoded rounds: a hole holed in a single throw. */
export function countAces(rounds: DecodedRound[]): number {
  let n = 0;
  for (const r of rounds) for (const h of r.holes) {
    if (h.throws.length === 1 && (h.throws[0].result === "Basket" || h.throws[0].madeIt)) n++;
  }
  return n;
}

/** Lightweight: all rounds' date + course (no blob decode) — for heatmaps + course stats. */
export async function getRoundMetaForCanonical(canonicalId: string): Promise<RoundMeta[]> {
  try {
    const rs = await getDocs(collection(db, `userBackups/${canonicalId}/rounds`));
    return rs.docs
      .map((d) => {
        const r = d.data();
        return { date: normEpoch(r.date ?? r.lastUpdated, 0), courseName: (r.courseName as string) || "Unknown course" };
      })
      .filter((m) => m.date > 0)
      .sort((a, b) => a.date - b.date);
  } catch {
    return [];
  }
}

const SKIP_DISCS = new Set(["score", "tap-in", "tap in", ""]);

export function outcomesByDisc(rounds: DecodedRound[]): Map<string, DiscOutcomes> {
  const map = new Map<string, DiscOutcomes>();
  for (const r of rounds) {
    for (const h of r.holes) {
      for (const t of h.throws) {
        const name = t.discName?.trim();
        if (!name || SKIP_DISCS.has(name.toLowerCase())) continue;
        let o = map.get(name);
        if (!o) {
          o = { counts: {}, total: 0, quality: 0 };
          map.set(name, o);
        }
        const key = resultKey(t.result);
        o.counts[key] = (o.counts[key] ?? 0) + 1;
        o.total++;
      }
    }
  }
  for (const o of map.values()) {
    let sum = 0;
    for (const r of RESULTS) sum += (o.counts[r.key] ?? 0) * r.success;
    o.quality = o.total ? Math.round(sum / o.total) : 0;
  }
  return map;
}
