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
  timestamp?: number;      // ms epoch — round duration in "How it went"
  lat?: number; lng?: number;          // GPS release (detailed-mode rounds only) — flight map
  targetLat?: number; targetLng?: number; // basket at throw — flight map
  landLat?: number; landLng?: number;      // landing — flight map
  lie?: string;
  missZone?: string;       // putt-miss 3×3 zone e.g. "high-left"
  missX?: number; missY?: number;      // exact normalized putt-miss tap (0..1)
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

export function computeRoundStats(round: DecodedRound, putterNames: Set<string> = new Set()): RoundStats {
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

  // Green in regulation — iOS Round.greenHitRate: a hole "hits" when the player reaches a putt lie
  // (<=66 ft) with strokes-before-first-putt <= par-2 (or an under-par throw-in). strokes counts every
  // log incl. "Score" placeholders, exactly like iOS.
  let girEligible = 0, girHits = 0;
  for (const h of played) {
    const logs = h.throws;
    if (!logs.some((l) => l.discName !== "Score" || l.lie === "tap-in")) continue;
    let strokesBeforeFirstPutt: number | null = null, strokes = 0, prevDtb: number | null = null;
    for (const log of logs) {
      const dtb = log.distanceToBasket;
      const isPutt =
        log.lie === "putt-c1" || log.lie === "putt-c2" || log.lie === "tap-in" ||
        (putterNames.has(log.discName) && dtb != null && dtb <= 66) ||
        (log.lat != null && log.lie == null && dtb != null && dtb <= 66) ||
        (log.lat == null && log.discName !== "Score" && prevDtb != null && prevDtb <= 66);
      if (isPutt && strokesBeforeFirstPutt == null) strokesBeforeFirstPutt = strokes;
      strokes++;
      if (log.discName !== "Score") prevDtb = dtb ?? null;
    }
    girEligible++;
    if (strokesBeforeFirstPutt != null) { if (strokesBeforeFirstPutt <= h.par - 2) girHits++; }
    else if (h.score > 0 && h.score <= h.par - 1) girHits++;
  }
  const greenHitPct = girEligible === 0 ? null : girHits / girEligible;

  // Scramble: holes with a miss/OB throw that still scored par-or-better. No trouble = 0.5.
  const relByHole = new Map(played.map((h) => [h.holeNumber, h.score - h.par]));
  const trouble = [...byHole.entries()].filter(([, arr]) => arr.some((x) => isMissKey(x.key) || x.key === "OB")).map(([h]) => h);
  const scramblePct = n === 0 ? null : trouble.length === 0 ? 0.5 : trouble.filter((h) => (relByHole.get(h) ?? 1) <= 0).length / trouble.length;

  // C1 (<=33 ft) / C2 (34–66 ft) putting — iOS Round.puttTally. Classify each real throw as a putt by:
  // (a) a putting-putter disc + its distance, (b) an explicit putt/tap-in lie, (c) a GPS release
  // distance, or (d) the previous throw's landing distance (when the current log has no GPS). This is
  // NOT "every throw within 33 ft" — approach shots that land close are excluded. A make = madeIt.
  let c1m = 0, c1a = 0, c2m = 0, c2a = 0;
  for (const h of played) {
    let prevRealDtb: number | null = null, prevRealPutter = false;
    for (const cur of h.throws) {
      if (cur.discName === "Score") continue;
      const dtb = cur.distanceToBasket;
      let ring: "c1" | "c2" | null = null;
      if (putterNames.has(cur.discName) && dtb != null) {
        ring = dtb <= 33 ? "c1" : dtb <= 66 ? "c2" : null;
      } else if (cur.lie === "putt-c1" || cur.lie === "tap-in") {
        ring = "c1";
      } else if (cur.lie === "putt-c2") {
        ring = "c2";
      } else if (cur.lat != null && cur.lie == null && dtb != null) {
        ring = dtb <= 33 ? "c1" : dtb <= 66 ? "c2" : null;
      } else if (cur.lat == null && prevRealDtb != null && !prevRealPutter) {
        ring = prevRealDtb <= 33 ? "c1" : prevRealDtb <= 66 ? "c2" : null;
      }
      if (ring === "c1") { c1a++; if (cur.madeIt) c1m++; }
      else if (ring === "c2") { c2a++; if (cur.madeIt) c2m++; }
      prevRealDtb = dtb ?? null;
      prevRealPutter = putterNames.has(cur.discName);
    }
  }
  const c1Pct = c1a === 0 ? null : c1m / c1a;
  const c2Pct = c2a === 0 ? null : c2m / c2a;

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
  teeAttempts: number;          // tee shots counted (iOS teeAttempts)
  teeObPct: number | null;      // OB % among tee shots only, 0..100 int
  scramblePct: number | null;
  scrambleOpps: number;         // holes with a miss/OB throw (iOS scrambleOpps)
  c1: { made: number; att: number; pct: number | null };
  c2: { made: number; att: number; pct: number | null };
  birdies: number; pars: number; bogeys: number; doublePlus: number;
  avgDriveFt: number | null;
  missLeft: number; missRight: number;
  discs: { name: string; count: number; quality: number }[];
  scoreTrend: { date: number; toPar: number }[]; // chronological, one point per complete round
}

