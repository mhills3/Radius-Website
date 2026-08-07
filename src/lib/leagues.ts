import { db } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, deleteField, arrayUnion, arrayRemove, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { getProfileLite, resolveCanonicalId } from "./account";
import { findUserByUsername } from "./leaderboard";

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

export const LEAGUE_FORMATS = ["Singles", "Teams"] as const;
export const TEAM_SIZES = [2, 3, 4] as const; // 2 = "Doubles"; teams are a size, not a separate format
export const START_FORMATS = ["Shotgun", "Tee times", "Flex"] as const;
/** True for the Teams format (and legacy "Doubles" docs, which are Teams of 2). */
export const isTeamFormat = (format?: string) => format === "Teams" || format === "Doubles";
/** Legacy "Doubles" → "Teams" so the format pickers (Singles|Teams) light up correctly. */
export const normalizeFormat = (format?: string) => (format === "Doubles" ? "Teams" : format || "Singles");

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
  teamSize?: number;    // Teams format: players per team (2 = doubles). Default 2.
  divisions?: string[]; // PDGA-style or custom; players pick one at check-in when >1
  bestN?: number;       // season standings count each player's best N event scores (0/undefined = all)
  handicapPercent?: number; // % of a player's field-relative average applied (default 90)
  handicapCap?: number;     // max |strokes| a handicap may reach (0/undefined = uncapped)
  bagTags?: boolean;        // run a real tag ladder: tags reassign by finish on event completion
  checkIns?: boolean;       // enable day-of check-in tracking (TD marks who's arrived; unlocks ~3h before start)
  checklistDone?: string[]; // setup-checklist items the director manually ticked off
  scoring?: LeagueScoring;  // how events turn into season standings (default = placement/linear/gross/sum)
}

// How a league scores. All fields optional; the defaults below reproduce the original
// behavior (placement + linear curve + gross + sum), so leagues with no scoring config are unchanged.
export type ScoringModel = "placement" | "strokeplay" | "matchplay";
export type PlacementCurve = "linear" | "table" | "proportional" | "decay";
export type StandingsView = "gross" | "net" | "both";
export interface LeagueScoring {
  model?: ScoringModel;        // "placement" (finish → points) | "matchplay" (H2H W/T/L → points). Default "placement".
  view?: StandingsView;        // "gross" | "net" | "both". "both" shows two races (gross champ + net champ). Default "gross".
  aggregate?: "sum" | "bestN"; // season rollup. "bestN" counts each player's top settings.bestN events. Default "sum".
  // placement curve (model === "placement")
  curve?: PlacementCurve;      // "linear" (field−rank+1) | "table" (fixed list) | "proportional" (1st=firstPlace, taper to 1) | "decay" (UDisc: N→2 over depth, 1 below). Default "linear".
  curveTable?: number[];       // "table": points by finish, e.g. [100,90,80,75,...]; ranks past the list get the participation floor.
  firstPlace?: number;         // "proportional": points for 1st; the field tapers linearly to 1.
  depthPct?: number;           // "decay": % of the field that earns curve points (rest get the floor). Default 100.
  // match play (model === "matchplay")
  matchWin?: number;           // points for a win. Default 3.
  matchTie?: number;           // points for a tie/halved match. Default 1.
  matchLoss?: number;          // points for a loss. Default 0.
}

export const DEFAULT_SCORING: Required<Pick<LeagueScoring, "model" | "view" | "aggregate" | "curve" | "matchWin" | "matchTie" | "matchLoss">> = {
  model: "placement", view: "gross", aggregate: "sum", curve: "linear", matchWin: 3, matchTie: 1, matchLoss: 0,
};

/** Placement points for a finishing position, given the field size and the league's curve config. */
export function pointsForRank(rank: number, field: number, s?: LeagueScoring): number {
  const curve = s?.curve ?? "linear";
  const floor = 1; // last-place / participation point
  if (rank < 1 || field < 1) return floor;
  switch (curve) {
    case "table": {
      const t = s?.curveTable ?? [];
      return rank <= t.length ? Math.max(floor, Math.round(t[rank - 1])) : floor;
    }
    case "proportional": {
      const first = Math.max(floor, s?.firstPlace ?? field);
      if (field <= 1) return first;
      return Math.max(floor, Math.round(first - (first - floor) * (rank - 1) / (field - 1)));
    }
    case "decay": {
      // UDisc-style: 1st = N (field size), decays to 2 at the depth line, floor below it.
      const depth = Math.max(1, Math.ceil(field * (s?.depthPct ?? 100) / 100));
      if (rank > depth) return floor;
      if (depth <= 1) return field;
      return Math.max(2, Math.round(field - (field - 2) * (rank - 1) / (depth - 1)));
    }
    case "linear":
    default:
      return Math.max(floor, field - rank + 1);
  }
}
export interface League {
  id: string;
  name: string;
  slug: string;
  kind?: string;          // container nature (EVENT_KINDS key) — "league" (recurring) vs "tournament"/one-off; drives director-console wording
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
  role: "owner" | "director" | "member"; // legacy single-role (kept in sync); owner is special
  roles?: ("player" | "admin" | "director")[]; // multi-select: a person can be a player AND admin/director
  tag?: number; // bag-tag number currently held (tag-ladder leagues)
  division?: string; // director-assigned division (league default; also stamped onto the player's event entries)
  partnerRequest?: string; // free-text: who this player asked to be paired with at signup (director-only visible)
  joinedAt: number;
}

