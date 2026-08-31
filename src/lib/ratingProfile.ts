// Owner-side Radius Rating compute — the signed-in user's OWN rating, trajectory,
// and per-round ratings, recomputed from their rounds + course geometry (which
// are not mirrored to Firestore; only the single number is). Mirrors iOS
// UserProfile.ratedRounds / ratingTrajectory / radiusRatingInfo.
//
// The authoritative number is still the iOS-mirrored users/{id}.radiusRating —
// use this only to fill the trajectory/cards and as a pre-sync stand-in.

import { getCourseById, type Course } from "./courses";
import type { DecodedRound } from "./rounds";
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

// Identity-first course resolution (iOS courseForRating precedence, courseId lane).
// Rounds with no resolvable courseId still rate via their own hole distances (the
// engine's 285-ft fallback), so name-matching is not required for a number.
async function resolveCourses(rounds: DecodedRound[]): Promise<Map<string, Course>> {
  const ids = [...new Set(rounds.map((r) => r.courseId).filter((x): x is string => !!x))];
  const map = new Map<string, Course>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        const c = await getCourseById(id);
        if (c) map.set(id, c);
      } catch { /* leave unresolved → hole-distance fallback */ }
    })
  );
  return map;
}

export interface RatedRoundPoint { date: number; rating: number; holesPlayed: number }
export interface OwnerRating {
  player: PlayerRating | null;                    // best-8-of-20 number (null under 3 rated)
  trajectory: { t: number; value: number }[];      // rolling rating, oldest→newest
  rated: RatedRoundPoint[];                         // per-round ratings, newest first
}

export async function computeOwnerRating(rounds: DecodedRound[], now = Date.now()): Promise<OwnerRating> {
  // Only rounds in the 24-month pool matter for the number/trajectory; bounds course fetches too.
  const complete = rounds.filter((r) => r.isComplete && r.date >= now - TWO_YEARS_MS);
  const courses = await resolveCourses(complete);

  const rated: RatedRoundPoint[] = complete
    .map((r) => {
      const course = (r.courseId ? courses.get(r.courseId) : undefined) as RatingCourseLike | undefined;
      const rr = rate(toRatingRound(r), course ?? null);
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
