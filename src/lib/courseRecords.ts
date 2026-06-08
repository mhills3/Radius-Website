import { type CourseScore } from "./courses";
import { getCourseRoundsForUser } from "./rounds";

export interface AceRecord { player: string; username?: string; uid: string; hole: number; date: number; }
export interface DriveRecord { player: string; username?: string; uid: string; hole: number; distance: number; }
export interface CourseRecords { aces: AceRecord[]; drives: DriveRecord[]; loaded: boolean; }

/**
 * Course records (aces + long drives) are not stored — they're derived from each leaderboard
 * player's submitted rounds (decode the throws). Best scores already live in the scores subcollection.
 */
export async function getCourseRecords(courseName: string, scores: CourseScore[]): Promise<CourseRecords> {
  // unique players from the leaderboard (cap to keep reads reasonable)
  const seen = new Set<string>();
  const players = scores.filter((s): s is CourseScore & { playerUid: string } => {
    if (!s.playerUid || seen.has(s.playerUid)) return false;
    seen.add(s.playerUid);
    return true;
  }).slice(0, 14);

  const aces: AceRecord[] = [];
  const driveByPlayer = new Map<string, DriveRecord>();

  await Promise.all(players.map(async (p) => {
    try {
      const rounds = await getCourseRoundsForUser(p.playerUid, courseName);
      for (const r of rounds) {
        for (const h of r.holes) {
          if (h.played && h.score === 1) {
            aces.push({ player: p.playerName, username: p.username || p.playerHandle, uid: p.playerUid, hole: h.holeNumber, date: r.date });
          }
          for (const t of h.throws) {
            const d = Math.round(t.distance || 0); // manually-measured throw distance
            if (d > 0) {
              const cur = driveByPlayer.get(p.playerUid);
              if (!cur || d > cur.distance) driveByPlayer.set(p.playerUid, { player: p.playerName, username: p.username || p.playerHandle, uid: p.playerUid, hole: h.holeNumber, distance: d });
            }
          }
        }
      }
    } catch { /* skip a player we can't decode */ }
  }));

  aces.sort((a, b) => b.date - a.date);
  const drives = [...driveByPlayer.values()].sort((a, b) => b.distance - a.distance).slice(0, 5);
  return { aces: aces.slice(0, 6), drives, loaded: true };
}
