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
  // Insights extras (present on app-written rounds; optional)
  iqBefore?: number;
  iqAfter?: number;
  weatherSummary?: string;
  windSummary?: string;
  temperatureSummary?: string;
}

// Per-round performance stats — EXACT ports of the iOS/Android Round Review card
// (RoundSummarySheet.kt PerformanceSection / iOS Round computed props). "Score"
// pseudo-throws are excluded from every denominator. Percent values are 0..1;
// `null` means "no data → show --" (matches the apps' display gates).
export interface RoundStats {
  throws: number;
  throwQuality: number | null; // 0..100
  fairwayPct: number | null;
  obRate: number | null;
  scramblePct: number | null;
  greenHitPct: number | null;
  c1Pct: number | null;
  c2Pct: number | null;
  birdies: number;
  pars: number;
  bogeys: number;
  doublePlus: number;
  bestHole?: { holeNumber: number; rel: number };
  worstHole?: { holeNumber: number; rel: number };
  discs: { name: string; count: number; quality: number }[];
}

function isMissKey(k: string): boolean {
  return k === "Miss";
}

export function computeRoundStats(round: DecodedRound): RoundStats {
  const played = round.holes.filter((h) => h.played);
  // Flatten throws, excluding "Score" pseudo-throws, tagging each with its hole.
  const all: { t: DecodedThrow; key: string; hole: number }[] = [];
  for (const h of played) {
    for (const t of h.throws) {
      if (t.discName === "Score") continue;
      all.push({ t, key: resultKey(t.result), hole: h.holeNumber });
    }
  }
  const n = all.length;
  const successOf = (key: string) => RESULTS.find((r) => r.key === key)?.success ?? 40;

  // fieldThrows = off-tee/approach (Fairway, Miss/rough, OB)
  const field = all.filter((x) => x.key === "Fairway" || isMissKey(x.key) || x.key === "OB");
  // teeShots = first throw on each hole
  const byHole = new Map<number, typeof all>();
  for (const x of all) {
    const arr = byHole.get(x.hole) ?? [];
    arr.push(x);
    byHole.set(x.hole, arr);
  }
  const tee = [...byHole.values()].map((arr) => arr[0]).filter(Boolean);
  const fairwayHits = tee.filter((x) => ["Fairway", "Circle 1", "Circle 2", "Basket"].includes(x.key)).length;
  const fairwayPct = field.length === 0 ? null : tee.length === 0 ? null : fairwayHits / tee.length;

  const obThrows = all.filter((x) => x.key === "OB").length;
  const obRate = n === 0 ? null : obThrows / n;

  const greenHits = field.filter((x) => ["Basket", "Circle 1", "Circle 2"].includes(x.key)).length;
  const greenHitPct = field.length === 0 ? null : greenHits / field.length;

  // Scramble: holes with a miss/OB throw that still scored par-or-better. No trouble = 0.5.
  const relByHole = new Map(played.map((h) => [h.holeNumber, h.score - h.par]));
  const trouble = [...byHole.entries()].filter(([, arr]) => arr.some((x) => isMissKey(x.key) || x.key === "OB")).map(([h]) => h);
  const scramblePct = n === 0 ? null : trouble.length === 0 ? 0.5 : trouble.filter((h) => (relByHole.get(h) ?? 1) <= 0).length / trouble.length;

  // C1 ≤33ft, C2 34–66ft; "made" via madeIt flag.
  const c1 = all.filter((x) => x.t.distanceToBasket != null && x.t.distanceToBasket <= 33);
  const c2 = all.filter((x) => x.t.distanceToBasket != null && x.t.distanceToBasket >= 34 && x.t.distanceToBasket <= 66);
  const c1Made = c1.filter((x) => x.t.madeIt).length;
  const c2Made = c2.filter((x) => x.t.madeIt).length;
  const c1Pct = c1.length === 0 ? null : c1Made / c1.length;
  const c2Pct = c2.length === 0 ? null : c2Made / c2.length;

  const throwQuality = n === 0 ? null : all.reduce((s, x) => s + successOf(x.key), 0) / n;

  // Score distribution + best/worst
  let birdies = 0, pars = 0, bogeys = 0, doublePlus = 0;
  for (const h of played) {
    const rel = h.score - h.par;
    if (rel < 0) birdies++;
    else if (rel === 0) pars++;
    else if (rel === 1) bogeys++;
    else doublePlus++;
  }
  let bestHole: RoundStats["bestHole"], worstHole: RoundStats["worstHole"];
  if (played.length) {
    const sorted = [...played].sort((a, b) => (a.score - a.par) - (b.score - b.par));
    const b = sorted[0], w = sorted[sorted.length - 1];
    bestHole = { holeNumber: b.holeNumber, rel: b.score - b.par };
    worstHole = { holeNumber: w.holeNumber, rel: w.score - w.par };
  }

  // Discs thrown (excl. Score), with per-disc quality.
  const discMap = new Map<string, { count: number; sum: number }>();
  for (const x of all) {
    const name = x.t.discName || "Unknown";
    const d = discMap.get(name) ?? { count: 0, sum: 0 };
    d.count++;
    d.sum += successOf(x.key);
    discMap.set(name, d);
  }
  const discs = [...discMap.entries()]
    .map(([name, d]) => ({ name, count: d.count, quality: d.count ? d.sum / d.count : 0 }))
    .sort((a, b) => b.count - a.count);

  return {
    throws: n, throwQuality, fairwayPct, obRate, scramblePct, greenHitPct, c1Pct, c2Pct,
    birdies, pars, bogeys, doublePlus, bestHole, worstHole, discs,
  };
}