// A season-long team (doubles/teams leagues + match play). Players sign up individually and may
// REQUEST a partner (member.partnerRequest); the DIRECTOR forms and owns the actual teams here and
// can reshuffle them any time during the season. Lives at leagues/{leagueId}/teams/{teamId}.
export interface LeagueTeam {
  id: string;
  name: string;
  memberIds: string[]; // canonical ids on this team (usually 2 for doubles; N for teams)
  createdAt: number;
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
  roundStarts?: number[]; // per-round start times (ms epoch), length === roundCount, [0] === date; set for multi-day/multi-round events
  holes: number;      // holes per round (9 / 18 / custom) — context for every score
  /**
   * IANA zone the event is actually played in (e.g. "America/New_York").
   *
   * Every instant in this contract is absolute epoch ms, so scoring locks and
   * countdowns are already correct everywhere without this. It exists purely
   * so times DISPLAY in course-local time: a player in PT reading an ET
   * tournament should see the tee sheet in ET, not in their own zone.
   *
   * Stamped from the creating director's browser, which is the event's own
   * zone in all but the travelling-director case — and correctable in the
   * event editor when it isn't. The apps tag the zone abbreviation whenever it
   * differs from the reader's, so a wrong stamp shows up rather than hiding.
   */
  timeZone?: string;
  teeGroupSize?: number;   // Tee-times events: players per group (default 4)
  teeIntervalMin?: number; // Tee-times events: minutes between groups (default 10)
  teeGenerated?: boolean;  // tee sheet has been built (auto at registration close, or manually)
  windowEndsAt?: number;   // Flex events: end of the play window (start = date). Players report by this time.
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
  registrationCloseAt?: number; // ms epoch; absent = registration closes at event start
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
  checkedInAt: number;  // when the player JOINED/registered (historical field name)
  arrivedAt?: number;   // real day-of CHECK-IN, marked by a TD/admin (only when check-ins are enabled)
  walkup?: boolean;     // director-added paper/walk-up entrant (no app account, no canonical id)
  paid?: boolean;
  cardId?: string;
  teamId?: number; // Doubles/Teams events: which team this player is on (1-based)
  // Scores: director-entered on web, or auto-attached when a player publishes a
  // round in the app (the app stamps publishedRoundId/leagueEventId/score).
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
  teeTime?: number;    // ms epoch — tee-time-start events stagger groups; absent for shotgun cards
  division?: string;   // tee-time groups are built per division
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
export interface TeamStandingRow {
  id: string;
  name: string;
  memberIds: string[];
  played: number;
  points: number;
}
export interface SeasonStandings {
  gross: StandingRow[];
  net: StandingRow[];   // net === gross when the league runs no handicaps
  teams: TeamStandingRow[];
  strokeplay?: boolean; // true when `points` holds cumulative STROKES (lower is better), not points
}

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "league";

// ---- Leagues ----

export async function createLeague(uid: string, input: { name: string; courseId?: string; courseName?: string; kind?: string; settings: LeagueSettings }): Promise<League | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const id = freshId();
  const slug = `${slugify(input.name)}-${id.slice(0, 6).toLowerCase()}`;
  const now = Date.now();
  const league: League = {
    id, name: input.name.trim(), slug, kind: input.kind || undefined,
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
    id, name: d.name ?? "League", slug: d.slug ?? id, kind: (d.kind as string) || undefined,
    courseId: d.courseId || undefined, courseName: d.courseName || undefined,
    adminIds: Array.isArray(d.adminIds) ? d.adminIds : [],
    createdById: d.createdById ?? "", createdByName: d.createdByName ?? "",
    settings: {
      format: normalizeFormat(d.settings?.format), startFormat: d.settings?.startFormat ?? "Shotgun", description: d.settings?.description ?? "",
      teamSize: Number(d.settings?.teamSize) > 0 ? Number(d.settings.teamSize) : undefined,
      divisions: Array.isArray(d.settings?.divisions) && d.settings.divisions.length ? d.settings.divisions : DEFAULT_DIVISIONS,
      bestN: Number(d.settings?.bestN) || undefined,
      handicapPercent: Number(d.settings?.handicapPercent) || undefined,
      handicapCap: Number(d.settings?.handicapCap) || undefined,
      bagTags: d.settings?.bagTags === true,
      checkIns: d.settings?.checkIns === true,
      checklistDone: Array.isArray(d.settings?.checklistDone) ? d.settings.checklistDone.filter((x: unknown) => typeof x === "string") : undefined,
      scoring: d.settings?.scoring && typeof d.settings.scoring === "object" ? d.settings.scoring as LeagueScoring : undefined,
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

/** Fetch specific leagues by id (for surfacing leagues you're a member of but don't admin). */
export async function getLeaguesByIds(ids: string[]): Promise<League[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = await Promise.all(unique.map(async (id) => {
    try { const d = await getDoc(doc(db, "leagues", id)); return d.exists() ? toLeague(d.id, d.data()) : null; } catch { return null; }
  }));
  return out.filter((l): l is League => !!l);
}

export async function getAllLeagues(max = 50): Promise<League[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagues"), orderBy("lastUpdated", "desc"), limit(max)));
    return snap.docs.map((d) => toLeague(d.id, d.data()));
  } catch { return []; }
}

export function isLeagueAdmin(league: League, cid?: string | null): boolean {
  // createdById fallback so an owner is never locked out of director tools even
  // if adminIds is ever emptied by data drift.
  return !!cid && (league.adminIds.includes(cid) || league.createdById === cid);
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

/** Set a member's role set (player / admin / director). Any admin|director role grants management (adminIds). */
export async function setMemberRoles(leagueId: string, memberId: string, roles: string[]): Promise<void> {
  const clean = [...new Set(roles.filter((r) => r === "player" || r === "admin" || r === "director"))];
  const manager = clean.includes("admin") || clean.includes("director");
  await setDoc(doc(db, "leagues", leagueId, "members", memberId), { roles: clean, role: manager ? "director" : "member" }, { merge: true });
  await updateDoc(doc(db, "leagues", leagueId), { adminIds: manager ? arrayUnion(memberId) : arrayRemove(memberId), lastUpdated: Date.now() });
}

/** Director sets a player's division — the league default (also stamped onto entries by the caller). */
export async function setMemberDivision(leagueId: string, memberId: string, division: string): Promise<void> {
  await setDoc(doc(db, "leagues", leagueId, "members", memberId), { division: division || deleteField() }, { merge: true });
}

/**
 * Add a co-director by @username — even if they haven't joined yet. Looks the user up, resolves
 * their canonical id, ensures a member record, sets role "director", and adds them to adminIds.
 * Returns the new/updated member, or null if the username isn't found.
 */
export async function addDirectorByUsername(leagueId: string, username: string): Promise<LeagueMember | null> {
  const clean = username.trim().replace(/^@/, "");
  if (!clean) return null;
  const user = await findUserByUsername(clean);
  if (!user) return null;
  const cid = await resolveCanonicalId(user.id);
  const ref = doc(db, "leagues", leagueId, "members", cid);
  const existing = await getDoc(ref);
  const now = Date.now();
  const nextRoles = [...new Set([...(Array.isArray(existing.data()?.roles) ? existing.data()!.roles : []), "director"])];
  if (existing.exists()) await setDoc(ref, { role: "director", roles: nextRoles }, { merge: true });
  else await setDoc(ref, { name: user.name || clean, username: user.username || clean, photo: user.photo || null, role: "director", roles: ["director"], joinedAt: now }, { merge: true });
  await updateDoc(doc(db, "leagues", leagueId), { adminIds: arrayUnion(cid), lastUpdated: now });
  return { id: cid, name: user.name || clean, username: user.username || clean, photo: user.photo || undefined, role: "director", roles: nextRoles as LeagueMember["roles"], joinedAt: Number(existing.data()?.joinedAt) || now };
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
          roles: Array.isArray(m.roles) ? m.roles.filter((r: unknown) => r === "player" || r === "admin" || r === "director") as LeagueMember["roles"] : undefined,
          tag: typeof m.tag === "number" ? m.tag : undefined,
          division: (m.division as string) || undefined,
          partnerRequest: (m.partnerRequest as string) || undefined,
          joinedAt: Number(m.joinedAt) || 0,
        };
      })
      .sort((a, b) => a.joinedAt - b.joinedAt);
  } catch { return []; }
}

