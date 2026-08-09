import { db } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, query, orderBy, limit, where } from "firebase/firestore";
import { rankForIQ } from "./rank";
import { resolveCanonicalId } from "./account";
import { isUSState, countryOf } from "./courses";

// Set of non-canonical alias account ids (a user with multiple un-unified accounts). User docs
// whose id is an alias are duplicates and must be excluded from rankings so a stale duplicate
// (e.g. an old account with a higher cached Game IQ) doesn't outrank the real, canonical account.
let _aliasIds: Promise<Set<string>> | null = null;
function getAliasIds(): Promise<Set<string>> {
  if (!_aliasIds) {
    _aliasIds = getDocs(collection(db, "canonicalIds"))
      .then((s) => {
        const set = new Set<string>();
        s.forEach((d) => { const c = d.data().canonicalId as string | undefined; if (c && c !== d.id) set.add(d.id); });
        return set;
      })
      .catch(() => new Set<string>());
  }
  return _aliasIds;
}

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

/**
 * Live server-side search for @mention candidates by username OR name prefix. The cached picker list
 * is capped (first N users), so anyone beyond it never showed up locally — this queries Firestore
 * directly so any user is findable. Firestore prefix ranges are case-sensitive and usernames/names
 * are stored as typed, so we try a few case variants (as-is, lowercase, Capitalized) of the input.
 */