// iOS ShotInsightsSummary putt-band tally (RecommendationEngine, re-cut 2026-08-09 + reconciled
// 2026-08-12). C1X = bands 1+2 (15–33 ft), C2 = band 3 (33–66 ft). The 2026-08-12 fix: a "legacy
// landing" row (no GPS, empty lie, distance 0, result Circle 1/2) stores its LANDING bucket in
// distanceToBasket (C1→20, C2→50), NOT a putt start — reading it as a start manufactured fake missed
// 20/50-ft putts that collapsed C1X (the "iOS 48% artifact"). Such rows are dropped from the tally
// (unless the previous row is itself a legacy landing, which then supplies the real start). Also drops
// a hole's first row when it's a made basket stamped dtb=15 with no GPS (a throw-in, not a 15-ft putt).
function puttBandTally(round: DecodedRound, putterNames: Set<string>): { c1m: number; c1a: number; c2m: number; c2a: number } {
  let c1m = 0, c1a = 0, c2m = 0, c2a = 0;
  const isLegacyLanding = (t: DecodedThrow) =>
    t.lat == null && !(t.lie ?? "") && (t.distance ?? 0) === 0 && (t.result === "Circle 1" || t.result === "Circle 2");
  for (const h of round.holes) {
    if (!h.played) continue;
    const logs = h.throws.filter((t) => t.discName !== "Score" && t.distanceToBasket != null);
    logs.forEach((log, i) => {
      const prev = logs[i - 1];
      const legacy = isLegacyLanding(log);
      let startD: number;
      if (legacy) {
        if (i > 0 && prev && isLegacyLanding(prev) && prev.distanceToBasket != null) startD = prev.distanceToBasket;
        else return; // legacy landing → not a putt start
      } else if (log.distanceToBasket != null) {
        startD = log.distanceToBasket;
      } else return;

      const lieStamp = log.lie ?? "";
      const isTee = lieStamp === "tee";
      const stampedPutt = lieStamp.startsWith("putt") || lieStamp === "tap-in";
      const standardPutt = log.lat == null && (log.distance ?? 0) === 0 && (log.result === "Basket" || log.result === "Miss Left");
      const isPutt = startD <= 66 && !isTee && (stampedPutt || standardPutt || putterNames.has(log.discName));
      if (!isPutt) return;

      const fabricatedThrowIn = i === 0 && log.result === "Basket" && log.distanceToBasket === 15 && log.lat == null;
      if (fabricatedThrowIn) return;

      let puttStart = startD;
      if (puttStart === 0 && lieStamp !== "tap-in" && i > 0 && prev && isLegacyLanding(prev) && prev.distanceToBasket != null) puttStart = prev.distanceToBasket;

      const made = Boolean(log.madeIt) || log.result === "Basket";
      const bandIdx = puttStart < 15 ? 0 : puttStart < 22 ? 1 : puttStart < 33 ? 2 : 3;
      if (bandIdx === 1 || bandIdx === 2) { c1a++; if (made) c1m++; }
      else if (bandIdx === 3) { c2a++; if (made) c2m++; }
    });
  }
  return { c1m, c1a, c2m, c2a };
}

