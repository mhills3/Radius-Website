// Owner-side Radius Rating compute — the signed-in user's OWN rating, trajectory,
// and per-round ratings, recomputed from their rounds + course geometry (which
// are not mirrored to Firestore; only the single number is). Mirrors iOS
// UserProfile.ratedRounds / ratingTrajectory / radiusRatingInfo.
//
// The authoritative number is still the iOS-mirrored users/{id}.radiusRating —
// use this only to fill the trajectory/cards and as a pre-sync stand-in.

import { db } from "./firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { getCourseById, docToCourse, type Course } from "./courses";
import { isPlausibleRound, type DecodedRound } from "./rounds";
import {
  rate,
  playerRating,
  type PlayerRating,
  type RatedRound,
  type RatingCourseLike,
  type RatingRoundLike,
} from "./rating";

const TWO_YEARS_MS = 2 * 365.25 * 86_400_000;

function toRatingRound(r: DecodedRound): RatingRoundLike {
  return {
    gameMode: r.gameMode ?? "None",
    layoutId: r.layoutId ?? null,
    holes: r.holes.map((h) => ({ holeNumber: h.holeNumber, score: h.score, holeDistance: h.distance })),
  };
}

const norm = (s: string) => s.trim().toLowerCase();
const hasMappedHole = (c: Course) => c.holes.some((h) => h.distance > 0 || (h.calculatedDistanceFt ?? 0) > 0);

// Identity-first course resolution by courseId (iOS courseForRating id lane).
async function resolveCoursesById(rounds: DecodedRound[]): Promise<Map<string, Course>> {
  const ids = [...new Set(rounds.map((r) => r.courseId).filter((x): x is string => !!x))];
  const map = new Map<string, Course>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const c = await getCourseById(id);
        if (c) map.set(id, c);
      } catch { /* fall through to name / hole-distance fallback */ }
    })
  );
  return map;
}

// Name lane (iOS courseForRating fallback): older rounds carry no courseId, so match by
// course name and — for duplicate names — prefer a candidate whose hole count fits the round
// and that actually has mapped geometry. Without this, unresolved rounds hit the 285-ft prior
// (tighter than a real open course) and inflate the rating.
async function resolveByName(name: string, playedCount: number): Promise<Course | null> {
  try {
    const snap = await getDocs(query(collection(db, "courses"), where("name", "==", name), limit(6)));
    const cands = snap.docs.map((d) => docToCourse(d.id, d.data()));
    if (cands.length <= 1) return cands[0] ?? null;
    return cands.find((c) => c.holeCount === playedCount && hasMappedHole(c)) ?? cands.find(hasMappedHole) ?? cands[0];
  } catch {
    return null;
  }
}

export interface RatedRoundPoint { date: number; rating: number; holesPlayed: number }
export interface OwnerRating {
  player: PlayerRating | null;                    // best-8-of-20 number (null under 3 rated)
  trajectory: { t: number; value: number }[];      // rolling rating, oldest→newest
  rated: RatedRoundPoint[];                         // per-round ratings, newest first
}

export async function computeOwnerRating(rounds: DecodedRound[], now = Date.now()): Promise<OwnerRating> {
  // Only rounds in the 24-month pool matter for the number/trajectory; bounds course fetches too.
  // Implausible rounds (better than 1.5 under/hole — fake/corrupted) never count toward the rating.
  const complete = rounds.filter((r) => r.isComplete && isPlausibleRound(r) && r.date >= now - TWO_YEARS_MS);
  const byId = await resolveCoursesById(complete);

  // Name lane for rounds whose courseId didn't resolve (or is missing).
  const needName = new Map<string, number>(); // normalized name → representative played-hole count
  for (const r of complete) {
    if ((r.courseId && byId.has(r.courseId)) || !r.courseName) continue;
    const key = norm(r.courseName);
    if (!needName.has(key)) needName.set(key, r.holes.filter((h) => h.score > 0).length || 18);
  }
  const byName = new Map<string, Course | null>();
  await Promise.all(
    [...needName.entries()].map(async ([key, played]) => {
      // query with the round's own (untrimmed) name — course docs store the same typed name
      const raw = complete.find((r) => norm(r.courseName) === key)?.courseName ?? key;
      byName.set(key, await resolveByName(raw, played));
    })
  );

  const courseFor = (r: DecodedRound): RatingCourseLike | null =>
    (r.courseId ? byId.get(r.courseId) : undefined) ?? (r.courseName ? byName.get(norm(r.courseName)) ?? null : null);

  const rated: RatedRoundPoint[] = complete
    .map((r) => {
      const rr = rate(toRatingRound(r), courseFor(r));
      return rr ? { date: r.date, rating: rr.rating, holesPlayed: rr.holesPlayed } : null;
    })
    .filter((x): x is RatedRoundPoint => !!x)
    .sort((a, b) => b.date - a.date); // newest first (iOS ratedRounds)

  const player = playerRating(rated.map((p) => ({ rating: p.rating, holesPlayed: p.holesPlayed, date: p.date })), now);

  // Rolling player rating after each rated round, oldest→newest (iOS ratingTrajectory).
  const chron = [...rated].reverse();
  const trajectory: { t: number; value: number }[] = [];
  if (chron.length >= 3) {
    const running: RatedRound[] = chron.slice(0, 2).map((p) => ({ rating: p.rating, holesPlayed: p.holesPlayed, date: p.date }));
    for (let k = 2; k < chron.length; k++) {
      running.push({ rating: chron[k].rating, holesPlayed: chron[k].holesPlayed, date: chron[k].date });
      const pr = playerRating(running, now);
      if (pr) trajectory.push({ t: chron[k].date, value: pr.value });
    }
  }

  return { player, trajectory, rated };
}