export async function searchMentionableUsers(qRaw: string, max = 12): Promise<MentionUser[]> {
  const q = qRaw.trim();
  if (q.length < 2) return [];
  const lower = q.toLowerCase();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const title = lower.replace(/\b\w/g, (c) => c.toUpperCase()); // "nick harshaw" → "Nick Harshaw"
  const variants = [...new Set([q, lower, cap(lower), title])];
  const out = new Map<string, MentionUser>();
  const runPrefix = async (field: "username" | "name", v: string) => {
    try {
      const snap = await getDocs(query(collection(db, "users"), where(field, ">=", v), where(field, "<=", v + ""), orderBy(field), limit(max)));
      snap.docs.forEach((d) => {
        const u = d.data();
        if (u.hideWebProfile === true) return;
        const username = (u.username as string) || "";
        if (!username || out.has(d.id)) return;
        out.set(d.id, { id: d.id, name: (u.name as string) || "", username, photo: safeHttp(u.profileImageUrl) });
      });
    } catch { /* a missing single-field index is unlikely; ignore and rely on other variants */ }
  };
  // Exact username match first (covers the common "I know their handle" case), then prefix scans.
  const exact = await findUserByUsername(q);
  if (exact) out.set(exact.id, exact);
  await Promise.all(variants.flatMap((v) => [runPrefix("username", v), runPrefix("name", v)]));
  return [...out.values()].slice(0, max);
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

export interface ActiveRow { id: string; name: string; username?: string; photo?: string; rounds: number }
/** Most-active players by total rounds logged (roundsPlayed). Powers the "Most active" hero podium. */
export async function getMostActivePlayers(max = 12): Promise<ActiveRow[]> {
  try {
    const [snap, aliases] = await Promise.all([
      getDocs(query(collection(db, "users"), orderBy("roundsPlayed", "desc"), limit(Math.max(max * 3, 40)))),
      getAliasIds(),
    ]);
    const rows = snap.docs
      .filter((d) => !aliases.has(d.id))
      .map((d) => { const u = d.data(); return { id: d.id, name: (u.name as string) || "", username: (u.username as string) || undefined, photo: safeHttp(u.profileImageUrl), rounds: Number(u.roundsPlayed) || 0, hidden: u.hideWebProfile === true }; })
      .filter((r) => r.rounds > 0 && r.name && !r.hidden && validHandle(r.username));
    return dedupeByHandle(rows).slice(0, max).map((r) => ({ id: r.id, name: r.name, username: r.username, photo: r.photo, rounds: r.rounds }));
  } catch {
    return [];
  }
}

export async function getLeaderboard(max = 60): Promise<LeaderRow[]> {
  try {
    const [snap, aliases] = await Promise.all([
      getDocs(query(collection(db, "users"), orderBy("gameIQ", "desc"), limit(Math.max(max * 3, 40)))),
      getAliasIds(),
    ]);
    const rows = snap.docs
      .filter((d) => !aliases.has(d.id)) // drop duplicate alias accounts
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

export interface GeoLeaderRow extends LeaderRow { state?: string; country?: string; lat?: number; lng?: number }

type Region = { state?: string; country?: string; lat?: number; lng?: number };
const regionOfCourse = (c: { state?: string; latitude?: number; longitude?: number }): Region => ({
  state: isUSState(c.state) ? c.state : undefined,
  country: countryOf({ state: c.state, latitude: c.latitude, longitude: c.longitude }),
  lat: typeof c.latitude === "number" ? c.latitude : undefined,
  lng: typeof c.longitude === "number" ? c.longitude : undefined,
});
const hasRegion = (r?: Region) => !!(r && (r.state || r.country));

/**
 * Region-aware leaderboard. A player's region comes from their HOME COURSE; if they haven't set one
 * (most haven't), we fall back to their MOST-PLAYED course (from recentRounds). Without this fallback
 * the State/Country views only showed the handful of players with a home course set.
 */
export async function getLeaderboardWithRegion(max = 250): Promise<GeoLeaderRow[]> {
  try {
    const [snap, aliases] = await Promise.all([
      getDocs(query(collection(db, "users"), orderBy("gameIQ", "desc"), limit(max + 150))),
      getAliasIds(),
    ]);
    const base = snap.docs
      .filter((d) => !aliases.has(d.id)) // drop duplicate alias accounts
      .map((d) => {
        const u = d.data();
        const rounds = Array.isArray(u.recentRounds) ? (u.recentRounds as { courseName?: string }[]) : [];
        const freq = new Map<string, number>();
        for (const r of rounds) { const n = ((r?.courseName || "") + "").trim(); if (n) freq.set(n, (freq.get(n) || 0) + 1); }
        const playedCourse = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
        return { id: d.id, name: (u.name as string) || "", username: (u.username as string) || undefined, photo: safeHttp(u.profileImageUrl), gameIQ: Number(u.gameIQ) || 0, hidden: u.hideWebProfile === true, homeCourseId: (u.homeCourseId as string)?.trim() || "", playedCourse };
      })
      .filter((r) => r.gameIQ > 0 && r.name && !r.hidden && validHandle(r.username));
    const deduped = dedupeByHandle(base).slice(0, max);

    // 1) resolve each player's home course (by id) → region
    const byId = new Map<string, Region>();
    await Promise.all([...new Set(deduped.map((r) => r.homeCourseId).filter(Boolean))].map(async (cid) => {
      try { const cs = await getDoc(doc(db, "courses", cid)); if (cs.exists()) byId.set(cid, regionOfCourse(cs.data() as { state?: string; latitude?: number; longitude?: number })); } catch { /* skip */ }
    }));

    // 2) fallback: for players still unplaced, resolve their most-played course by name → region
    const needName = [...new Set(deduped.filter((r) => !hasRegion(r.homeCourseId ? byId.get(r.homeCourseId) : undefined) && r.playedCourse).map((r) => r.playedCourse))];
    const byName = new Map<string, Region>();
    await Promise.all(needName.map(async (name) => {
      try { const q = await getDocs(query(collection(db, "courses"), where("name", "==", name), limit(1))); const d = q.docs[0]; if (d) byName.set(name, regionOfCourse(d.data() as { state?: string; latitude?: number; longitude?: number })); } catch { /* skip */ }
    }));

    return deduped.map((r) => {
      const rk = rankForIQ(r.gameIQ);
      const homeReg = r.homeCourseId ? byId.get(r.homeCourseId) : undefined;
      const reg = hasRegion(homeReg) ? homeReg : (r.playedCourse ? byName.get(r.playedCourse) : undefined);
      return { id: r.id, name: r.name, username: r.username, photo: r.photo, gameIQ: r.gameIQ, tier: rk.tier, color: rk.color, level: rk.level, state: reg?.state, country: reg?.country, lat: reg?.lat, lng: reg?.lng };
    });
  } catch {
    return [];
  }
}