// ---- Strokes-gained engine — exact port of iOS ShotInsightsSummary.compute (RecommendationEngine) ----
// Powers the "Where the strokes go" leak ranking: each shot's strokes gained = E(start) − cost − E(end)
// against a baseline expected-strokes table; per-category totals ÷ contributing rounds. Lowest = leak.
export interface StrokesGained {
  sgDriving: number; sgApproach: number; sgShort: number; sgPutting: number; sgRounds: number;
  teeAttempts: number; teeFairwayPct: number; teeObPct: number;
  driveAvg: number; driveCount: number; driveMin: number; driveMax: number;
  approachCount: number; proximityAvgFt: number; shortCount: number;
  scrambleOpps: number; scrambled: number; scramblePct: number;
  puttAttemptsTotal: number; c1xPct: number; c1xTrend: number[];
  roundsWithShotData: number;
  puttBands: PuttBand[];        // 4 bands: 0–15 / 15–22 / 22–33 / C2
  proxBands: ProxBand[];        // 67–100 / 100–150 / 150–200 / 200–300 ft
  teeDiscs: DiscStat[];         // avg = tee-shot distance
  approachDiscs: DiscStat[];    // avg = leave distance
  missZones: Record<string, number>; // putt-miss zone counts (e.g. "high-left")
}
export interface PuttBand { label: string; made: number; attempts: number }
export interface ProxBand { label: string; count: number; avg: number }
export interface DiscStat { name: string; count: number; avg: number; inPlayPct?: number }
export interface RankedCategory { id: string; name: string; evidence: string; sg: number; eligible: boolean; progress: string }

const legacyLandingRow = (t: DecodedThrow) =>
  t.lat == null && !(t.lie ?? "") && (t.distance ?? 0) === 0 && (t.result === "Circle 1" || t.result === "Circle 2");

// iOS RecommendationEngine.expectedStrokes(fromFeet:) — baseline expected strokes by feet-to-basket.
function expectedStrokes(d: number): number {
  if (d < 1) return 0; if (d < 9) return 1.02; if (d < 16) return 1.15; if (d < 23) return 1.35;
  if (d < 34) return 1.55; if (d < 51) return 1.80; if (d < 67) return 1.95; if (d < 101) return 2.20;
  if (d < 151) return 2.45; if (d < 201) return 2.65; if (d < 251) return 2.85; if (d < 301) return 3.00;
  if (d < 351) return 3.15; if (d < 401) return 3.30; return 3.30 + (d - 400) / 250;
}
function haversineFt(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3.28084;
}