// ---- Season teams (director-owned) ----

/** A player's own partner REQUEST at signup (free text). Visible to the director only; the director
 *  forms the real teams. Players write their own member doc; empty string clears it. */
export async function setPartnerRequest(leagueId: string, memberId: string, request: string): Promise<void> {
  await setDoc(doc(db, "leagues", leagueId, "members", memberId), { partnerRequest: request.trim() || deleteField() }, { merge: true });
}

export async function getLeagueTeams(leagueId: string): Promise<LeagueTeam[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagues", leagueId, "teams"), limit(200)));
    return snap.docs
      .map((d) => { const t = d.data(); return { id: d.id, name: (t.name as string) || "Team", memberIds: Array.isArray(t.memberIds) ? (t.memberIds as string[]) : [], createdAt: Number(t.createdAt) || 0 }; })
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch { return []; }
}

/** Live team roster — fires whenever the director edits teams. */
export function subscribeLeagueTeams(leagueId: string, cb: (teams: LeagueTeam[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "leagues", leagueId, "teams"), limit(200)),
    (snap) => cb(snap.docs.map((d) => { const t = d.data(); return { id: d.id, name: (t.name as string) || "Team", memberIds: Array.isArray(t.memberIds) ? (t.memberIds as string[]) : [], createdAt: Number(t.createdAt) || 0 }; }).sort((a, b) => a.createdAt - b.createdAt)),
    () => {}
  );
}

/** Director: create a season team. */
export async function createLeagueTeam(leagueId: string, name: string, memberIds: string[] = []): Promise<LeagueTeam> {
  const id = freshId();
  const team = { name: name.trim() || "Team", memberIds, createdAt: Date.now() };
  await setDoc(doc(db, "leagues", leagueId, "teams", id), team);
  return { id, ...team };
}

/** Director: rename a team and/or set its roster (reshuffle any time during the season). */
export async function updateLeagueTeam(leagueId: string, teamId: string, patch: { name?: string; memberIds?: string[] }): Promise<void> {
  const upd: Record<string, unknown> = {};
  if (patch.name != null) upd.name = patch.name.trim() || "Team";
  if (patch.memberIds != null) upd.memberIds = patch.memberIds;
  if (Object.keys(upd).length) await updateDoc(doc(db, "leagues", leagueId, "teams", teamId), upd);
}

/** Director: disband a team. */
export async function deleteLeagueTeam(leagueId: string, teamId: string): Promise<void> {
  await deleteDoc(doc(db, "leagues", leagueId, "teams", teamId));
}

// ---- Match play (schedule + results) ----
//
// A match-play season is a round-robin: each side (season team, or player in singles match play)
// plays every other once across the regular season, then the top seeds enter a playoff bracket.
// Sides carry a denormalized name so the schedule/standings render without extra lookups.

export interface LeagueMatch {
  id: string;
  round: number;          // 1-based week/round of the round-robin
  sideAId: string;
  sideBId: string;
  sideAName: string;
  sideBName: string;
  winnerId?: string | "tie"; // undefined = not played yet
  eventId?: string;       // the event this matchup was played at (optional link)
  bracket?: boolean;      // true = playoff bracket match (not a regular-season round-robin fixture)
  slot?: number;          // bracket seeding slot (for ordering the bracket view)
}

/** Circle-method round-robin: every id plays every other exactly once. Odd count gets a bye each
 *  round (that fixture is dropped). Returns pairings tagged with their round number. */
