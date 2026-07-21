import { db } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, deleteField, arrayUnion, arrayRemove, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
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

/** Event kinds — discovery categories AND behavior hints (league = weekly repeat, tournament = multi-round). */
export const EVENT_KINDS = [
  { key: "league", label: "League / Weekly", icon: "📅", blurb: "A recurring league night — schedule the whole season at once." },
  { key: "tournament", label: "Tournament", icon: "🏆", blurb: "One-off or multi-round competition with cumulative scoring." },
  { key: "clinic", label: "Clinic", icon: "🎯", blurb: "Instruction and practice — form work, putting, field sessions." },
  { key: "cleanup", label: "Course cleanup", icon: "🧹", blurb: "Work day — trimming, trash, tee pads. The course thanks you." },
  { key: "social", label: "Social round", icon: "🤝", blurb: "Casual meetup round — no pressure, no standings." },
] as const;

export const DEFAULT_DIVISIONS = ["Open"];
export const SUGGESTED_DIVISIONS = ["Open", "FPO", "Advanced", "Intermediate", "Rec", "Juniors"];

export interface LeagueSettings {
  format: string;      // LEAGUE_FORMATS
  startFormat: string; // START_FORMATS
  description: string;
  divisions?: string[]; // PDGA-style or custom; players pick one at check-in when >1
  bestN?: number;       // season standings count each player's best N event scores (0/undefined = all)
  handicapPercent?: number; // % of a player's field-relative average applied (default 90)
  handicapCap?: number;     // max |strokes| a handicap may reach (0/undefined = uncapped)
  bagTags?: boolean;        // run a real tag ladder: tags reassign by finish on event completion
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
  acePotBalance?: number; // running ace-pot ledger (director-maintained until an ace pays out)
  logoUrl?: string;       // league logo (Storage: leagueLogos/{uid}/{leagueId}.jpg)
  createdAt: number;
  lastUpdated: number;
}
export interface LeagueMember {
  id: string; // canonical id
  name: string;
  username?: string;
  photo?: string;
  role: "owner" | "director" | "member";
  tag?: number; // bag-tag number currently held (tag-ladder leagues)
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
  status: "scheduled" | "active" | "complete" | "cancelled";
  roundCount: number; // 1 = weekly league night; >1 = multi-round event (cumulative total)
  buyIn?: number;     // dollars per player; the paid toggle × buyIn = collected pot
  kind?: string;        // EVENT_KINDS key — discovery category
  isPrivate?: boolean;  // private events are link/search-only, excluded from discovery
  description?: string; // event-specific notes (markdown-lite)
  contactEmail?: string;
  contactPhone?: string;
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
  // Scores: director-entered on web today; publishedRoundId/leagueEventId
  // auto-attach arrives with the app-side stamp.
  score?: number;       // total strokes (multi-round events: sum of roundScores)
  roundScores?: number[]; // per-round totals for multi-round events (index 0 = round 1)
  scoreToPar?: number;
  penalty?: number;
  startingScore?: number;
  payout?: number;      // dollars paid out to this player (director ledger)
  tag?: number;         // bag tag brought INTO the event (snapshot at check-in/assignment)
  dnf?: boolean;
  publishedRoundId?: string;
  // LIVE SCORING CONTRACT (app-side stamp target, Phase 2+): while a round is in
  // progress, the SCORER's app mirrors the card's hole scores onto each cardmate's
  // entry doc: holeScores (index 0 = hole 1; 0/absent = not played) + thruHole.
  // Web subscribes and renders "thru N" live; `score` stays authoritative once the
  // round publishes. Directors never edit these fields.
  holeScores?: number[];
  thruHole?: number;
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
  division?: string;
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
    settings: {
      format: d.settings?.format ?? "Singles", startFormat: d.settings?.startFormat ?? "Shotgun", description: d.settings?.description ?? "",
      divisions: Array.isArray(d.settings?.divisions) && d.settings.divisions.length ? d.settings.divisions : DEFAULT_DIVISIONS,
      bestN: Number(d.settings?.bestN) || undefined,
      handicapPercent: Number(d.settings?.handicapPercent) || undefined,
      handicapCap: Number(d.settings?.handicapCap) || undefined,
      bagTags: d.settings?.bagTags === true,
    },
    memberCount: Number(d.memberCount) || 0,
    acePotBalance: typeof d.acePotBalance === "number" ? d.acePotBalance : undefined,
    logoUrl: (d.logoUrl as string) || undefined,
    createdAt: Number(d.createdAt) || 0, lastUpdated: Number(d.lastUpdated) || 0,
  };
}