export function computeStrokesGained(rounds: DecodedRound[], putterNames: Set<string> = new Set()): StrokesGained {
  const complete = rounds.filter((r) => r.isComplete);
  let sgD = 0, sgA = 0, sgS = 0, sgP = 0, sgRounds = 0;
  let teeAttempts = 0, teeOB = 0, teeFairway = 0, driveTotal = 0, driveCount = 0, driveLong = 0, driveShort = 0;
  let approachCount = 0, proximityTotal = 0, shortCount = 0;
  let scrambleOpps = 0, scrambled = 0;
  let puttAtt = 0, c1xMade = 0, c1xAtt = 0;
  const c1xTrend: number[] = [];
  const bandMade = [0, 0, 0, 0], bandAtt = [0, 0, 0, 0];
  const PROX_BANDS = [[67, 100], [100, 150], [150, 200], [200, 300]];
  const proxSum = [0, 0, 0, 0], proxCnt = [0, 0, 0, 0];
  const teeDiscMap = new Map<string, { dist: number; count: number; inPlay: number; distCount: number }>();
  const apDiscMap = new Map<string, { leave: number; count: number }>();
  const missZones: Record<string, number> = {};

  // rounds are chronological (oldest first) so the trend reads left→right
  for (const r of [...complete].sort((a, b) => a.date - b.date)) {
    let roundContributedSG = false;
    let roundC1xMade = 0, roundC1xAtt = 0;
    for (const h of r.holes.filter((x) => x.played)) {
      const rawThrows = h.throws.filter((t) => t.discName !== "Score");
      // Scramble: trouble off the first real throw, saved to par-or-better.
      if (rawThrows[0] && h.score > 0) {
        const tee = rawThrows[0];
        if (tee.result === "OB" || tee.result === "Miss Left" || tee.result === "Miss Right") {
          scrambleOpps++; if (h.score - h.par <= 0) scrambled++;
        }
      }
      // Tee counters (fairway/OB/drive distance).
      rawThrows.forEach((log, i) => {
        const isTeeShot = log.lie === "tee" || (log.lie == null && i === 0);
        if (!isTeeShot) return;
        teeAttempts++;
        const inPlay = log.result === "Fairway" || log.result === "Circle 1" || log.result === "Circle 2" || log.result === "Basket";
        if (log.result === "OB") teeOB++;
        if (log.result === "Fairway" || log.result === "Circle 1" || log.result === "Circle 2") teeFairway++;
        const dn = log.discName || "Unknown";
        const td = teeDiscMap.get(dn) ?? { dist: 0, count: 0, inPlay: 0, distCount: 0 };
        td.count++; if (inPlay) td.inPlay++;
        if ((log.distance ?? 0) >= 100) { const d = log.distance!; driveTotal += d; driveCount++; driveLong = Math.max(driveLong, d); driveShort = driveShort === 0 ? d : Math.min(driveShort, d); td.dist += d; td.distCount++; }
        teeDiscMap.set(dn, td);
      });
      // DTB chain — strokes gained, proximity, putt bands.
      const logs = h.throws.filter((t) => t.discName !== "Score" && t.distanceToBasket != null);
      logs.forEach((log, i) => {
        const prev = logs[i - 1], next = logs[i + 1];
        const legacy = legacyLandingRow(log);
        let startD: number;
        if (legacy) {
          if (i > 0 && prev && legacyLandingRow(prev) && prev.distanceToBasket != null) startD = prev.distanceToBasket;
          else return;
        } else if (log.distanceToBasket != null) startD = log.distanceToBasket;
        else return;

        let endD: number | null = null;
        if (log.madeIt || log.result === "Basket") endD = 0;
        else if (legacy) endD = log.distanceToBasket ?? null;
        else if (next && next.distanceToBasket != null && !legacyLandingRow(next)) endD = next.distanceToBasket;
        else if (log.landLat != null && log.landLng != null && log.targetLat != null && log.targetLng != null) endD = Math.round(haversineFt(log.landLat, log.landLng, log.targetLat, log.targetLng));

        const isTee = log.lie === "tee";
        const lieStamp = log.lie ?? "";
        const stampedPutt = lieStamp.startsWith("putt") || lieStamp === "tap-in";
        const standardPutt = log.lat == null && (log.distance ?? 0) === 0 && (log.result === "Basket" || log.result === "Miss Left");
        const isPutt = startD <= 66 && !isTee && (stampedPutt || standardPutt || putterNames.has(log.discName));
        const isShort = !isTee && !isPutt && startD <= 150;
        if (isShort) shortCount++;

        if (isPutt) {
          const fabricatedThrowIn = i === 0 && log.result === "Basket" && log.distanceToBasket === 15 && log.lat == null;
          if (!fabricatedThrowIn) {
            let puttStart = startD;
            if (puttStart === 0 && lieStamp !== "tap-in" && i > 0 && prev && legacyLandingRow(prev) && prev.distanceToBasket != null) puttStart = prev.distanceToBasket;
            const bandIdx = puttStart < 15 ? 0 : puttStart < 22 ? 1 : puttStart < 33 ? 2 : 3;
            const made = Boolean(log.madeIt) || log.result === "Basket";
            puttAtt++;
            bandAtt[bandIdx]++; if (made) bandMade[bandIdx]++;
            if (!made && log.missZone) missZones[log.missZone] = (missZones[log.missZone] ?? 0) + 1;
            if (bandIdx === 1 || bandIdx === 2) { c1xAtt++; roundC1xAtt++; if (made) { c1xMade++; roundC1xMade++; } }
          }
        }

        if (!isTee && !isPutt && startD <= 300 && endD != null && endD <= 66) {
          proximityTotal += endD; approachCount++;
          const bi = PROX_BANDS.findIndex(([lo, hi]) => startD >= lo && startD < hi);
          if (bi >= 0) { proxSum[bi] += endD; proxCnt[bi]++; }
          const dn = log.discName || "Unknown";
          const ad = apDiscMap.get(dn) ?? { leave: 0, count: 0 };
          ad.leave += endD; ad.count++; apDiscMap.set(dn, ad);
        }

        if (endD != null) {
          const cost = log.result === "OB" ? 2 : 1;
          const sg = expectedStrokes(startD) - cost - expectedStrokes(endD);
          roundContributedSG = true;
          if (isPutt) sgP += sg; else if (isTee) sgD += sg; else if (isShort) sgS += sg; else sgA += sg;
        }
      });
    }
    if (roundContributedSG) sgRounds++;
    if (roundC1xAtt >= 4) c1xTrend.push(roundC1xMade / roundC1xAtt);
  }

  return {
    sgDriving: sgRounds ? sgD / sgRounds : 0,
    sgApproach: sgRounds ? sgA / sgRounds : 0,
    sgShort: sgRounds ? sgS / sgRounds : 0,
    sgPutting: sgRounds ? sgP / sgRounds : 0,
    sgRounds,
    teeAttempts,
    teeFairwayPct: teeAttempts ? Math.floor((teeFairway * 100) / teeAttempts) : 0,
    teeObPct: teeAttempts ? Math.floor((teeOB * 100) / teeAttempts) : 0,
    driveAvg: driveCount ? Math.floor(driveTotal / driveCount) : 0,
    driveCount, driveMin: driveShort, driveMax: driveLong, c1xTrend,
    approachCount,
    proximityAvgFt: approachCount ? Math.floor(proximityTotal / approachCount) : 0,
    shortCount,
    scrambleOpps, scrambled,
    scramblePct: scrambleOpps ? Math.round((scrambled / scrambleOpps) * 100) : 0,
    puttAttemptsTotal: puttAtt,
    c1xPct: c1xAtt ? Math.round((c1xMade / c1xAtt) * 100) : 0,
    roundsWithShotData: sgRounds,
    puttBands: ["0–15", "15–22", "22–33", "C2"].map((label, i) => ({ label, made: bandMade[i], attempts: bandAtt[i] })),
    proxBands: ["67–100 ft", "100–150 ft", "150–200 ft", "200–300 ft"].map((label, i) => ({ label, count: proxCnt[i], avg: proxCnt[i] ? Math.round(proxSum[i] / proxCnt[i]) : 0 })),
    teeDiscs: [...teeDiscMap.entries()].map(([name, d]) => ({ name, count: d.count, avg: d.distCount ? Math.round(d.dist / d.distCount) : 0, inPlayPct: d.count ? Math.round((d.inPlay / d.count) * 100) : 0 })).sort((a, b) => b.count - a.count),
    approachDiscs: [...apDiscMap.entries()].map(([name, d]) => ({ name, count: d.count, avg: d.count ? Math.round(d.leave / d.count) : 0 })).sort((a, b) => b.count - a.count),
    missZones,
  };
}