export function generateRoundRobin(ids: string[]): { round: number; a: string; b: string }[] {
  const arr = [...ids];
  if (arr.length < 2) return [];
  if (arr.length % 2 === 1) arr.push("__BYE__");
  const n = arr.length, rounds = n - 1, half = n / 2;
  const rot = [...arr];
  const out: { round: number; a: string; b: string }[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = rot[i], b = rot[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") out.push({ round: r + 1, a, b });
    }
    rot.splice(1, 0, rot.pop()!); // keep first fixed, rotate the rest
  }
  return out;
}

export async function getLeagueMatches(leagueId: string): Promise<LeagueMatch[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagues", leagueId, "matches"), limit(500)));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeagueMatch, "id">) })).sort((a, b) => (a.bracket === b.bracket ? (a.round - b.round || (a.slot ?? 0) - (b.slot ?? 0)) : a.bracket ? 1 : -1));
  } catch { return []; }
}

export function subscribeLeagueMatches(leagueId: string, cb: (matches: LeagueMatch[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "leagues", leagueId, "matches"), limit(500)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeagueMatch, "id">) })).sort((a, b) => (a.bracket === b.bracket ? (a.round - b.round || (a.slot ?? 0) - (b.slot ?? 0)) : a.bracket ? 1 : -1))),
    () => {}
  );
}

/** Director: build the regular-season round-robin schedule from a set of sides ({id,name}).
 *  Replaces any existing NON-bracket matches (bracket matches are left intact). */
export async function generateSchedule(leagueId: string, sides: { id: string; name: string }[]): Promise<number> {
  const nameOf = new Map(sides.map((s) => [s.id, s.name]));
  const existing = await getLeagueMatches(leagueId);
  await Promise.all(existing.filter((m) => !m.bracket).map((m) => deleteDoc(doc(db, "leagues", leagueId, "matches", m.id))));
  const pairs = generateRoundRobin(sides.map((s) => s.id));
  await Promise.all(pairs.map((p) => {
    const id = freshId();
    return setDoc(doc(db, "leagues", leagueId, "matches", id), { round: p.round, sideAId: p.a, sideBId: p.b, sideAName: nameOf.get(p.a) ?? "—", sideBName: nameOf.get(p.b) ?? "—" });
  }));
  return pairs.length;
}

/** Director: set (or clear) a match result. winnerId = a side id, "tie", or null to reset. */
export async function setMatchResult(leagueId: string, matchId: string, winnerId: string | "tie" | null): Promise<void> {
  await setDoc(doc(db, "leagues", leagueId, "matches", matchId), { winnerId: winnerId ?? deleteField() }, { merge: true });
}

export interface MatchStandingRow { id: string; name: string; wins: number; ties: number; losses: number; played: number; points: number; }

/** Match-play standings from played results: W/T/L × the league's match points (default 3/1/0). */
export function computeMatchStandings(matches: LeagueMatch[], scoring?: LeagueScoring): MatchStandingRow[] {
  const win = scoring?.matchWin ?? 3, tie = scoring?.matchTie ?? 1, loss = scoring?.matchLoss ?? 0;
  const nameOf = new Map<string, string>();
  const rec = new Map<string, { w: number; t: number; l: number }>();
  const bump = (id: string, k: "w" | "t" | "l") => { const r = rec.get(id) ?? { w: 0, t: 0, l: 0 }; r[k]++; rec.set(id, r); };
  for (const m of matches) {
    if (m.bracket) continue; // bracket matches don't feed the season table
    nameOf.set(m.sideAId, m.sideAName); nameOf.set(m.sideBId, m.sideBName);
    if (m.winnerId == null) continue;
    if (m.winnerId === "tie") { bump(m.sideAId, "t"); bump(m.sideBId, "t"); }
    else { const l = m.winnerId === m.sideAId ? m.sideBId : m.sideAId; bump(m.winnerId, "w"); bump(l, "l"); }
  }
  return [...rec.entries()]
    .map(([id, r]) => ({ id, name: nameOf.get(id) ?? "—", wins: r.w, ties: r.t, losses: r.l, played: r.w + r.t + r.l, points: r.w * win + r.t * tie + r.l * loss }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins);
}

/** Director: seed a single-elimination playoff bracket from the top seeds (best first). Uses the
 *  largest power of two that fits (≤ size, ≤ seeds), pairs 1×N, 2×(N−1)… as round-1 bracket matches.
 *  Replaces any existing bracket. */
export async function generateBracket(leagueId: string, seeds: { id: string; name: string }[], size = 8): Promise<number> {
  let bs = 2; while (bs * 2 <= Math.min(size, seeds.length)) bs *= 2;
  if (bs > seeds.length) bs = 2;
  const top = seeds.slice(0, bs);
  const existing = await getLeagueMatches(leagueId);
  await Promise.all(existing.filter((m) => m.bracket).map((m) => deleteDoc(doc(db, "leagues", leagueId, "matches", m.id))));
  const writes: Promise<void>[] = [];
  for (let i = 0; i < bs / 2; i++) {
    const a = top[i], b = top[bs - 1 - i], id = freshId();
    writes.push(setDoc(doc(db, "leagues", leagueId, "matches", id), { round: 1, slot: i, bracket: true, sideAId: a.id, sideBId: b.id, sideAName: a.name, sideBName: b.name }));
  }
  await Promise.all(writes);
  return bs;
}

/** Director: build the next bracket round from the current round's winners (must all be decided,
 *  no ties). Returns false if the bracket is already at the final or the round isn't complete. */
export async function advanceBracket(leagueId: string): Promise<boolean> {
  const br = (await getLeagueMatches(leagueId)).filter((m) => m.bracket);
  if (!br.length) return false;
  const maxRound = Math.max(...br.map((m) => m.round));
  const cur = br.filter((m) => m.round === maxRound).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  if (cur.length <= 1) return false; // final already exists
  if (cur.some((m) => !m.winnerId || m.winnerId === "tie")) return false; // not all decided
  const winners = cur.map((m) => (m.winnerId === m.sideAId ? { id: m.sideAId, name: m.sideAName } : { id: m.sideBId, name: m.sideBName }));
  const writes: Promise<void>[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i], b = winners[i + 1], id = freshId();
    writes.push(setDoc(doc(db, "leagues", leagueId, "matches", id), { round: maxRound + 1, slot: i / 2, bracket: true, sideAId: a.id, sideBId: b.id, sideAName: a.name, sideBName: b.name }));
  }
  await Promise.all(writes);
  return true;
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

/** True for a zone identifier this platform actually recognises. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz.trim()) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** The creating browser's IANA zone, or undefined where Intl can't say. */
function localTimeZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
}