// ---- Course search (wizard "Where" step) ----
// One cached sweep of the public course directory (name/city/state only via the
// REST mask — ~1.4k tiny rows), then instant client-side filtering.
export interface CourseHit { id: string; name: string; city?: string; state?: string }
let courseCache: CourseHit[] | null = null;
export async function searchCourses(qText: string, max = 8): Promise<CourseHit[]> {
  if (!courseCache) {
    const { fsList } = await import("./firestoreRest");
    const rows = await fsList("courses", { mask: ["name", "city", "state", "isDraft", "reviewStatus"], max: 2500 });
    courseCache = rows
      .filter((r) => r.name && r.isDraft !== true && r.reviewStatus !== "pending" && r.reviewStatus !== "rejected")
      .map((r) => ({ id: r.id as string, name: String(r.name), city: (r.city as string) || undefined, state: (r.state as string) || undefined }));
  }
  const needle = qText.trim().toLowerCase();
  if (!needle) return [];
  return courseCache
    .filter((c) => `${c.name} ${c.city ?? ""} ${c.state ?? ""}`.toLowerCase().includes(needle))
    .slice(0, max);
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

/** Director-side league settings update (field-scoped; never touches adminIds/identity). */
export async function updateLeagueSettings(leagueId: string, settings: LeagueSettings): Promise<void> {
  await setDoc(doc(db, "leagues", leagueId), { settings: JSON.parse(JSON.stringify(settings)), lastUpdated: Date.now() }, { merge: true });
}

/** Ace-pot ledger write (director-maintained running balance). */
export async function setAcePot(leagueId: string, balance: number): Promise<void> {
  await setDoc(doc(db, "leagues", leagueId), { acePotBalance: balance, lastUpdated: Date.now() }, { merge: true });
}

export async function setLeagueLogo(leagueId: string, logoUrl: string): Promise<void> {
  await setDoc(doc(db, "leagues", leagueId), { logoUrl, lastUpdated: Date.now() }, { merge: true });
}

/** Promote/demote a member. Directors join/leave adminIds; the owner can't be demoted here. */
export async function setMemberRole(leagueId: string, memberId: string, role: "director" | "member"): Promise<void> {
  await setDoc(doc(db, "leagues", leagueId, "members", memberId), { role }, { merge: true });
  await updateDoc(doc(db, "leagues", leagueId), { adminIds: role === "director" ? arrayUnion(memberId) : arrayRemove(memberId), lastUpdated: Date.now() });
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
          tag: typeof m.tag === "number" ? m.tag : undefined,
          joinedAt: Number(m.joinedAt) || 0,
        };
      })
      .sort((a, b) => a.joinedAt - b.joinedAt);
  } catch { return []; }
}

// ---- Events ----

/** Create one event per date (recurring = the caller passes every date in the season). */
export async function createEvents(uid: string, league: League, input: { name: string; dates: number[]; courseId?: string; courseName?: string; format?: string; startFormat?: string; roundCount?: number; buyIn?: number; kind?: string; isPrivate?: boolean; description?: string; contactEmail?: string; contactPhone?: string }): Promise<LeagueEvent[]> {
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
      status: "scheduled", roundCount: Math.max(1, Math.min(input.roundCount ?? 1, 6)),
      buyIn: input.buyIn && input.buyIn > 0 ? input.buyIn : undefined,
      kind: input.kind, isPrivate: input.isPrivate || undefined,
      description: input.description?.trim() || undefined,
      contactEmail: input.contactEmail?.trim() || undefined,
      contactPhone: input.contactPhone?.trim() || undefined,
      entryCount: 0, createdAt: now,
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
    roundCount: Math.max(1, Number(d.roundCount) || 1),
    buyIn: Number(d.buyIn) > 0 ? Number(d.buyIn) : undefined,
    kind: (d.kind as string) || undefined,
    isPrivate: d.isPrivate === true,
    description: (d.description as string) || undefined,
    contactEmail: (d.contactEmail as string) || undefined,
    contactPhone: (d.contactPhone as string) || undefined,
    entryCount: Number(d.entryCount) || 0, createdAt: Number(d.createdAt) || 0,
  };
}