/** iOS rankedCategories: four categories, worst (lowest strokes-gained) first among the eligible
 *  ones, then the ineligible ones appended. Eligibility gates by sample size. */
export function rankedCategories(s: StrokesGained): RankedCategory[] {
  const cats: RankedCategory[] = [
    { id: "tee", name: "Off the tee", evidence: `${s.teeFairwayPct}% fairway · ${s.teeObPct}% OB · ${s.driveAvg} ft avg`, sg: s.sgDriving, eligible: s.teeAttempts >= 10, progress: `${s.teeAttempts}/10 tee shots measured` },
    { id: "approach", name: "Approach", evidence: `${s.proximityAvgFt} ft average leave`, sg: s.sgApproach, eligible: s.approachCount >= 10, progress: `${s.approachCount}/10 approach shots measured` },
    { id: "short", name: "Around the green", evidence: `${s.scramblePct}% scramble · ${s.scrambled} of ${s.scrambleOpps} saved`, sg: s.sgShort, eligible: s.shortCount >= 10, progress: `${s.shortCount}/10 shots measured` },
    { id: "putting", name: "Putting", evidence: `${s.c1xPct}% C1X · ${s.puttAttemptsTotal} putts`, sg: s.sgPutting, eligible: s.puttAttemptsTotal >= 20, progress: `${s.puttAttemptsTotal}/20 putts recorded` },
  ];
  return [...cats.filter((c) => c.eligible).sort((a, b) => a.sg - b.sg), ...cats.filter((c) => !c.eligible)];
}

