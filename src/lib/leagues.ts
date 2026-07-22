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

export const LEAGUE_FORMATS = ["Singles", "Doubles", "Teams"] as const;
export const START_FORMATS = ["Shotgun", "Tee times", "Flex"] as const;

/** Event kinds — discovery categories AND behavior hints (league = weekly repeat, tournament = multi-round). */
export const EVENT_KINDS = [
  { key: "league", label: "League", blurb: "A recurring league night — schedule the whole season at once." },
  { key: "tournament", label: "Tournament", blurb: "One-off or multi-round competition with cumulative scoring." },
  { key: "clinic", label: "Clinic", blurb: "Instruction and practice — form work, putting, field sessions." },
  { key: "cleanup", label: "Course cleanup", blurb: "Work day — trimming, trash, tee pads. The course thanks you." },
  { key: "social", label: "Social round", blurb: "Casual meetup round — no pressure, no standings." },
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
  holes: number;      // holes per round (9 / 18 / custom) — context for every score
  capacity?: number;  // field cap; fill bars and spots-remaining render only when set
  buyIn?: number;     // dollars per player; the paid toggle × buyIn = collected pot
  kind?: string;        // EVENT_KINDS key — discovery category
  isPrivate?: boolean;  // private events are link/search-only, excluded from discovery
  extras?: string[];    // optional-extras tags (EVENT_EXTRAS keys): ace pool, glow, beginner-friendly…
  // Per-kind detail fields (all optional; display-layer)
  focus?: string;        // clinic: Putting | Driving | Form | Field work
  skillLevel?: string;   // clinic: Beginner | Intermediate | All levels
  durationMin?: number;  // clinic/cleanup session length
  bring?: string;        // clinic/cleanup: what to bring
  workList?: string[];   // cleanup: work items
  meetingPoint?: string; // cleanup: where to meet
  payoutPlaces?: number; // tournament: how many places paid (suggestion engine)
  teamNames?: Record<string, string>; // Doubles/Teams: teamId -> chosen team name
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
  teamId?: number; // Doubles/Teams events: which team this player is on (1-based)
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
/** Course presentation metadata (cover photo, city/state), masked REST read, session-cached. */
export interface CourseMeta { cover?: string; city?: string; state?: string; lat?: number; lng?: number }
const courseMetaCache = new Map<string, CourseMeta | null>();
export async function getCourseMeta(ids: string[]): Promise<Map<string, CourseMeta>> {
  const wanted = [...new Set(ids.filter(Boolean))];
  const missing = wanted.filter((id) => !courseMetaCache.has(id));
  if (missing.length) {
    const { fsGet } = await import("./firestoreRest");
    await Promise.all(missing.map(async (id) => {
      const d = await fsGet(`courses/${id}`, ["coverPhotoUrl", "city", "state", "latitude", "longitude"]);
      if (!d) { courseMetaCache.set(id, null); return; }
      const url = typeof d.coverPhotoUrl === "string" && /^https?:\/\//.test(d.coverPhotoUrl) ? d.coverPhotoUrl : undefined;
      courseMetaCache.set(id, {
        cover: url,
        city: typeof d.city === "string" && d.city ? d.city : undefined,
        state: typeof d.state === "string" && d.state ? d.state : undefined,
        lat: Number(d.latitude) || undefined,
        lng: Number(d.longitude) || undefined,
      });
    }));
  }
  const out = new Map<string, CourseMeta>();
  for (const id of wanted) { const m = courseMetaCache.get(id); if (m) out.set(id, m); }
  return out;
}
export async function getCourseCovers(ids: string[]): Promise<Map<string, string>> {
  const meta = await getCourseMeta(ids);
  const out = new Map<string, string>();
  for (const [id, m] of meta) if (m.cover) out.set(id, m.cover);
  return out;
}

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
export const EVENT_EXTRAS = [
  { key: "ace_pool", label: "Ace pool", hint: "Optional side pot" },
  { key: "ctp", label: "CTP pot", hint: "Closest to the pin" },
  { key: "bag_tags", label: "Bag tags", hint: "Tags in play" },
  { key: "glow", label: "Glow round", hint: "After dark, lit discs" },
  { key: "beginner", label: "Beginner-friendly", hint: "New players welcome" },
  { key: "women", label: "Women-friendly", hint: "Women and girls welcome" },
  { key: "juniors", label: "Junior-friendly", hint: "Juniors welcome" },
  { key: "charity", label: "Charity event", hint: "Proceeds support a cause" },
] as const;

export async function createEvents(uid: string, league: League, input: { name: string; dates: number[]; courseId?: string; courseName?: string; format?: string; startFormat?: string; roundCount?: number; holes?: number; capacity?: number; buyIn?: number; kind?: string; isPrivate?: boolean; description?: string; contactEmail?: string; contactPhone?: string; extras?: string[]; focus?: string; skillLevel?: string; durationMin?: number; bring?: string; workList?: string[]; meetingPoint?: string; payoutPlaces?: number }): Promise<LeagueEvent[]> {
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
      holes: Math.max(1, Math.min(input.holes ?? 18, 36)),
      capacity: input.capacity && input.capacity > 0 ? Math.floor(input.capacity) : undefined,
      buyIn: input.buyIn && input.buyIn > 0 ? input.buyIn : undefined,
      kind: input.kind, isPrivate: input.isPrivate || undefined,
      description: input.description?.trim() || undefined,
      contactEmail: input.contactEmail?.trim() || undefined,
      contactPhone: input.contactPhone?.trim() || undefined,
      extras: input.extras?.filter((x) => EVENT_EXTRAS.some((t) => t.key === x)).length ? input.extras.filter((x) => EVENT_EXTRAS.some((t) => t.key === x)) : undefined,
      focus: input.focus?.trim() || undefined,
      skillLevel: input.skillLevel?.trim() || undefined,
      durationMin: input.durationMin && input.durationMin > 0 ? Math.floor(input.durationMin) : undefined,
      bring: input.bring?.trim() || undefined,
      workList: input.workList?.length ? input.workList : undefined,
      meetingPoint: input.meetingPoint?.trim() || undefined,
      payoutPlaces: input.payoutPlaces && input.payoutPlaces > 1 ? Math.min(Math.floor(input.payoutPlaces), 10) : undefined,
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
    holes: Number(d.holes) > 0 ? Number(d.holes) : 18,
    capacity: Number(d.capacity) > 0 ? Number(d.capacity) : undefined,
    extras: Array.isArray(d.extras) ? d.extras.filter((x: unknown) => typeof x === "string") : undefined,
    focus: (d.focus as string) || undefined,
    skillLevel: (d.skillLevel as string) || undefined,
    durationMin: Number(d.durationMin) > 0 ? Number(d.durationMin) : undefined,
    bring: (d.bring as string) || undefined,
    workList: Array.isArray(d.workList) ? d.workList.filter((x: unknown) => typeof x === "string") : undefined,
    meetingPoint: (d.meetingPoint as string) || undefined,
    payoutPlaces: Number(d.payoutPlaces) > 1 ? Number(d.payoutPlaces) : undefined,
    teamNames: d.teamNames && typeof d.teamNames === "object" ? Object.fromEntries(Object.entries(d.teamNames).filter(([, v]) => typeof v === "string" && v)) as Record<string, string> : undefined,
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
    teamId: typeof e.teamId === "number" ? e.teamId : undefined,
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

// ---- Teams (Doubles / Teams formats) ----

/** Shuffle checked-in players into teams of `size` (2 for doubles). 1-based team numbers. */
export async function randomizeTeams(eventId: string, entries: EventEntry[], size = 2): Promise<number> {
  const shuffled = [...entries].sort(() => Math.random() - 0.5);
  let teams = 0;
  for (let i = 0; i < shuffled.length; i += size) {
    teams++;
    await Promise.all(shuffled.slice(i, i + size).map((e) =>
      setDoc(doc(db, "leagueEvents", eventId, "entries", e.id), { teamId: teams }, { merge: true })
    ));
  }
  return teams;
}

/** Move one player to a team (or null to unassign) — the UDisc "move to team" action. */
/** Name a team (empty clears). Directors and the team's own players may rename. */
export async function setTeamName(eventId: string, teamId: number, name: string): Promise<void> {
  const clean = name.trim().slice(0, 40);
  await updateDoc(doc(db, "leagueEvents", eventId), { [`teamNames.${teamId}`]: clean || deleteField(), lastUpdated: Date.now() });
}

export async function setEntryTeam(eventId: string, entryId: string, teamId: number | null): Promise<void> {
  await updateDoc(doc(db, "leagueEvents", eventId, "entries", entryId), { teamId: teamId ?? deleteField() });
}

/** Team score entry: one total per team, written to every member so per-player standings still work. */
export async function setTeamScore(eventId: string, members: EventEntry[], score: number | undefined): Promise<void> {
  await Promise.all(members.map((m) =>
    updateDoc(doc(db, "leagueEvents", eventId, "entries", m.id), { score: score ?? deleteField() })
  ));
}

// ---- Event chat ----
// Mirrors the locals meetup chat contract EXACTLY (meetups/{id}/messages) so the
// apps can port it 1:1: leagueEvents/{id}/messages/{msgId}.

export interface EventMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  timestamp: number;
}

export async function sendEventMessage(uid: string, eventId: string, text: string): Promise<void> {
  const profile = await getProfileLite(uid);
  if (!profile || !text.trim()) return;
  const id = freshId();
  await setDoc(doc(db, "leagueEvents", eventId, "messages", id), {
    id, eventId,
    senderId: profile.canonicalId,
    senderName: profile.name,
    senderPhoto: profile.profileImageUrl ?? null,
    text: text.trim().slice(0, 1000),
    timestamp: Date.now(),
  });
}

export function subscribeEventMessages(eventId: string, cb: (msgs: EventMessage[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "leagueEvents", eventId, "messages"), orderBy("timestamp", "asc"), limit(200)),
    (snap) => cb(snap.docs.map((d) => {
      const m = d.data();
      return {
        id: d.id, senderId: (m.senderId as string) ?? "", senderName: (m.senderName as string) ?? "Player",
        senderPhoto: (m.senderPhoto as string) || undefined, text: (m.text as string) ?? "", timestamp: Number(m.timestamp) || 0,
      };
    })),
    () => { /* keep last good state */ }
  );
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

/** The league's latest event that has any scores — the "current leaderboard". */
export function latestScoredEvent(events: LeagueEvent[]): LeagueEvent | undefined {
  return [...events].reverse().find((e) => e.status === "complete" || e.status === "active");
}

// Per-hole pars from the event's course doc (holes[] or first layout) — powers
// birdie/eagle/bogey dot coloring with REAL data only. Cached per course.
const parCache = new Map<string, number[] | null>();
export interface HoleInfo { par: number; distFt: number | null }
const holeInfoCache = new Map<string, HoleInfo[] | null>();
/** Per-hole par + tee→basket distance (feet, computed from coords when present). */
export async function getCourseHoles(courseId: string): Promise<HoleInfo[] | null> {
  if (holeInfoCache.has(courseId)) return holeInfoCache.get(courseId)!;
  try {
    const snap = await getDoc(doc(db, "courses", courseId));
    let out: HoleInfo[] | null = null;
    if (snap.exists()) {
      const d = snap.data();
      const holeList = Array.isArray(d.holes) && d.holes.length ? d.holes
        : Array.isArray(d.layouts) && d.layouts[0]?.holes?.length ? d.layouts[0].holes : null;
      if (holeList) {
        const ftBetween = (aLat: number, aLng: number, bLat: number, bLng: number) => {
          const toR = (x: number) => (x * Math.PI) / 180;
          const h = Math.sin(toR(bLat - aLat) / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(toR(bLng - aLng) / 2) ** 2;
          return Math.round(2 * 20925524.9 * Math.asin(Math.sqrt(h)));
        };
        out = [...holeList]
          .sort((a, b) => (Number(a.holeNumber ?? a.number) || 0) - (Number(b.holeNumber ?? b.number) || 0))
          .map((h) => {
            const tLat = Number(h.teeLat), tLng = Number(h.teeLng), bLat = Number(h.basketLat), bLng = Number(h.basketLng);
            const coordsOk = tLat && tLng && bLat && bLng;
            const dist = coordsOk ? ftBetween(tLat, tLng, bLat, bLng) : null;
            return { par: Number(h.par) > 0 ? Number(h.par) : 3, distFt: dist && dist > 40 && dist < 2500 ? dist : null };
          });
      }
    }
    holeInfoCache.set(courseId, out);
    return out;
  } catch { holeInfoCache.set(courseId, null); return null; }
}
export async function getCoursePars(courseId: string): Promise<number[] | null> {
  if (parCache.has(courseId)) return parCache.get(courseId)!;
  const holes = await getCourseHoles(courseId);
  const pars = holes ? holes.map((h) => h.par) : null;
  parCache.set(courseId, pars);
  return pars;
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