export async function createEvents(uid: string, league: League, input: { name: string; dates: number[]; roundStarts?: number[]; courseId?: string; courseName?: string; format?: string; startFormat?: string; roundCount?: number; holes?: number; capacity?: number; buyIn?: number; kind?: string; isPrivate?: boolean; description?: string; contactEmail?: string; contactPhone?: string; extras?: string[]; focus?: string; skillLevel?: string; durationMin?: number; bring?: string; workList?: string[]; meetingPoint?: string; payoutPlaces?: number; registrationCloseOffsetMin?: number; timeZone?: string }): Promise<LeagueEvent[]> {
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
      // Per-round start times only when the director scheduled a multi-round event with distinct rounds.
      roundStarts: input.roundStarts && input.roundStarts.length > 1
        ? [date, ...input.roundStarts.slice(1)].slice(0, Math.max(1, Math.min(input.roundCount ?? 1, 6)))
        : undefined,
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
      registrationCloseAt: input.registrationCloseOffsetMin ? date - input.registrationCloseOffsetMin * 60_000 : undefined,
      timeZone: input.timeZone || localTimeZone(),
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
    roundStarts: Array.isArray(d.roundStarts) && d.roundStarts.length > 1 ? d.roundStarts.map((x: unknown) => Number(x) || 0) : undefined,
    holes: Number(d.holes) > 0 ? Number(d.holes) : 18,
    timeZone: typeof d.timeZone === "string" && d.timeZone ? d.timeZone : undefined,
    teeGroupSize: Number(d.teeGroupSize) > 0 ? Number(d.teeGroupSize) : undefined,
    teeIntervalMin: Number(d.teeIntervalMin) > 0 ? Number(d.teeIntervalMin) : undefined,
    teeGenerated: d.teeGenerated === true,
    windowEndsAt: Number(d.windowEndsAt) > 0 ? Number(d.windowEndsAt) : undefined,
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
    registrationCloseAt: Number(d.registrationCloseAt) > 0 ? Number(d.registrationCloseAt) : undefined,
    buyIn: Number(d.buyIn) > 0 ? Number(d.buyIn) : undefined,
    kind: (d.kind as string) || undefined,
    isPrivate: d.isPrivate === true,
    description: (d.description as string) || undefined,
    contactEmail: (d.contactEmail as string) || undefined,
    contactPhone: (d.contactPhone as string) || undefined,
    entryCount: Number(d.entryCount) || 0, createdAt: Number(d.createdAt) || 0,
  };
}

/** Director event editor: patch the core details of an existing event (name, date, rounds, holes, money…). */
export async function updateEventDetails(eventId: string, patch: {
  name?: string; date?: number; roundStarts?: number[] | null; roundCount?: number; holes?: number;
  buyIn?: number | null; capacity?: number | null; format?: string; startFormat?: string; courseName?: string;
  registrationCloseAt?: number | null; teeGroupSize?: number; teeIntervalMin?: number; windowEndsAt?: number | null;
  timeZone?: string;
}): Promise<void> {
  const upd: Record<string, unknown> = {};
  if (patch.format !== undefined) upd.format = patch.format;
  if (patch.windowEndsAt !== undefined) upd.windowEndsAt = patch.windowEndsAt && patch.windowEndsAt > 0 ? patch.windowEndsAt : deleteField();
  if (patch.name !== undefined) upd.name = patch.name.trim() || "Event";
  if (patch.date !== undefined) upd.date = patch.date;
  if (patch.roundStarts !== undefined) upd.roundStarts = patch.roundStarts && patch.roundStarts.length > 1 ? patch.roundStarts : deleteField();
  if (patch.roundCount !== undefined) upd.roundCount = Math.max(1, Math.min(patch.roundCount, 6));
  if (patch.holes !== undefined) upd.holes = Math.max(1, Math.min(patch.holes, 36));
  if (patch.buyIn !== undefined) upd.buyIn = patch.buyIn && patch.buyIn > 0 ? patch.buyIn : deleteField();
  if (patch.capacity !== undefined) upd.capacity = patch.capacity && patch.capacity > 0 ? Math.floor(patch.capacity) : deleteField();
  if (patch.startFormat !== undefined) upd.startFormat = patch.startFormat;
  if (patch.courseName !== undefined) upd.courseName = patch.courseName;
  if (patch.registrationCloseAt !== undefined) upd.registrationCloseAt = patch.registrationCloseAt && patch.registrationCloseAt > 0 ? patch.registrationCloseAt : deleteField();
  if (patch.teeGroupSize !== undefined) upd.teeGroupSize = Math.max(2, Math.min(patch.teeGroupSize, 6));
  if (patch.teeIntervalMin !== undefined) upd.teeIntervalMin = Math.max(1, Math.min(patch.teeIntervalMin, 60));
  // Validated against the platform's own zone list — a typo'd zone would make
  // every client silently fall back to the reader's clock.
  if (patch.timeZone !== undefined && isValidTimeZone(patch.timeZone)) upd.timeZone = patch.timeZone;
  if (Object.keys(upd).length) await updateDoc(doc(db, "leagueEvents", eventId), upd);
}