/** Aggregate the per-round metrics across all complete rounds — attempt-weighted from raw throws so
 *  career percentages are exact (not an average of per-round percentages). */
export function computeCareerStats(rounds: DecodedRound[], putterNames: Set<string> = new Set()): CareerStats {
  const complete = rounds.filter((r) => r.isComplete);
  const successOf = (key: string) => RESULTS.find((r) => r.key === key)?.success ?? 40;
  let throws = 0, qSum = 0, holes = 0;
  let teeCount = 0, fairwayHits = 0, ob = 0, teeOb = 0;
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
          if (key === "OB") teeOb++;
          if (typeof t.distance === "number" && t.distance > 0) { driveSum += t.distance; driveN++; }
        }
        if (key === "OB") ob++;
        if (isMissKey(key) || key === "OB") hadTrouble = true;
        if (raw === "Miss Left") missLeft++;
        if (raw === "Miss Right") missRight++;
      });
      if (hadTrouble) { troubleHoles++; if (rel <= 0) troubleSaved++; }
    }
    // C1X (15–33 ft) + C2 (33–66 ft) putting — iOS ShotInsightsSummary putt bands, incl. the 2026-08-12
    // legacy-landing reconciliation (fixes the "iOS 48% was the artifact" bug).
    const tb = puttBandTally(r, putterNames);
    c1m += tb.c1m; c1a += tb.c1a; c2m += tb.c2m; c2a += tb.c2a;
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
    teeAttempts: teeCount,
    teeObPct: teeCount ? Math.round((teeOb / teeCount) * 100) : null,
    scramblePct: troubleHoles ? troubleSaved / troubleHoles : null,
    scrambleOpps: troubleHoles,
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
          throws: tlogs.map((t) => {
            const num = (v: unknown) => (typeof v === "number" ? v : undefined);
            return {
              result: (t.result as string) ?? "Fairway",
              discName: (t.discName as string) ?? "",
              distance: num(t.distance),
              distanceToBasket: num(t.distanceToBasket),
              madeIt: Boolean(t.madeIt),
              shotType: (t.shotType as string) ?? undefined,
              timestamp: t.timestamp != null ? normEpoch(t.timestamp, 0) || undefined : undefined,
              lat: num(t.lat), lng: num(t.lng),
              targetLat: num(t.targetLat), targetLng: num(t.targetLng),
              landLat: num(t.landLat), landLng: num(t.landLng),
              lie: (t.lie as string) ?? undefined,
              missZone: (t.missZone as string) ?? undefined,
              missX: num(t.missX), missY: num(t.missY),
            };
          }),
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
