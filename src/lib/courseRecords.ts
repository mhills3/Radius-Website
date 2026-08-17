import { type CourseScore } from "./courses";
import { getCourseRoundsForUser } from "./rounds";
import { resolveCanonicalId } from "./account";

export interface AceRecord { player: string; username?: string; uid: string; hole: number; date: number; }
export interface DriveRecord { player: string; username?: string; uid: string; hole: number; distance: number; }
export interface CourseRecords { aces: AceRecord[]; drives: DriveRecord[]; loaded: boolean; }

/**
 * Course records (aces + long drives) are not stored — they're derived from each leaderboard
 * player's submitted rounds (decode the throws). Best scores already live in the scores subcollection.
 */
export async function getCourseRecords(courseName: string, scores: CourseScore[]): Promise<CourseRecords> {
  // One leaderboard row per raw uid first…
  const byUid = new Map<string, CourseScore & { playerUid: string }>();
  for (const s of scores) if (s.playerUid && !byUid.has(s.playerUid)) byUid.set(s.playerUid, s as CourseScore & { playerUid: string });

  // …then collapse ALIAS ACCOUNTS to one canonical person. A player's linked logins (e.g. Brady's two
  // accounts) resolve to the same rounds, so counting each separately double-listed the same aces/drives.
  const canonOf = new Map<string, string>();
  await Promise.all([...byUid.keys()].map(async (uid) => { canonOf.set(uid, await resolveCanonicalId(uid).catch(() => uid)); }));
  const byCanon = new Map<string, CourseScore & { playerUid: string }>();
  for (const [uid, s] of byUid) {
    const canon = canonOf.get(uid) || uid;
    const cur = byCanon.get(canon);
    // keep the best-labelled account for display (one with a username/handle)
    if (!cur || (!(cur.username || cur.playerHandle) && (s.username || s.playerHandle))) byCanon.set(canon, s);
  }
  const players = [...byCanon.values()].slice(0, 14); // one row per real person

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
            // Sanity guard: no real course drive exceeds ~800 ft — anything beyond is bad data.
            if (d > 0 && d <= 800) {
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