/** Director event-config tweaks (add a round, set the buy-in). */
export async function updateEventConfig(eventId: string, patch: { roundCount?: number; buyIn?: number | null }): Promise<void> {
  const upd: Record<string, unknown> = {};
  if (patch.roundCount != null) upd.roundCount = Math.max(1, Math.min(patch.roundCount, 6));
  if (patch.buyIn !== undefined) upd.buyIn = patch.buyIn && patch.buyIn > 0 ? patch.buyIn : deleteField();
  await updateDoc(doc(db, "leagueEvents", eventId), upd);
}

/** Set per-round start times for a multi-round event. roundStarts[0] becomes the event's canonical date. */
export async function updateEventSchedule(eventId: string, roundStarts: number[]): Promise<void> {
  const cleaned = roundStarts.map((x) => Number(x) || 0).filter((x) => x > 0);
  if (!cleaned.length) return;
  const upd: Record<string, unknown> = { date: cleaned[0] };
  upd.roundStarts = cleaned.length > 1 ? cleaned : deleteField();
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

/** Discovery "Past": recently COMPLETED public events across all leagues, newest first (results archive). */
export async function getPastEvents(max = 80): Promise<LeagueEvent[]> {
  try {
    const cutoff = Date.now() - 12 * 3600_000;
    const snap = await getDocs(query(collection(db, "leagueEvents"), where("date", "<", cutoff), orderBy("date", "desc"), limit(max)));
    return snap.docs.map((d) => toEvent(d.id, d.data())).filter((e) => e.status === "complete" && !e.isPrivate);
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

/** Registration window: absent registrationCloseAt means it closes at event start. */
export function registrationOpen(event: LeagueEvent, nowMs = Date.now()): boolean {
  return nowMs < (event.registrationCloseAt ?? event.date);
}

export async function checkIn(uid: string, event: LeagueEvent, division?: string): Promise<EventEntry | null> {
  if (!registrationOpen(event)) throw new Error("Registration is closed for this event.");
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

/** Synthetic-id prefix for director-added walk-up entrants — keeps them off the
 *  canonical-id keyspace so the app's live-score mirror never targets them. */
const WALKUP_PREFIX = "walkup_";
export const isWalkup = (id: string): boolean => id.startsWith(WALKUP_PREFIX);

/** Director adds a paper / walk-up player who isn't on the app. Creates an entry
 *  under a synthetic id (never a canonical id) that the director scores by hand.
 *  Not tied to any account and never joined to the league roster. */
export async function addWalkupEntry(event: LeagueEvent, name: string, division?: string): Promise<EventEntry | null> {
  const clean = name.trim();
  if (!clean) return null;
  const id = `${WALKUP_PREFIX}${freshId()}`;
  const now = Date.now();
  await setDoc(doc(db, "leagueEvents", event.id, "entries", id), {
    name: clean, walkup: true, division: division || null, checkedInAt: now,
  }, { merge: true });
  const entries = await getEntries(event.id);
  await setDoc(doc(db, "leagueEvents", event.id), { entryCount: entries.length }, { merge: true });
  return { id, name: clean, walkup: true, division, checkedInAt: now };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEntry(id: string, e: any): EventEntry {
  return {
    id, name: (e.name ?? "Player") as string, username: (e.username as string) || undefined,
    photo: (e.photo as string) || undefined, division: (e.division as string) || undefined,
    checkedInAt: Number(e.checkedInAt) || 0, arrivedAt: Number(e.arrivedAt) > 0 ? Number(e.arrivedAt) : undefined, walkup: e.walkup === true || id.startsWith("walkup_"),
    paid: e.paid === true,
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

/** Director marks a player arrived (day-of check-in) or clears it. `at` lets the caller stamp a shared timestamp. */
export async function checkInEntry(eventId: string, entryId: string, arrived: boolean, at?: number): Promise<void> {
  await updateDoc(doc(db, "leagueEvents", eventId, "entries", entryId), { arrivedAt: arrived ? (at ?? Date.now()) : deleteField() });
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

/**
 * Group generator for every start format. Splits entries BY DIVISION, chunks each into groups of
 * `size` (divisions in `divisions` order, unlisted last), and assigns starts by format:
 *   • "Tee times" → staggered tee times (`intervalMin` apart from `startMs`), all off hole 1
 *   • "Shotgun"   → every group tees at once, spread across the course's holes
 *   • "Flex"      → just groupings, no hole/time
 * Replaces the whole card set.
 */
export async function generateGroups(eventId: string, entries: EventEntry[], opts: { format: string; size?: number; intervalMin?: number; startMs?: number; divisions?: string[]; holeCount?: number }): Promise<EventCard[]> {
  const size = Math.max(1, opts.size ?? 4);
  const interval = Math.max(1, opts.intervalMin ?? 10) * 60_000;
  const start = opts.startMs && opts.startMs > 0 ? opts.startMs : Date.now();
  const holeCount = Math.max(1, opts.holeCount ?? 18);
  const order = opts.divisions ?? [];
  const byDiv = new Map<string, EventEntry[]>();
  for (const e of entries) { const d = e.division || ""; if (!byDiv.has(d)) byDiv.set(d, []); byDiv.get(d)!.push(e); }
  const divKeys = [...byDiv.keys()].sort((a, b) => {
    const ia = order.indexOf(a) === -1 ? 999 : order.indexOf(a);
    const ib = order.indexOf(b) === -1 ? 999 : order.indexOf(b);
    return ia !== ib ? ia - ib : a.localeCompare(b);
  });
  const cards: EventCard[] = [];
  let slot = 0;
  for (const d of divKeys) {
    const group = byDiv.get(d)!;
    for (let i = 0; i < group.length; i += size) {
      // Shotgun: one group per hole; when groups exceed holes, wrap into A/B/C waves on the same holes.
      const startHole = opts.format === "Shotgun" ? (slot % holeCount) + 1 : 1;
      const teeTime = opts.format === "Tee times" ? start + slot * interval : undefined;
      cards.push({ id: freshId(), number: cards.length + 1, startHole, teeTime, division: d || undefined, playerIds: group.slice(i, i + size).map((e) => e.id) });
      slot++;
    }
  }
  const old = await getCards(eventId);
  await Promise.all(old.map((c) => setDoc(doc(db, "leagueEvents", eventId, "cards", c.id), { deleted: true }, { merge: true })));
  for (const c of cards) {
    await setDoc(doc(db, "leagueEvents", eventId, "cards", c.id), { number: c.number, startHole: c.startHole, teeTime: c.teeTime ?? null, division: c.division ?? null, playerIds: c.playerIds, deleted: false }, { merge: true });
    await Promise.all(c.playerIds.map((pid) => setDoc(doc(db, "leagueEvents", eventId, "entries", pid), { cardId: c.id }, { merge: true })));
  }
  await setDoc(doc(db, "leagueEvents", eventId), { teeGenerated: true, teeGroupSize: size, teeIntervalMin: (opts.intervalMin ?? 10) }, { merge: true });
  return cards;
}

/** Back-compat wrapper — tee-times generation. */
export async function generateTeeTimes(eventId: string, entries: EventEntry[], opts?: { size?: number; intervalMin?: number; startMs?: number; divisions?: string[] }): Promise<EventCard[]> {
  return generateGroups(eventId, entries, { ...opts, format: "Tee times" });
}

/** Director edit: change a single group's tee time. */
export async function setCardTeeTime(eventId: string, cardId: string, teeTime: number): Promise<void> {
  await setDoc(doc(db, "leagueEvents", eventId, "cards", cardId), { teeTime }, { merge: true });
}

/** Director edit: change a single group's shotgun start hole. */
export async function setCardStartHole(eventId: string, cardId: string, hole: number): Promise<void> {
  await setDoc(doc(db, "leagueEvents", eventId, "cards", cardId), { startHole: Math.max(1, Math.floor(hole)) }, { merge: true });
}

/** Director edit: move a player from their current group into another group. */
export async function moveEntryToCard(eventId: string, entryId: string, toCardId: string): Promise<void> {
  const cards = await getCards(eventId);
  const to = cards.find((c) => c.id === toCardId);
  const from = cards.find((c) => c.playerIds.includes(entryId));
  if (!to || from?.id === toCardId) return;
  if (from) await setDoc(doc(db, "leagueEvents", eventId, "cards", from.id), { playerIds: from.playerIds.filter((p) => p !== entryId) }, { merge: true });
  await setDoc(doc(db, "leagueEvents", eventId, "cards", toCardId), { playerIds: [...to.playerIds, entryId] }, { merge: true });
  await setDoc(doc(db, "leagueEvents", eventId, "entries", entryId), { cardId: toCardId }, { merge: true });
}

export async function getCards(eventId: string): Promise<EventCard[]> {
  try {
    const snap = await getDocs(query(collection(db, "leagueEvents", eventId, "cards"), limit(60)));
    return snap.docs
      .map((d) => {
        const c = d.data();
        return c.deleted === true ? null : { id: d.id, number: Number(c.number) || 0, startHole: Number(c.startHole) || 1, teeTime: Number(c.teeTime) > 0 ? Number(c.teeTime) : undefined, division: (c.division as string) || undefined, playerIds: Array.isArray(c.playerIds) ? c.playerIds : [] } as EventCard;
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
    // Walk-ups have no roster identity — hold the tag only on this event's entry,
    // never create a phantom member doc for them.
    if (!isWalkup(e.id)) await setDoc(doc(db, "leagues", league.id, "members", e.id), { tag: to }, { merge: true });
    await setDoc(doc(db, "leagueEvents", eventId, "entries", e.id), { tag: to }, { merge: true });
  }
  return changes;
}

/** The league's latest event that has any scores — the "current leaderboard". */
export function latestScoredEvent(events: LeagueEvent[]): LeagueEvent | undefined {
  // Prefer a currently-LIVE event (started, not complete, has scored entries would
  // be ideal but we only have the doc here — use the time window) so the league
  // page's "Latest leaderboard" shows tonight's in-progress board; else the most
  // recent completed/active event. Nothing ever writes status "active", so the
  // live check is by time window, matching the discovery "live" rule.
  const now = Date.now();
  const live = [...events].reverse().find((e) => e.status === "scheduled" && e.date <= now && now <= e.date + 6 * 3600_000 && e.entryCount > 0);
  return live ?? [...events].reverse().find((e) => e.status === "complete" || e.status === "active");
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
/** Number of holes on a course (from its hole/layout data), or null if unknown. Powers shotgun spread. */
export async function getCourseHoleCount(courseId: string): Promise<number | null> {
  const holes = await getCourseHoles(courseId);
  return holes && holes.length ? holes.length : null;
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

/**
 * Points each player earns from ONE event (placement model). Ranks by adjusted score
 * (lower = better); `net` includes the handicap startingScore, gross does not. Points come
 * from the league's placement curve (pointsForRank), scaled by field size. TIES share the
 * averaged points for the positions they span, floored (matches UDisc/Metrix). DNF / no-score
 * but checked-in = the participation floor (1). Default (no opts) = net + linear = original behavior.
 */
export function eventPoints(entries: EventEntry[], opts?: { net?: boolean; scoring?: LeagueScoring }): Map<string, number> {
  const net = opts?.net ?? true;
  const scoring = opts?.scoring;
  const adj = (e: EventEntry) => e.score! + (e.penalty ?? 0) + (net ? (e.startingScore ?? 0) : 0);
  const ranked = entries.filter((e) => typeof e.score === "number" && !e.dnf).sort((a, b) => adj(a) - adj(b));
  const field = entries.length; // curve scales by who showed up (matches UDisc's N)
  const out = new Map<string, number>();
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && adj(ranked[j + 1]) === adj(ranked[i])) j++; // tie group [i..j]
    let sum = 0;
    for (let r = i + 1; r <= j + 1; r++) sum += pointsForRank(r, field, scoring); // 1-based ranks
    const shared = Math.floor(sum / (j - i + 1));
    for (let k = i; k <= j; k++) out.set(ranked[k].id, shared);
    i = j + 1;
  }
  for (const e of entries) if (!out.has(e.id) && e.checkedInAt) out.set(e.id, 1); // participation floor
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

/**
 * Full season table honoring the league's scoring config: individual GROSS + NET races and the
 * TEAM race (from Doubles/Teams events, grouped by the season LeagueTeam roster). The display
 * surface renders whichever `settings.scoring.view` selects (gross / net / both) plus teams when
 * any exist. Compute-only (doesn't persist). Gross === net for leagues with no handicaps.
 */
export async function computeSeasonStandings(league: League): Promise<SeasonStandings> {
  const scoring = league.settings.scoring;
  const bestN = league.settings.bestN;
  const strokeplay = scoring?.model === "strokeplay"; // rank by cumulative STROKES (lowest wins), not points
  const events = (await getLeagueEvents(league.id)).filter((e) => e.status === "complete");
  const teams = await getLeagueTeams(league.id);
  const teamOf = new Map<string, LeagueTeam>();
  for (const t of teams) for (const mid of t.memberIds) teamOf.set(mid, t);

  type Acc = { name: string; division?: string; eventPts: number[]; bestToPar?: number };
  const grossAcc = new Map<string, Acc>(), netAcc = new Map<string, Acc>(), teamPts = new Map<string, number[]>();
  const accInto = (map: Map<string, Acc>, e: EventEntry, val: number, counts: boolean) => {
    const a = map.get(e.id) ?? { name: e.name, eventPts: [] };
    if (counts) a.eventPts.push(val);
    if (e.division) a.division = e.division;
    if (typeof e.scoreToPar === "number") a.bestToPar = a.bestToPar == null ? e.scoreToPar : Math.min(a.bestToPar, e.scoreToPar);
    map.set(e.id, a);
  };

  for (const ev of events) {
    const entries = await getEntries(ev.id);
    if (strokeplay) {
      // Cumulative strokes: gross = score + penalty; net also applies the per-event handicap (startingScore).
      for (const e of entries) {
        const scored = typeof e.score === "number" && !e.dnf;
        const gross = scored ? e.score! + (e.penalty ?? 0) : 0;
        accInto(grossAcc, e, gross, scored);
        accInto(netAcc, e, scored ? gross + (e.startingScore ?? 0) : 0, scored);
      }
    } else {
      const g = eventPoints(entries, { net: false, scoring });
      const n = eventPoints(entries, { net: true, scoring });
      for (const e of entries) { accInto(grossAcc, e, g.get(e.id) ?? 0, true); accInto(netAcc, e, n.get(e.id) ?? 0, true); }
    }
    // Team race: only Doubles/Teams events. A team's event score = the (shared/best) score of its members.
    if (ev.format === "Doubles" || ev.format === "Teams") {
      const scoreByTeam = new Map<string, number>();
      for (const e of entries) {
        const t = teamOf.get(e.id);
        if (!t || typeof e.score !== "number" || e.dnf) continue;
        const s = e.score + (e.penalty ?? 0);
        if (!scoreByTeam.has(t.id) || s < scoreByTeam.get(t.id)!) scoreByTeam.set(t.id, s);
      }
      if (strokeplay) {
        for (const [tid, s] of scoreByTeam) { const arr = teamPts.get(tid) ?? []; arr.push(s); teamPts.set(tid, arr); }
      } else {
        const ranked = [...scoreByTeam.entries()].sort((a, b) => a[1] - b[1]);
        const field = ranked.length;
        let i = 0;
        while (i < ranked.length) {
          let j = i; while (j + 1 < ranked.length && ranked[j + 1][1] === ranked[i][1]) j++;
          let sum = 0; for (let r = i + 1; r <= j + 1; r++) sum += pointsForRank(r, field, scoring);
          const shared = Math.floor(sum / (j - i + 1));
          for (let k = i; k <= j; k++) { const arr = teamPts.get(ranked[k][0]) ?? []; arr.push(shared); teamPts.set(ranked[k][0], arr); }
          i = j + 1;
        }
      }
    }
  }

  // Points: keep the best N (highest), total descending. Strokeplay: keep the best N (lowest), total ascending.
  const total = (vals: number[]) => {
    const counted = bestN && bestN > 0 ? [...vals].sort((a, b) => (strokeplay ? a - b : b - a)).slice(0, bestN) : vals;
    return counted.reduce((a, b) => a + b, 0);
  };
  const rank = <T extends { points: number }>(rows: T[]) => rows.sort((a, b) => (strokeplay ? a.points - b.points : b.points - a.points));
  const build = (map: Map<string, Acc>): StandingRow[] =>
    rank([...map.entries()]
      .map(([id, p]) => ({ id, name: p.name, division: p.division, played: p.eventPts.length, points: total(p.eventPts), bestToPar: p.bestToPar }))
      .filter((r) => r.played > 0));
  const teamRows: TeamStandingRow[] = rank(teams.map((t) => {
    const pts = teamPts.get(t.id) ?? [];
    return { id: t.id, name: t.name, memberIds: t.memberIds, played: pts.length, points: total(pts) };
  }).filter((t) => t.played > 0));

  return { gross: build(grossAcc), net: build(netAcc), teams: teamRows, strokeplay };
}