/** Director event-config tweaks (add a round, set the buy-in). */
export async function updateEventConfig(eventId: string, patch: { roundCount?: number; buyIn?: number | null }): Promise<void> {
  const upd: Record<string, unknown> = {};
  if (patch.roundCount != null) upd.roundCount = Math.max(1, Math.min(patch.roundCount, 6));
  if (patch.buyIn !== undefined) upd.buyIn = patch.buyIn && patch.buyIn > 0 ? patch.buyIn : deleteField();
  await updateDoc(doc(db, "leagueEvents", eventId), upd);
}

export async function getLeagueEvents(leagueId: string): Promise<LeagueEvent[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagueEvents"), where("leagueId", "==", leagueId), limit(100)));
    return snap.docs.map((d) => toEvent(d.id, d.data())).sort((a, b) => a.date - b.date);
  } catch { return []; }
}

/** Discovery: upcoming events across ALL leagues (single-field range+order — no composite index). */
export async function getUpcomingEvents(max = 60): Promise<LeagueEvent[]> {
  try {
    const cutoff = Date.now() - 12 * 3600_000;
    const snap = await getDocs(query(collection(db, "leagueEvents"), where("date", ">=", cutoff), orderBy("date", "asc"), limit(max)));
    // Private events are link/search-only — never surfaced in discovery.
    return snap.docs.map((d) => toEvent(d.id, d.data())).filter((e) => e.status !== "cancelled" && !e.isPrivate);
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

/** Remove a checked-in player (director action) and keep the event's entry count honest. */
export async function removeEntry(eventId: string, entryId: string): Promise<void> {
  await deleteDoc(doc(db, "leagueEvents", eventId, "entries", entryId));
  const entries = await getEntries(eventId);
  await setDoc(doc(db, "leagueEvents", eventId), { entryCount: entries.length }, { merge: true });
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(id: string, e: any): EventEntry {
  return {
    id, name: (e.name ?? "Player") as string, username: (e.username as string) || undefined,
    photo: (e.photo as string) || undefined, division: (e.division as string) || undefined,
    checkedInAt: Number(e.checkedInAt) || 0, paid: e.paid === true,
    cardId: (e.cardId as string) || undefined,
    score: typeof e.score === "number" ? e.score : undefined,
    roundScores: Array.isArray(e.roundScores) ? (e.roundScores as number[]) : undefined,
    scoreToPar: typeof e.scoreToPar === "number" ? e.scoreToPar : undefined,
    penalty: typeof e.penalty === "number" ? e.penalty : undefined,
    startingScore: typeof e.startingScore === "number" ? e.startingScore : undefined,
    payout: typeof e.payout === "number" ? e.payout : undefined,
    tag: typeof e.tag === "number" ? e.tag : undefined,
    dnf: e.dnf === true, publishedRoundId: (e.publishedRoundId as string) || undefined,
    holeScores: Array.isArray(e.holeScores) ? (e.holeScores as number[]) : undefined,
    thruHole: typeof e.thruHole === "number" ? e.thruHole : undefined,
  };
}

export async function getEntries(eventId: string): Promise<EventEntry[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagueEvents", eventId, "entries"), limit(200)));
    return snap.docs.map((d) => toEntry(d.id, d.data())).sort((a, b) => a.checkedInAt - b.checkedInAt);
  } catch { return []; }
}

/** Live leaderboard: subscribe to the event's entries; fires on every score/entry write. */
export function subscribeEntries(eventId: string, cb: (entries: EventEntry[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "leagueEvents", eventId, "entries"), limit(200)),
    (snap) => cb(snap.docs.map((d) => toEntry(d.id, d.data())).sort((a, b) => a.checkedInAt - b.checkedInAt)),
    () => { /* keep last good state on listener errors */ }
  );
}

/** Live total for an in-progress entry: sum of mirrored hole scores. */
export function liveTotal(e: EventEntry): number | undefined {
  if (!e.holeScores?.length) return undefined;
  const played = e.holeScores.filter((n) => n > 0);
  return played.length ? played.reduce((a, b) => a + b, 0) : undefined;
}

/** Director-side per-entry updates (paid flag, division moves, score entry, penalties, DNF, payouts). */
export async function updateEntry(eventId: string, entryId: string, patch: Partial<Pick<EventEntry, "paid" | "division" | "score" | "scoreToPar" | "penalty" | "startingScore" | "payout" | "dnf">>): Promise<void> {
  // undefined → deleteField so clearing a score/penalty actually removes the key.
  const upd: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) upd[k] = v === undefined ? deleteField() : v;
  await updateDoc(doc(db, "leagueEvents", eventId, "entries", entryId), upd);
}

