import { db } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteField, query, where, orderBy, limit } from "firebase/firestore";
import { getProfileLite, resolveCanonicalId } from "./account";

// ─────────────────────────────────────────────────────────────────────────────
// Radius Leagues — Firestore schema (Phase 1)
//
//   leagues/{leagueId}                     league identity + cascading defaults
//   leagues/{leagueId}/members/{cid}       membership + role (owner|director|member)
//   leagueEvents/{eventId}                 top-level so app queries stay cheap
//   leagueEvents/{eventId}/entries/{cid}   check-in, division, card, scores
//   leagueEvents/{eventId}/cards/{cardId}  card groupings + start holes
//   leagues/{leagueId}/standings/current   computed season standings doc
//
// Conventions (match the rest of the platform):
//   • All player ids are CANONICAL ids (resolveCanonicalId at every entry point).
//   • Doc ids for leagues/events/cards are uppercase UUIDs (freshId pattern).
//   • Writes are field-scoped setDoc(..., {merge:true}) — never clobber sibling fields.
//   • `leagueEventId` is the RESERVED field name the apps will stamp on published
//     rounds (Phase 2+) so web can auto-attach scores; web schema knows it today.
// ─────────────────────────────────────────────────────────────────────────────

export function freshId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().toUpperCase()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`.toUpperCase();
}

export const LEAGUE_FORMATS = ["Singles", "Doubles"] as const;
export const START_FORMATS = ["Shotgun", "Tee times", "Flex"] as const;

export interface LeagueSettings {
  format: string;      // LEAGUE_FORMATS
  startFormat: string; // START_FORMATS
  description: string;
}
export interface League {
  id: string;
  name: string;
  slug: string;
  courseId?: string;
  courseName?: string;
  adminIds: string[];
  createdById: string;
  createdByName: string;
  settings: LeagueSettings;
  memberCount: number;
  createdAt: number;
  lastUpdated: number;
}
export interface LeagueMember {
  id: string; // canonical id
  name: string;
  username?: string;
  photo?: string;
  role: "owner" | "director" | "member";
  joinedAt: number;
}
export interface LeagueEvent {
  id: string;
  leagueId: string;
  leagueName: string;
  name: string;
  date: number; // ms epoch start time
  courseId?: string;
  courseName?: string;
  format: string;
  startFormat: string;
  status: "scheduled" | "active" | "complete";
  entryCount: number;
  createdAt: number;
}
export interface EventEntry {
  id: string; // canonical id
  name: string;
  username?: string;
  photo?: string;
  division?: string;
  checkedInAt: number;
  paid?: boolean;
  cardId?: string;
  // Scores: Phase 1 is director-entered on web; publishedRoundId/leagueEventId
  // auto-attach arrives with the app-side stamp.
  score?: number;       // total strokes
  scoreToPar?: number;
  penalty?: number;
  startingScore?: number;
  dnf?: boolean;
  publishedRoundId?: string;
}
export interface EventCard {
  id: string;
  number: number;
  startHole: number;
  playerIds: string[];
}
export interface StandingRow {
  id: string;
  name: string;
  played: number;
  points: number;
  bestToPar?: number;
}

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "league";

// ---- Leagues ----

export async function createLeague(uid: string, input: { name: string; courseId?: string; courseName?: string; settings: LeagueSettings }): Promise<League | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const id = freshId();
  const slug = `${slugify(input.name)}-${id.slice(0, 6).toLowerCase()}`;
  const now = Date.now();
  const league: League = {
    id, name: input.name.trim(), slug,
    courseId: input.courseId, courseName: input.courseName,
    adminIds: [profile.canonicalId],
    createdById: profile.canonicalId, createdByName: profile.name,
    settings: input.settings, memberCount: 1, createdAt: now, lastUpdated: now,
  };
  // JSON round-trip strips undefined optionals (Firestore rejects undefined values).
  await setDoc(doc(db, "leagues", id), JSON.parse(JSON.stringify(league)), { merge: true });
  await setDoc(doc(db, "leagues", id, "members", profile.canonicalId), {
    name: profile.name, username: profile.username || null, photo: profile.profileImageUrl || null,
    role: "owner", joinedAt: now,
  }, { merge: true });
  return league;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLeague(id: string, d: any): League {
  return {
    id, name: d.name ?? "League", slug: d.slug ?? id,
    courseId: d.courseId || undefined, courseName: d.courseName || undefined,
    adminIds: Array.isArray(d.adminIds) ? d.adminIds : [],
    createdById: d.createdById ?? "", createdByName: d.createdByName ?? "",
    settings: { format: d.settings?.format ?? "Singles", startFormat: d.settings?.startFormat ?? "Shotgun", description: d.settings?.description ?? "" },
    memberCount: Number(d.memberCount) || 0, createdAt: Number(d.createdAt) || 0, lastUpdated: Number(d.lastUpdated) || 0,
  };
}

export async function getLeagueBySlug(slug: string): Promise<League | null> {
  try {
    const snap = await getDocs(query(collection(db, "leagues"), where("slug", "==", slug), limit(1)));
    const d = snap.docs[0];
    return d ? toLeague(d.id, d.data()) : null;
  } catch { return null; }
}

export async function getMyLeagues(uid: string): Promise<League[]> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "leagues"), where("adminIds", "array-contains", cid), limit(50)));
    return snap.docs.map((d) => toLeague(d.id, d.data())).sort((a, b) => b.lastUpdated - a.lastUpdated);
  } catch { return []; }
}

export async function getAllLeagues(max = 50): Promise<League[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagues"), orderBy("lastUpdated", "desc"), limit(max)));
    return snap.docs.map((d) => toLeague(d.id, d.data()));
  } catch { return []; }
}

export function isLeagueAdmin(league: League, cid?: string | null): boolean {
  return !!cid && league.adminIds.includes(cid);
}

export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagues", leagueId, "members"), limit(200)));
    return snap.docs
      .map((d) => {
        const m = d.data();
        return {
          id: d.id, name: (m.name ?? "Player") as string, username: (m.username as string) || undefined,
          photo: (m.photo as string) || undefined, role: (m.role ?? "member") as LeagueMember["role"],
          joinedAt: Number(m.joinedAt) || 0,
        };
      })
      .sort((a, b) => a.joinedAt - b.joinedAt);
  } catch { return []; }
}

// ---- Events ----

/** Create one event per date (recurring = the caller passes every date in the season). */
export async function createEvents(uid: string, league: League, input: { name: string; dates: number[]; courseId?: string; courseName?: string; format?: string; startFormat?: string }): Promise<LeagueEvent[]> {
  const now = Date.now();
  const out: LeagueEvent[] = [];
  for (const date of input.dates) {
    const id = freshId();
    const ev: LeagueEvent = {
      id, leagueId: league.id, leagueName: league.name,
      name: input.name.trim() || league.name,
      date,
      courseId: input.courseId ?? league.courseId,
      courseName: input.courseName ?? league.courseName,
      format: input.format ?? league.settings.format,
      startFormat: input.startFormat ?? league.settings.startFormat,
      status: "scheduled", entryCount: 0, createdAt: now,
    };
    await setDoc(doc(db, "leagueEvents", id), JSON.parse(JSON.stringify(ev)), { merge: true });
    out.push(ev);
  }
  await setDoc(doc(db, "leagues", league.id), { lastUpdated: now }, { merge: true });
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEvent(id: string, d: any): LeagueEvent {
  return {
    id, leagueId: d.leagueId ?? "", leagueName: d.leagueName ?? "", name: d.name ?? "Event",
    date: Number(d.date) || 0, courseId: d.courseId || undefined, courseName: d.courseName || undefined,
    format: d.format ?? "Singles", startFormat: d.startFormat ?? "Shotgun",
    status: (d.status ?? "scheduled") as LeagueEvent["status"],
    entryCount: Number(d.entryCount) || 0, createdAt: Number(d.createdAt) || 0,
  };
}

export async function getLeagueEvents(leagueId: string): Promise<LeagueEvent[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagueEvents"), where("leagueId", "==", leagueId), limit(100)));
    return snap.docs.map((d) => toEvent(d.id, d.data())).sort((a, b) => a.date - b.date);
  } catch { return []; }
}

export async function getEvent(eventId: string): Promise<LeagueEvent | null> {
  try {
    const s = await getDoc(doc(db, "leagueEvents", eventId));
    return s.exists() ? toEvent(s.id, s.data()) : null;
  } catch { return null; }
}

export async function setEventStatus(eventId: string, status: LeagueEvent["status"]): Promise<void> {
  await setDoc(doc(db, "leagueEvents", eventId), { status }, { merge: true });
}

// ---- Entries (check-in) ----

export async function checkIn(uid: string, event: LeagueEvent, division?: string): Promise<EventEntry | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const now = Date.now();
  const entry = {
    name: profile.name, username: profile.username || null, photo: profile.profileImageUrl || null,
    division: division || null, checkedInAt: now,
  };
  await setDoc(doc(db, "leagueEvents", event.id, "entries", profile.canonicalId), entry, { merge: true });
  // Also join the league as a member (idempotent; never downgrades an existing role).
  const memberRef = doc(db, "leagues", event.leagueId, "members", profile.canonicalId);
  const existing = await getDoc(memberRef);
  if (!existing.exists()) {
    await setDoc(memberRef, { name: profile.name, username: profile.username || null, photo: profile.profileImageUrl || null, role: "member", joinedAt: now }, { merge: true });
  }
  const entries = await getEntries(event.id);
  await setDoc(doc(db, "leagueEvents", event.id), { entryCount: entries.length }, { merge: true });
  return { id: profile.canonicalId, name: profile.name, username: profile.username || undefined, photo: profile.profileImageUrl, division, checkedInAt: now };
}

export async function getEntries(eventId: string): Promise<EventEntry[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagueEvents", eventId, "entries"), limit(200)));
    return snap.docs
      .map((d) => {
        const e = d.data();
        return {
          id: d.id, name: (e.name ?? "Player") as string, username: (e.username as string) || undefined,
          photo: (e.photo as string) || undefined, division: (e.division as string) || undefined,
          checkedInAt: Number(e.checkedInAt) || 0, paid: e.paid === true,
          cardId: (e.cardId as string) || undefined,
          score: typeof e.score === "number" ? e.score : undefined,
          scoreToPar: typeof e.scoreToPar === "number" ? e.scoreToPar : undefined,
          penalty: typeof e.penalty === "number" ? e.penalty : undefined,
          startingScore: typeof e.startingScore === "number" ? e.startingScore : undefined,
          dnf: e.dnf === true, publishedRoundId: (e.publishedRoundId as string) || undefined,
        };
      })
      .sort((a, b) => a.checkedInAt - b.checkedInAt);
  } catch { return []; }
}

/** Director-side per-entry updates (paid flag, division moves, score entry, penalties, DNF). */
export async function updateEntry(eventId: string, entryId: string, patch: Partial<Pick<EventEntry, "paid" | "division" | "score" | "scoreToPar" | "penalty" | "startingScore" | "dnf">>): Promise<void> {
  // undefined → deleteField so clearing a score/penalty actually removes the key.
  const upd: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) upd[k] = v === undefined ? deleteField() : v;
  await updateDoc(doc(db, "leagueEvents", eventId, "entries", entryId), upd);
}

// ---- Cards ----

/** Random card generation: shuffle entries into groups of `size`, shotgun start holes. */
export async function generateCards(eventId: string, entries: EventEntry[], size = 4, holes: number[] = []): Promise<EventCard[]> {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  const cards: EventCard[] = [];
  for (let i = 0; i < shuffled.length; i += size) {
    const n = cards.length + 1;
    cards.push({ id: freshId(), number: n, startHole: holes[cards.length] ?? (cards.length * 2 + 1), playerIds: shuffled.slice(i, i + size).map((e) => e.id) });
  }
  // Replace the card set wholesale: clear old assignments, write new cards + entry.cardId.
  const old = await getCards(eventId);
  await Promise.all(old.map((c) => setDoc(doc(db, "leagueEvents", eventId, "cards", c.id), { deleted: true }, { merge: true })));
  for (const c of cards) {
    await setDoc(doc(db, "leagueEvents", eventId, "cards", c.id), { number: c.number, startHole: c.startHole, playerIds: c.playerIds, deleted: false }, { merge: true });
    await Promise.all(c.playerIds.map((pid) => setDoc(doc(db, "leagueEvents", eventId, "entries", pid), { cardId: c.id }, { merge: true })));
  }
  return cards;
}

export async function getCards(eventId: string): Promise<EventCard[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagueEvents", eventId, "cards"), limit(60)));
    return snap.docs
      .map((d) => {
        const c = d.data();
        return c.deleted === true ? null : { id: d.id, number: Number(c.number) || 0, startHole: Number(c.startHole) || 1, playerIds: Array.isArray(c.playerIds) ? c.playerIds : [] };
      })
      .filter((x): x is EventCard => x !== null)
      .sort((a, b) => a.number - b.number);
  } catch { return []; }
}

// ---- Standings ----
//
// Phase-1 points (PLACEHOLDER, director-visible, deliberately simple + transparent):
// rank within the event by adjusted score (score + penalty + startingScore), DNF gets
// the minimum. points = max(participants − rank + 1, 1). Recomputed from completed
// events on demand; Phase 2 adds best-N / season windows / points curves.

export function eventPoints(entries: EventEntry[]): Map<string, number> {
  const scored = entries.filter((e) => typeof e.score === "number" && !e.dnf);
  const ranked = [...scored].sort((a, b) => (a.score! + (a.penalty ?? 0) + (a.startingScore ?? 0)) - (b.score! + (b.penalty ?? 0) + (b.startingScore ?? 0)));
  const out = new Map<string, number>();
  ranked.forEach((e, i) => out.set(e.id, Math.max(entries.length - i, 1)));
  for (const e of entries) if (!out.has(e.id) && e.checkedInAt) out.set(e.id, 1);
  return out;
}

export async function computeStandings(leagueId: string): Promise<StandingRow[]> {
  const events = (await getLeagueEvents(leagueId)).filter((e) => e.status === "complete");
  const rows = new Map<string, StandingRow>();
  for (const ev of events) {
    const entries = await getEntries(ev.id);
    const pts = eventPoints(entries);
    for (const e of entries) {
      const row = rows.get(e.id) ?? { id: e.id, name: e.name, played: 0, points: 0 };
      row.played += 1;
      row.points += pts.get(e.id) ?? 0;
      if (typeof e.scoreToPar === "number") row.bestToPar = row.bestToPar == null ? e.scoreToPar : Math.min(row.bestToPar, e.scoreToPar);
      rows.set(e.id, row);
    }
  }
  const list = [...rows.values()].sort((a, b) => b.points - a.points);
  await setDoc(doc(db, "leagues", leagueId, "standings", "current"), { players: JSON.parse(JSON.stringify(list)), updatedAt: Date.now() }, { merge: true });
  return list;
}
