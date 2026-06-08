import { db } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, query, orderBy, limit, where } from "firebase/firestore";
import { rankForIQ } from "./rank";
import { resolveCanonicalId } from "./account";
import { isUSState, countryOf } from "./courses";

/** Whether the user has hidden their public web profile. */
export async function getProfileHidden(uid: string): Promise<boolean> {
  try {
    const cid = await resolveCanonicalId(uid);
    const s = await getDoc(doc(db, "users", cid));
    return s.exists() && s.data().hideWebProfile === true;
  } catch {
    return false;
  }
}
export async function setProfileHidden(uid: string, hidden: boolean): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await setDoc(doc(db, "users", cid), { hideWebProfile: hidden }, { merge: true });
}

function safeHttp(u: unknown): string | undefined {
  return typeof u === "string" && /^https?:\/\//.test(u) ? u : undefined;
}

// A valid public handle must contain at least one alphanumeric char (filters junk like "'" or blanks).
const validHandle = (u?: string) => !!u && /[a-z0-9]/i.test(u);

// Dedupe rows by lowercased username, keeping the first (highest gameIQ, since input is sorted desc).
function dedupeByHandle<T extends { username?: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => { const k = (r.username || "").toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

export interface MentionUser { id: string; name: string; username: string; photo?: string }
let _mentionCache: MentionUser[] | null = null;
/** Users that can be @mentioned — anyone with a username who isn't hiding their profile. Cached per session. */
export async function getMentionableUsers(): Promise<MentionUser[]> {
  if (_mentionCache) return _mentionCache;
  try {
    const snap = await getDocs(query(collection(db, "users"), limit(800)));
    _mentionCache = snap.docs
      .map((d) => { const u = d.data(); return { id: d.id, name: (u.name as string) || "", username: (u.username as string) || "", photo: safeHttp(u.profileImageUrl), hidden: u.hideWebProfile === true }; })
      .filter((u) => u.username && !u.hidden)
      .map(({ id, name, username, photo }) => ({ id, name, username, photo }));
    return _mentionCache;
  } catch {
    return [];
  }
}

/** Direct username → MentionUser lookup (not limited by the cached picker list). */
export async function findUserByUsername(username: string): Promise<MentionUser | null> {
  try {
    const snap = await getDocs(query(collection(db, "users"), where("username", "==", username), limit(1)));
    if (snap.empty) return null;
    const d = snap.docs[0]; const u = d.data();
    if (u.hideWebProfile === true) return null;
    return { id: d.id, name: (u.name as string) || "", username: (u.username as string) || username, photo: safeHttp(u.profileImageUrl) };
  } catch {
    return null;
  }
}

export interface LeaderRow {
  id: string;
  name: string;
  username?: string;
  photo?: string;
  gameIQ: number;
  tier: string;
  color: string;
  level: number;
}

export async function getLeaderboard(max = 60): Promise<LeaderRow[]> {
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy("gameIQ", "desc"), limit(max * 3)));
    const rows = snap.docs
      .map((d) => {
        const u = d.data();
        return { id: d.id, name: (u.name as string) || "", username: (u.username as string) || undefined, photo: safeHttp(u.profileImageUrl), gameIQ: Number(u.gameIQ) || 0, hidden: u.hideWebProfile === true };
      })
      .filter((r) => r.gameIQ > 0 && r.name && !r.hidden && validHandle(r.username));
    return dedupeByHandle(rows).slice(0, max).map((r) => {
      const rk = rankForIQ(r.gameIQ);
      return { id: r.id, name: r.name, username: r.username, photo: r.photo, gameIQ: r.gameIQ, tier: rk.tier, color: rk.color, level: rk.level };
    });
  } catch {
    return [];
  }
}

export interface GeoLeaderRow extends LeaderRow { state?: string; country?: string }

/** Region-aware leaderboard: each player's region is derived from their HOME COURSE's location. */
export async function getLeaderboardWithRegion(max = 250): Promise<GeoLeaderRow[]> {
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy("gameIQ", "desc"), limit(max + 150)));
    const base = snap.docs
      .map((d) => { const u = d.data(); return { id: d.id, name: (u.name as string) || "", username: (u.username as string) || undefined, photo: safeHttp(u.profileImageUrl), gameIQ: Number(u.gameIQ) || 0, hidden: u.hideWebProfile === true, homeCourseId: (u.homeCourseId as string)?.trim() || "" }; })
      .filter((r) => r.gameIQ > 0 && r.name && !r.hidden && validHandle(r.username));
    const deduped = dedupeByHandle(base).slice(0, max);

    // resolve unique home courses → { state, country }
    const ids = [...new Set(deduped.map((r) => r.homeCourseId).filter(Boolean))];
    const regionMap = new Map<string, { state?: string; country?: string }>();
    await Promise.all(ids.map(async (cid) => {
      try {
        const cs = await getDoc(doc(db, "courses", cid));
        if (!cs.exists()) return;
        const c = cs.data();
        const state = isUSState(c.state as string) ? (c.state as string) : undefined;
        const country = countryOf({ state: c.state as string, latitude: c.latitude as number, longitude: c.longitude as number });
        regionMap.set(cid, { state, country });
      } catch { /* skip */ }
    }));

    return deduped.map((r) => {
      const rk = rankForIQ(r.gameIQ);
      const reg = r.homeCourseId ? regionMap.get(r.homeCourseId) : undefined;
      return { id: r.id, name: r.name, username: r.username, photo: r.photo, gameIQ: r.gameIQ, tier: rk.tier, color: rk.color, level: rk.level, state: reg?.state, country: reg?.country };
    });
  } catch {
    return [];
  }
}