// ---- Career aggregation (across all rounds) — powers the web "My Game → Overview/Improve" ----
export interface CareerStats {
  rounds: number;          // complete rounds counted
  holes: number;
  throws: number;
  avgToPar: number | null; // mean relativeToPar across rounds
  bestRoundToPar: number | null;
  throwQuality: number | null; // 0..100
  fairwayPct: number | null;
  obRate: number | null;
  scramblePct: number | null;
  c1: { made: number; att: number; pct: number | null };
  c2: { made: number; att: number; pct: number | null };
  birdies: number; pars: number; bogeys: number; doublePlus: number;
  avgDriveFt: number | null;
  missLeft: number; missRight: number;
  discs: { name: string; count: number; quality: number }[];
  scoreTrend: { date: number; toPar: number }[]; // chronological, one point per complete round
}

/** Aggregate the per-round metrics across all complete rounds — attempt-weighted from raw throws so
 *  career percentages are exact (not an average of per-round percentages). */
export function computeCareerStats(rounds: DecodedRound[]): CareerStats {
  const complete = rounds.filter((r) => r.isComplete);
  const successOf = (key: string) => RESULTS.find((r) => r.key === key)?.success ?? 40;
  let throws = 0, qSum = 0, holes = 0;
  let teeCount = 0, fairwayHits = 0, ob = 0;
  let c1m = 0, c1a = 0, c2m = 0, c2a = 0;
  let birdies = 0, pars = 0, bogeys = 0, doublePlus = 0;
  let troubleHoles = 0, troubleSaved = 0;
  let driveSum = 0, driveN = 0, missLeft = 0, missRight = 0;
  const discMap = new Map<string, { count: number; sum: number }>();

  for (const r of complete) {
    for (const h of r.holes.filter((x) => x.played)) {
      holes++;
      const rel = h.score - h.par;
      if (rel < 0) birdies++; else if (rel === 0) pars++; else if (rel === 1) bogeys++; else doublePlus++;
      const holeThrows = h.throws.filter((t) => t.discName !== "Score");
      let hadTrouble = false;
      holeThrows.forEach((t, i) => {
        const raw = t.result;
        const key = resultKey(raw);
        throws++; qSum += successOf(key);
        const name = t.discName || "Unknown";
        const d = discMap.get(name) ?? { count: 0, sum: 0 };
        d.count++; d.sum += successOf(key); discMap.set(name, d);
        if (i === 0) {
          teeCount++;
          if (["Fairway", "Circle 1", "Circle 2", "Basket"].includes(key)) fairwayHits++;
          if (typeof t.distance === "number" && t.distance > 0) { driveSum += t.distance; driveN++; }
        }
        if (key === "OB") ob++;
        if (isMissKey(key) || key === "OB") hadTrouble = true;
        if (raw === "Miss Left") missLeft++;
        if (raw === "Miss Right") missRight++;
        if (t.distanceToBasket != null && t.distanceToBasket <= 33) { c1a++; if (t.madeIt) c1m++; }
        else if (t.distanceToBasket != null && t.distanceToBasket >= 34 && t.distanceToBasket <= 66) { c2a++; if (t.madeIt) c2m++; }
      });
      if (hadTrouble) { troubleHoles++; if (rel <= 0) troubleSaved++; }
    }
  }

  const rels = complete.map((r) => r.relativeToPar);
  const discs = [...discMap.entries()].map(([name, d]) => ({ name, count: d.count, quality: d.count ? d.sum / d.count : 0 })).sort((a, b) => b.count - a.count);
  return {
    rounds: complete.length,
    holes,
    throws,
    avgToPar: rels.length ? rels.reduce((s, x) => s + x, 0) / rels.length : null,
    bestRoundToPar: rels.length ? Math.min(...rels) : null,
    throwQuality: throws ? qSum / throws : null,
    fairwayPct: teeCount ? fairwayHits / teeCount : null,
    obRate: throws ? ob / throws : null,
    scramblePct: troubleHoles ? troubleSaved / troubleHoles : null,
    c1: { made: c1m, att: c1a, pct: c1a ? c1m / c1a : null },
    c2: { made: c2m, att: c2a, pct: c2a ? c2m / c2a : null },
    birdies, pars, bogeys, doublePlus,
    avgDriveFt: driveN ? driveSum / driveN : null,
    missLeft, missRight,
    discs,
    scoreTrend: complete.map((r) => ({ date: r.date, toPar: r.relativeToPar })).sort((a, b) => a.date - b.date),
  };
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
  if (raw === "Miss Left" || raw === "Miss Right" || raw === "Rough") return "Miss";
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
        iqBefore: typeof j.iqBefore === "number" ? (j.iqBefore as number) : undefined,
        iqAfter: typeof j.iqAfter === "number" ? (j.iqAfter as number) : undefined,
        weatherSummary: typeof j.weatherSummary === "string" && j.weatherSummary ? (j.weatherSummary as string) : undefined,
        windSummary: typeof j.windSummary === "string" && j.windSummary ? (j.windSummary as string) : undefined,
        temperatureSummary: typeof j.temperatureSummary === "string" && j.temperatureSummary ? (j.temperatureSummary as string) : undefined,
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

export interface RecentRound { roundId: string; courseName: string; date: number; relativeToPar: number; holesPlayed: number; birdies: number }
/** A user's most recent completed rounds — for the "Share a round" composer picker. */
export async function getRecentRounds(uid: string, max = 12): Promise<RecentRound[]> {
  const rounds = await getDecodedRounds(uid).catch(() => [] as DecodedRound[]);
  return rounds
    .filter((r) => r.isComplete && !!r.courseName)
    .sort((a, b) => b.date - a.date)
    .slice(0, max)
    .map((r) => ({
      roundId: r.roundId,
      courseName: r.courseName,
      date: r.date,
      relativeToPar: r.relativeToPar,
      holesPlayed: r.holesPlayed,
      birdies: r.holes.filter((h) => h.played && h.score > 0 && h.score < h.par).length,
    }));
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