/** Multi-round score entry: write one round's total; `score` stays the cumulative sum. */
export async function setRoundScore(eventId: string, entry: EventEntry, roundIdx: number, value: number | undefined, roundCount: number): Promise<void> {
  const rounds = [...(entry.roundScores ?? Array.from({ length: roundCount }, () => 0))];
  while (rounds.length < roundCount) rounds.push(0);
  rounds[roundIdx] = value ?? 0;
  const played = rounds.filter((n) => n > 0);
  const total = played.length ? played.reduce((a, b) => a + b, 0) : undefined;
  await updateDoc(doc(db, "leagueEvents", eventId, "entries", entry.id), {
    roundScores: rounds,
    score: total ?? deleteField(),
  });
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

// ---- Bag tags ----
//
// A REAL tag ladder (UDisc ships a free-text column): every tag-holding
// participant throws their tag in; the best adjusted finisher takes the lowest
// tag, and so on. Players without a tag join the ladder at the bottom, numbered
// past the league's current max, in finish order. Runs on event completion when
// settings.bagTags is on; writes both the member's current tag and the entry's
// outgoing tag so the event page shows who took what home.

export interface TagChange { playerId: string; name: string; from?: number; to: number; }

export async function reassignBagTags(league: League, eventId: string): Promise<TagChange[]> {
  if (!league.settings.bagTags) return [];
  const [members, entries] = await Promise.all([getLeagueMembers(league.id), getEntries(eventId)]);
  if (!entries.length) return [];
  const tagOf = new Map(members.filter((m) => typeof m.tag === "number").map((m) => [m.id, m.tag!]));
  const adj = (e: EventEntry) => (typeof e.score === "number" && !e.dnf ? e.score + (e.penalty ?? 0) + (e.startingScore ?? 0) : Number.POSITIVE_INFINITY);
  const ranked = [...entries].sort((a, b) => adj(a) - adj(b));
  const pool = ranked.filter((e) => tagOf.has(e.id)).map((e) => tagOf.get(e.id)!).sort((a, b) => a - b);
  let nextNew = Math.max(0, ...members.map((m) => m.tag ?? 0)) + 1;
  const changes: TagChange[] = [];
  let poolIdx = 0;
  for (const e of ranked) {
    const from = tagOf.get(e.id);
    const to = from != null ? pool[poolIdx++] : nextNew++;
    changes.push({ playerId: e.id, name: e.name, from, to });
    await setDoc(doc(db, "leagues", league.id, "members", e.id), { tag: to }, { merge: true });
    await setDoc(doc(db, "leagueEvents", eventId, "entries", e.id), { tag: to }, { merge: true });
  }
  return changes;
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

// ---- Handicaps ----
//
// THE TRANSPARENT FORMULA (published on purpose — every director can recompute
// it by hand, unlike UDisc's "not as simple as an equation"):
//
//   handicap = round( percent% × mean( playerScore − fieldAverage, over the
//                                      player's last 5 completed league events ) )
//   clamped to ±cap when a cap is set. startingScore = −handicap.
//
// Field-relative (score minus that event's field average) so course/layout
// changes cancel out without needing par data. Directors can override any
// player's startingScore afterwards — handicaps are a suggestion the director
// owns, not a black box.

export interface HandicapRow {
  playerId: string;
  name: string;
  diffs: number[];   // playerScore − fieldAvg per counted event (oldest → newest)
  average: number;   // mean of diffs
  handicap: number;  // rounded, capped
  capped: boolean;
}

export async function computeHandicaps(league: League): Promise<HandicapRow[]> {
  const percent = league.settings.handicapPercent ?? 90;
  const cap = league.settings.handicapCap;
  const events = (await getLeagueEvents(league.id)).filter((e) => e.status === "complete");
  const history = new Map<string, { name: string; diffs: number[] }>();
  for (const ev of events) { // chronological (getLeagueEvents sorts by date)
    const entries = (await getEntries(ev.id)).filter((e) => typeof e.score === "number" && !e.dnf);
    if (entries.length < 2) continue; // a field of one has no field average
    const fieldAvg = entries.reduce((a, e) => a + e.score!, 0) / entries.length;
    for (const e of entries) {
      const h = history.get(e.id) ?? { name: e.name, diffs: [] };
      h.diffs.push(e.score! - fieldAvg);
      history.set(e.id, h);
    }
  }
  return [...history.entries()].map(([playerId, h]) => {
    const recent = h.diffs.slice(-5);
    const average = recent.reduce((a, b) => a + b, 0) / recent.length;
    const raw = Math.round((percent / 100) * average);
    const handicap = cap && cap > 0 ? Math.max(-cap, Math.min(cap, raw)) : raw;
    return { playerId, name: h.name, diffs: recent.map((d) => Math.round(d * 10) / 10), average: Math.round(average * 10) / 10, handicap, capped: handicap !== raw };
  });
}

/** Write handicaps as startingScore (−handicap) onto this event's checked-in entries. */
export async function applyHandicaps(eventId: string, entries: EventEntry[], rows: HandicapRow[]): Promise<number> {
  const byId = new Map(rows.map((r) => [r.playerId, r]));
  let applied = 0;
  for (const e of entries) {
    const r = byId.get(e.id);
    if (!r || r.handicap === 0) continue;
    await setDoc(doc(db, "leagueEvents", eventId, "entries", e.id), { startingScore: -r.handicap }, { merge: true });
    applied++;
  }
  return applied;
}

export async function computeStandings(leagueId: string, bestN?: number): Promise<StandingRow[]> {
  const events = (await getLeagueEvents(leagueId)).filter((e) => e.status === "complete");
  const perPlayer = new Map<string, { name: string; division?: string; eventPts: number[]; bestToPar?: number }>();
  for (const ev of events) {
    const entries = await getEntries(ev.id);
    const pts = eventPoints(entries);
    for (const e of entries) {
      const p = perPlayer.get(e.id) ?? { name: e.name, eventPts: [] };
      p.eventPts.push(pts.get(e.id) ?? 0);
      if (e.division) p.division = e.division; // latest event's division wins
      if (typeof e.scoreToPar === "number") p.bestToPar = p.bestToPar == null ? e.scoreToPar : Math.min(p.bestToPar, e.scoreToPar);
      perPlayer.set(e.id, p);
    }
  }
  // best-N: only a player's top N event scores count toward the season (0/undefined = all).
  const list: StandingRow[] = [...perPlayer.entries()].map(([id, p]) => {
    const counted = bestN && bestN > 0 ? [...p.eventPts].sort((a, b) => b - a).slice(0, bestN) : p.eventPts;
    return { id, name: p.name, division: p.division, played: p.eventPts.length, points: counted.reduce((a, b) => a + b, 0), bestToPar: p.bestToPar };
  }).sort((a, b) => b.points - a.points);
  // Persisting the computed doc is best-effort: under the Stage-2 rules only
  // admins may write standings, and a visitor recomputing for display must
  // still get the list back.
  try {
    await setDoc(doc(db, "leagues", leagueId, "standings", "current"), { players: JSON.parse(JSON.stringify(list)), bestN: bestN ?? null, updatedAt: Date.now() }, { merge: true });
  } catch { /* read-only viewer */ }
  return list;
}
