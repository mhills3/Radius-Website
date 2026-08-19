import { db } from "./firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  startAt,
  endAt,
  limit,
  documentId,
  updateDoc,
  setDoc,
  DocumentData,
} from "firebase/firestore";
import { resolveCanonicalId, getProfileLite, getOwnedIds } from "./account";

/** Total mapped-course count. Delegates to getTotalCourseCount (reliable REST aggregation) so every
 * "Courses mapped" figure across the site shows the SAME number, even on mobile Safari where the
 * client SDK aggregation transport silently fails. */
export async function getCourseCount(): Promise<number> {
  return getTotalCourseCount();
}

export interface CourseHole {
  holeNumber: number;
  par: number;
  distance: number;
  handicap?: number;
  holeType?: string;
  elevation?: string;
  fairwayShape?: string;
  teeLat?: number;
  teeLng?: number;
  basketLat?: number;
  basketLng?: number;
}

export interface CourseReview {
  author: string;
  rating: number;
  text: string;
  date: number;
}

export interface CourseLayout {
  id: string;
  name: string;
  holeCount: number;
  description?: string;
  holes: CourseHole[];
  par: number;
  distanceFt: number;
}

export interface Course {
  id: string;
  name: string;
  city: string;
  state: string;
  holeCount: number;
  par: number;
  distanceFt: number;
  description: string;
  courseType: string;
  plannedCourseType?: string; // for drafts: the real type to show/restore (draft courseType is forced to "Private")
  terrain: string;
  amenities: string[];
  isFree: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  coverPhotoUrl?: string;
  galleryPhotoUrls?: string[];
  communityAverage?: number;
  communityScoreCount?: number;
  rating?: number;
  reviewCount?: number;
  manualDifficulty?: string;
  courseFeeAmount?: number;
  reviews?: CourseReview[];
  layouts?: CourseLayout[];
  layoutAverages?: Record<string, number>;
  dateCreated?: number;
  latitude?: number;
  longitude?: number;
  holes: CourseHole[];
  createdBy: string;
  createdById: string;
  reviewStatus: string;
  isDraft?: boolean;
  defaultLayoutName?: string;
  lastModified: number;
  hiddenPlayerIds?: string[]; // canonical uids the owner has hidden from this course's records/leaderboard
}

/**
 * Whether a course should appear in the PUBLIC directory. Matches the apps' hide rules so web
 * stays consistent: iOS hides reviewStatus=="Draft", Android hides isDraft==true. Hide drafts /
 * pending / rejected / removed; SHOW everything else — including the ~339 legacy courses with no
 * reviewStatus. "removed" is the staff soft-delete (isDraft + reviewStatus "removed") — it keeps the
 * doc so existing rounds resolve, but the course must leave the map/directory/sitemap for everyone.
 */
export function isPubliclyListed(c: { reviewStatus?: string; isDraft?: boolean }): boolean {
  if (c.isDraft === true) return false;
  const rs = (c.reviewStatus || "").trim().toLowerCase();
  return rs !== "draft" && rs !== "pending" && rs !== "rejected" && rs !== "removed";
}

/**
 * A PRIVATE course (courseType == "Private") is discoverable ONLY by its creator — it must never
 * appear in the public directory, on the map, or in the sitemap for anyone else. This mirrors the
 * apps exactly: iOS fetchAllCourseLocations and Android refreshAllUserCourses both drop courses
 * where courseType == "Private" unless the viewer owns them.
 */
export function isPrivateCourse(c: { courseType?: string }): boolean {
  return (c.courseType || "").trim().toLowerCase() === "private";
}

/** Whether `ownerIds` (a user's linked ids from getOwnedIds) includes this course's creator. */
export function isOwnedBy(c: { createdById?: string }, ownerIds?: Set<string> | null): boolean {
  return !!ownerIds && !!c.createdById && ownerIds.has(c.createdById);
}

export interface CourseScore {
  playerId: string;
  playerName: string;
  username: string;
  courseId: string;
  courseName: string;
  relativeToPar: number;
  holesPlayed: number;
  gameIQ: number;
  date: number;
  layoutName?: string;
  playerUid?: string;
  playerHandle?: string;
  id?: string;            // score doc id
  canonicalUid?: string;  // player's canonical id (alias logins collapse to this) — used for moderation
}

// Some courses store hole tee/basket coordinates but NO explicit `distance` — the apps compute it
// from the tee→elbows→basket geometry. Mirror that so hole distances render everywhere.
function holeGeoDistanceFt(h: DocumentData): number {
  const t0 = h?.teeLat, t1 = h?.teeLng, b0 = h?.basketLat, b1 = h?.basketLng;
  if ([t0, t1, b0, b1].some((n) => typeof n !== "number")) return 0;
  const pts: [number, number][] = [[t0, t1]];
  if (Array.isArray(h.elbows)) for (const e of h.elbows) { const lat = e?.lat, lng = e?.lng; if (typeof lat === "number" && typeof lng === "number") pts.push([lat, lng]); }
  pts.push([b0, b1]);
  let d = 0;
  for (let i = 0; i < pts.length - 1; i++) d += distanceFt(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  return d;
}

export function docToCourse(id: string, data: DocumentData): Course {
  return {
    id,
    name: data.name ?? "",
    city: data.city ?? "",
    state: data.state ?? "",
    holeCount: data.holeCount ?? 0,
    par: data.par ?? 0,
    distanceFt: data.distanceFt ?? 0,
    description: data.description ?? "",
    courseType: data.courseType ?? "",
    plannedCourseType: data.plannedCourseType ?? undefined,
    terrain: data.terrain ?? "",
    amenities: data.amenities ?? [],
    isFree: data.isFree ?? true,
    isPublic: data.isPublic ?? true,
    isFeatured: data.isFeatured ?? false,
    coverPhotoUrl: typeof data.coverPhotoUrl === "string" && /^https?:\/\//.test(data.coverPhotoUrl) ? data.coverPhotoUrl : undefined,
    galleryPhotoUrls: data.galleryPhotoUrls,
    communityAverage: data.communityAverage,
    communityScoreCount: data.communityScoreCount,
    rating: data.rating,
    reviewCount: data.reviewCount,
    manualDifficulty: data.manualDifficulty,
    courseFeeAmount: data.courseFeeAmount,
    latitude: data.latitude,
    longitude: data.longitude,
    holes: (data.holes ?? []).map((h: DocumentData, i: number) => ({
      holeNumber: h.holeNumber ?? h.number ?? i + 1,
      par: h.par ?? 3,
      distance: (typeof h.distance === "number" && h.distance > 0) ? h.distance : holeGeoDistanceFt(h),
      handicap: h.handicap,
      holeType: h.holeType,
      elevation: h.elevation,
      fairwayShape: h.fairwayShape,
      teeLat: typeof h.teeLat === "number" ? h.teeLat : undefined,
      teeLng: typeof h.teeLng === "number" ? h.teeLng : undefined,
      basketLat: typeof h.basketLat === "number" ? h.basketLat : undefined,
      basketLng: typeof h.basketLng === "number" ? h.basketLng : undefined,
    })),
    layouts: Array.isArray(data.layouts)
      ? data.layouts.map((l: DocumentData) => {
          const holes: CourseHole[] = (l.holes ?? []).map((h: DocumentData, i: number) => ({
            holeNumber: h.number ?? h.holeNumber ?? i + 1,
            par: h.par ?? 3,
            distance: (typeof h.distance === "number" && h.distance > 0) ? h.distance : holeGeoDistanceFt(h),
            holeType: h.holeType,
            elevation: h.elevation,
            fairwayShape: h.fairwayShape,
            teeLat: typeof h.teeLat === "number" ? h.teeLat : undefined,
            teeLng: typeof h.teeLng === "number" ? h.teeLng : undefined,
            basketLat: typeof h.basketLat === "number" ? h.basketLat : undefined,
            basketLng: typeof h.basketLng === "number" ? h.basketLng : undefined,
          })).sort((a: CourseHole, b: CourseHole) => a.holeNumber - b.holeNumber);
          return {
            id: (l.id as string) ?? "",
            name: (l.name as string) ?? "Layout",
            holeCount: (l.holeCount as number) ?? holes.length,
            description: l.description as string | undefined,
            holes,
            par: holes.reduce((s, h) => s + h.par, 0),
            distanceFt: holes.reduce((s, h) => s + (h.distance || 0), 0),
          };
        })
      : undefined,
    layoutAverages: data.layoutAverages && typeof data.layoutAverages === "object" ? data.layoutAverages : undefined,
    reviews: Array.isArray(data.reviews)
      ? data.reviews.map((r: DocumentData) => ({
          author: r.authorName ?? r.author ?? r.username ?? "Player",
          rating: Number(r.rating) || 0,
          text: r.text ?? r.comment ?? r.review ?? "",
          date: r.date ?? r.createdAt ?? 0,
        })).filter((r: CourseReview) => r.text || r.rating)
      : undefined,
    createdBy: data.createdBy ?? "",
    createdById: data.createdById ?? "",
    reviewStatus: data.reviewStatus ?? "",
    isDraft: data.isDraft === true,
    defaultLayoutName: typeof data.defaultLayoutName === "string" ? data.defaultLayoutName : undefined,
    lastModified: data.lastModified ?? 0,
    dateCreated: normMs(data.dateCreated ?? data.lastModified),
    hiddenPlayerIds: Array.isArray(data.hiddenPlayerIds) ? (data.hiddenPlayerIds as string[]) : [],
  };
}

/** Owner-only: set the list of canonical player ids hidden from this course's records + leaderboard. */
export async function setHiddenPlayers(uid: string, courseId: string, hiddenPlayerIds: string[]): Promise<boolean> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDoc(doc(db, "courses", courseId));
    if (!snap.exists() || (snap.data().createdById as string) !== cid) return false;
    await updateDoc(doc(db, "courses", courseId), { hiddenPlayerIds, lastModified: Date.now() });
    return true;
  } catch {
    return false;
  }
}

// ms | unix-seconds | Swift reference-date seconds (2001) → ms
function normMs(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  if (n > 1e12) return n;
  if (n > 1e9) return n * 1000;
  if (n > 1e7) return (n + 978307200) * 1000;
  return 0;
}

// Firestore REST typed value → plain JS (matches the SDK doc shape docToCourse expects).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function restValue(v: any): any {
  if (v == null) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return undefined;
  if ("timestampValue" in v) return Date.parse(v.timestampValue);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(restValue);
  if ("mapValue" in v) {
    const o: Record<string, unknown> = {};
    for (const [k, mv] of Object.entries(v.mapValue.fields ?? {})) o[k] = restValue(mv);
    return o;
  }
  return undefined;
}

// The lightweight fields the directory / hero lists / map pins actually render — every Course field
// EXCEPT the valuable hole geometry (holes, layouts) and embedded reviews. The public list is fetched
// with a Firestore REST field mask so that hole geometry is NEVER transmitted to the browser (the
// client SDK can't field-mask, so it would ship the whole map for every course). Individual course
// PAGES still load full geometry by id — this only starves the "one request = every course's map"
// bulk pull, which is the thing worth protecting.
const DIRECTORY_FIELDS = [
  "name", "city", "state", "holeCount", "par", "distanceFt", "description", "courseType",
  "plannedCourseType", "terrain", "amenities", "isFree", "isPublic", "isFeatured", "coverPhotoUrl",
  "galleryPhotoUrls", "communityAverage", "communityScoreCount", "rating", "reviewCount",
  "manualDifficulty", "courseFeeAmount", "latitude", "longitude", "layoutAverages", "createdBy",
  "createdById", "reviewStatus", "isDraft", "defaultLayoutName", "lastModified", "dateCreated",
];

export async function getAllCourses(ownerIds?: Set<string> | null): Promise<Course[]> {
  // Public directory: every named course EXCEPT drafts/pending/rejected (matches both apps' hide
  // rules) and EXCEPT private courses — which are shown only to their creator. Pass the viewer's
  // linked ids (getOwnedIds) to include the private courses THEY own; omit it for anonymous/public
  // contexts so no private course ever leaks. Owners also see their own drafts via getMyCourses.
  const mask = DIRECTORY_FIELDS.map((m) => `&mask.fieldPaths=${m}`).join("");
  const key = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE"; // public Firebase web key
  const out: Course[] = [];
  let token = "";
  try {
    do {
      const url = `https://firestore.googleapis.com/v1/projects/radius-dg/databases/(default)/documents/courses?pageSize=300&key=${key}${token ? `&pageToken=${token}` : ""}${mask}`;
      const r = await fetch(url);
      if (!r.ok) break;
      const j = await r.json();
      for (const d of j.documents ?? []) {
        const id = String(d.name).split("/").pop() as string;
        const data: DocumentData = {};
        for (const [k, v] of Object.entries(d.fields ?? {})) data[k] = restValue(v);
        out.push(docToCourse(id, data));
      }
      token = j.nextPageToken ?? "";
    } while (token);
  } catch {
    /* return what we have */
  }
  return out.filter((c) => c.name && isPubliclyListed(c) && (!isPrivateCourse(c) || isOwnedBy(c, ownerIds)));
}

const COUNT_KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE"; // public Firebase web key
/**
 * The total mapped-course count (every course doc, incl. drafts/pending/private) via the Firestore
 * REST aggregation endpoint — works in the browser AND on the server (plain fetch, no SDK
 * transport that flakes on mobile Safari). This is the single "Courses mapped" headline number used
 * everywhere on the site, so the homepage, hero, strip, and /courses page never disagree. Returns 0
 * on failure so callers can fall back.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runCourseCount(where?: any): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sq: any = { from: [{ collectionId: "courses" }] };
    if (where) sq.where = where;
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/radius-dg/databases/(default)/documents:runAggregationQuery?key=${COUNT_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: sq, aggregations: [{ alias: "count", count: {} }] } }),
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const n = data?.[0]?.result?.aggregateFields?.count?.integerValue;
    return n ? parseInt(n, 10) : 0;
  } catch {
    return 0;
  }
}

export function getTotalCourseCount(): Promise<number> {
  return runCourseCount();
}

/** Count-only (no doc data returned) of private courses — for the "why fewer are listed" note. */
export function getPrivateCourseCount(): Promise<number> {
  return runCourseCount({ fieldFilter: { field: { fieldPath: "courseType" }, op: "EQUAL", value: { stringValue: "Private" } } });
}

// ---- Geo classification (US states + countries) ----
const US_CODES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const US_NAMES = ["ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO","CONNECTICUT","DELAWARE","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS","INDIANA","IOWA","KANSAS","KENTUCKY","LOUISIANA","MAINE","MARYLAND","MASSACHUSETTS","MICHIGAN","MINNESOTA","MISSISSIPPI","MISSOURI","MONTANA","NEBRASKA","NEVADA","NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK","NORTH CAROLINA","NORTH DAKOTA","OHIO","OKLAHOMA","OREGON","PENNSYLVANIA","RHODE ISLAND","SOUTH CAROLINA","SOUTH DAKOTA","TENNESSEE","TEXAS","UTAH","VERMONT","VIRGINIA","WASHINGTON","WEST VIRGINIA","WISCONSIN","WYOMING","DISTRICT OF COLUMBIA","WASHINGTON DC"];
export const US_STATES = new Set([...US_CODES, ...US_NAMES]);
export const STATE_NAMES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "Washington DC" };
export function isUSState(s?: string): boolean {
  return !!s && US_STATES.has(s.trim().toUpperCase());
}
/** Canonical US-state key (full name, UPPERCASE) so "CA" and "California" count as ONE state. */
// Reverse lookup: full state NAME (uppercased) -> 2-letter code.
const STATE_CODE_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toUpperCase(), code])
);
/** Normalize a state value (code OR full name) to its 2-letter code, e.g. "Mississippi" -> "MS". */
export function stateAbbr(s?: string): string | null {
  if (!s) return null;
  const up = s.trim().toUpperCase();
  if (STATE_NAMES[up]) return up;                 // already a code
  if (STATE_CODE_BY_NAME[up]) return STATE_CODE_BY_NAME[up]; // full name -> code
  return null;
}

export function canonicalState(s?: string): string | null {
  if (!isUSState(s)) return null;
  const up = s!.trim().toUpperCase();
  const full = (STATE_NAMES[up] ? STATE_NAMES[up].toUpperCase() : up);
  return full === "WASHINGTON DC" ? "DISTRICT OF COLUMBIA" : full;
}
// name, west, south, east, north
const COUNTRY_BOXES: [string, number, number, number, number][] = [
  ["Canada", -141, 49.0, -52, 83], ["Mexico", -118, 14.5, -86, 32.8],
  ["United Kingdom", -8.6, 49.8, 1.9, 60.9], ["Ireland", -10.6, 51.4, -5.9, 55.5],
  ["Finland", 20, 59.7, 31.6, 70.1], ["Sweden", 11, 55.3, 24.2, 69.1], ["Norway", 4.5, 57.9, 31, 71.2],
  ["Estonia", 21.7, 57.5, 28.2, 59.7], ["Germany", 5.8, 47.2, 15.1, 55.1], ["Netherlands", 3.3, 50.7, 7.2, 53.6],
  ["France", -5.2, 41.3, 9.6, 51.1], ["Czechia", 12, 48.5, 18.9, 51.1], ["Denmark", 8, 54.5, 15.2, 57.8],
  ["Australia", 113, -43.7, 154, -10.6], ["New Zealand", 166, -47.3, 178.6, -34], ["Japan", 129, 30.9, 146, 45.6],
  // Appended after the broad boxes above: these only catch courses the others miss (no regressions),
  // resolving region-name fallbacks (e.g. Carinthia → Austria, Nitra → Slovakia) to real countries.
  ["Austria", 9.5, 46.4, 16.95, 49.1], ["Slovakia", 16.85, 47.7, 22.6, 49.6], ["Switzerland", 5.95, 45.8, 10.5, 47.85],
  ["Slovenia", 13.3, 45.4, 16.6, 46.9], ["Hungary", 16.1, 45.7, 22.9, 48.6], ["Belgium", 2.5, 49.5, 6.4, 51.55],
  ["Poland", 14.2, 49.0, 24.2, 54.9], ["Lithuania", 20.9, 53.9, 26.9, 56.45], ["Latvia", 20.9, 55.7, 28.3, 58.1],
  ["Italy", 6.6, 36.6, 18.6, 47.1], ["Spain", -9.4, 36.0, 3.4, 43.9], ["Portugal", -9.6, 36.9, -6.2, 42.2],
  // More countries with courses that previously fell through to the raw region name (invisible on
  // the world map + inflated the country count). Boxes are checked in order, so these only catch what
  // the boxes above miss. Names match the world TopoJSON exactly.
  ["Iceland", -24.6, 63.2, -13.4, 66.6], ["Cuba", -85.1, 19.7, -73.9, 23.3], ["Brazil", -74.1, -33.8, -34.7, 5.3],
  ["Israel", 34.2, 29.4, 35.9, 33.4], ["Romania", 20.2, 43.6, 29.8, 48.3], ["Bulgaria", 22.3, 41.2, 28.7, 44.3],
  ["Saudi Arabia", 34.5, 16.0, 55.7, 32.2], ["Nicaragua", -87.8, 10.7, -83.0, 15.1],
  ["Papua New Guinea", 140.8, -11.7, 155.9, -1.0], ["Puerto Rico", -67.3, 17.8, -65.2, 18.6],
];
// Canadian provinces/territories — recognized by name so southern courses (Toronto, Ottawa…)
// resolve to "Canada" instead of leaking the province string.
const CA_PROVINCES = new Set(["ON", "QC", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE", "NT", "YT", "NU", "ONTARIO", "QUEBEC", "QUÉBEC", "BRITISH COLUMBIA", "ALBERTA", "MANITOBA", "SASKATCHEWAN", "NOVA SCOTIA", "NEW BRUNSWICK", "NEWFOUNDLAND AND LABRADOR", "NEWFOUNDLAND", "PRINCE EDWARD ISLAND", "NORTHWEST TERRITORIES", "YUKON", "NUNAVUT"]);
export function countryOf(c: { state?: string; latitude?: number; longitude?: number }): string {
  if (isUSState(c.state)) return "United States";
  if (c.state && CA_PROVINCES.has(c.state.trim().toUpperCase())) return "Canada";
  const lat = c.latitude, lng = c.longitude;
  if (typeof lat === "number" && typeof lng === "number") {
    for (const [name, w, s, e, n] of COUNTRY_BOXES) if (lng >= w && lng <= e && lat >= s && lat <= n) return name;
    if ((lat >= 24.5 && lat <= 49.4 && lng >= -125 && lng <= -66.9) || (lat >= 51 && lat <= 71.5 && lng >= -179 && lng <= -129) || (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154)) return "United States";
  }
  // Fall back to a single "International" bucket, NOT the raw state/region string — leaking a region
  // name (e.g. "São Paulo", "Riyadh") shows as a phantom country on the map + inflates the count.
  return "International";
}

export interface Builder {
  id: string;
  name: string;
  username?: string;
  count: number;
  cover?: string; // latest mapped course's cover photo — used as an avatar fallback
}
/** Users who have built the most courses, grouped by CANONICAL identity — one person's linked
 *  cross-platform accounts combine; two different people who share a display name do NOT. */
export async function getTopBuilders(max = 10): Promise<Builder[]> {
  const snap = await getDocs(collection(db, "courses"));
  // Credit by builder ACCOUNT (createdById), the same way the app does. A builder's courses are
  // often saved to the shared pool under the name "Community", so grouping by display name (the
  // old behaviour) silently dropped those and undercounted — e.g. 64 instead of 85.
  const byId = new Map<string, { count: number; names: Map<string, number>; cover?: string; coverAt: number }>();
  snap.forEach((d) => {
    const c = d.data();
    const id = ((c.createdById as string) || "").trim();
    if (!id) return; // unattributed courses aren't credited to any builder
    const name = ((c.createdBy as string) || "").trim();
    const e = byId.get(id) || { count: 0, names: new Map<string, number>(), coverAt: 0 };
    e.count++;
    if (name && name.toLowerCase() !== "community") e.names.set(name, (e.names.get(name) || 0) + 1);
    const cover = typeof c.coverPhotoUrl === "string" && /^https?:\/\//.test(c.coverPhotoUrl) ? c.coverPhotoUrl : undefined;
    const at = typeof c.dateCreated === "number" ? c.dateCreated : 0;
    if (cover && at >= e.coverAt) { e.cover = cover; e.coverAt = at; } // keep the newest course's cover
    byId.set(id, e);
  });
  // Fold each account into its CANONICAL id. A single person's linked accounts merge; two
  // DIFFERENT people who happen to share a display name stay separate (the old name-keyed merge
  // fused them — e.g. two unrelated "Brian" accounts counted as one). Resolve once per distinct
  // builder id (not per course); most ids have no mapping and resolve to themselves.
  const canonOf = new Map<string, string>();
  await Promise.all([...byId.keys()].map(async (id) => { canonOf.set(id, await resolveCanonicalId(id)); }));
  const merged = new Map<string, { id: string; count: number; names: Map<string, number>; topIdCount: number; cover?: string; coverAt: number }>();
  for (const [id, e] of byId) {
    const key = canonOf.get(id) || id;
    const m = merged.get(key);
    if (!m) {
      merged.set(key, { id, count: e.count, names: new Map(e.names), topIdCount: e.count, cover: e.cover, coverAt: e.coverAt });
    } else {
      m.count += e.count;
      for (const [n, c2] of e.names) m.names.set(n, (m.names.get(n) || 0) + c2);
      if (e.count > m.topIdCount) { m.topIdCount = e.count; m.id = id; } // account with most courses = best avatar
      if (e.cover && e.coverAt >= m.coverAt) { m.cover = e.cover; m.coverAt = e.coverAt; } // newest cover across accounts
    }
  }
  const top: Builder[] = [...merged.values()]
    .map((m) => ({ id: m.id, count: m.count, cover: m.cover, name: [...m.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "" }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
  // Fill username (to disambiguate same-name builders) + any missing display name from the
  // winning account's user doc.
  await Promise.all(
    top.map(async (b) => {
      try {
        const data = (await getDoc(doc(db, "users", b.id))).data();
        b.username = ((data?.username as string) || "").trim() || undefined;
        if (!b.name) b.name = (((data?.name || data?.displayName || data?.username || "") as string).trim()) || "Course builder";
      } catch {
        if (!b.name) b.name = "Course builder";
      }
    })
  );
  return top;
}

/** Courses (and layouts) the signed-in user built, newest first. Staff-removed courses are dropped
 *  even for the owner — a soft delete keeps the doc, but the owner's list must not show a course
 *  staff have pulled (mirrors iOS dropping its local copy with a tombstone). */
export async function getMyCourses(uid: string): Promise<Course[]> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "courses"), where("createdById", "==", cid), limit(200)));
    return snap.docs
      .map((d) => docToCourse(d.id, d.data()))
      .filter((c) => (c.reviewStatus || "").trim().toLowerCase() !== "removed")
      .sort((a, b) => (b.dateCreated ?? 0) - (a.dateCreated ?? 0));
  } catch {
    return [];
  }
}

/** Fields a course owner may edit from the web. */
export type CourseEdit = Partial<Pick<Course, "name" | "city" | "state" | "description" | "isFree" | "isPublic" | "courseType" | "terrain" | "manualDifficulty" | "coverPhotoUrl" | "amenities" | "galleryPhotoUrls" | "courseFeeAmount">>;

/** Owner-only course detail edit. Verifies ownership, writes ONLY the given fields (never clobbers holes/layout). */
export async function updateCourse(uid: string, courseId: string, fields: CourseEdit): Promise<boolean> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDoc(doc(db, "courses", courseId));
    if (!snap.exists() || (snap.data().createdById as string) !== cid) return false;
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    await updateDoc(doc(db, "courses", courseId), { ...clean, lastModified: Date.now() });
    return true;
  } catch {
    return false;
  }
}

export interface HoleEdit { holeNumber: number; par: number; distance: number }
/** Owner-only hole edit. Preserves EVERY existing hole field (tee/basket geo, elevation, etc.) — only par/distance change. Recomputes totals. */
export async function updateCourseHoles(uid: string, courseId: string, edits: HoleEdit[]): Promise<boolean> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDoc(doc(db, "courses", courseId));
    if (!snap.exists() || (snap.data().createdById as string) !== cid) return false;
    const raw: DocumentData[] = Array.isArray(snap.data().holes) ? snap.data().holes : [];
    const byNum = new Map(edits.map((e) => [e.holeNumber, e]));
    const newHoles = raw.map((h, i) => {
      const e = byNum.get(h.holeNumber ?? i + 1);
      return e ? { ...h, par: e.par, distance: e.distance } : h;
    });
    const totalPar = newHoles.reduce((s, h) => s + (Number(h.par) || 0), 0);
    const totalDist = newHoles.reduce((s, h) => s + (Number(h.distance) || 0), 0);
    await updateDoc(doc(db, "courses", courseId), { holes: newHoles, holeCount: newHoles.length, par: totalPar, distanceFt: totalDist, lastModified: Date.now() });
    return true;
  } catch {
    return false;
  }
}

/** Resolve a course from a slug's short id (first 8 chars of the doc id) — one cheap range query. */
export async function getCourseByShortId(shortId: string): Promise<Course | null> {
  const exact = await getDoc(doc(db, "courses", shortId));
  if (exact.exists()) return docToCourse(exact.id, exact.data());
  try {
    const snap = await getDocs(query(collection(db, "courses"), orderBy(documentId()), startAt(shortId), endAt(shortId + ""), limit(1)));
    return snap.empty ? null : docToCourse(snap.docs[0].id, snap.docs[0].data());
  } catch {
    return null;
  }
}

export async function getCourseById(id: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, "courses", id));
  if (!snap.exists()) return null;
  return docToCourse(snap.id, snap.data());
}

export async function getCourseScores(courseId: string, max = 25): Promise<CourseScore[]> {
  // Leaderboard lives in the course's `scores` subcollection.
  let snap = await getDocs(collection(db, "courses", courseId, "scores"));
  if (snap.empty) {
    // Fallback to legacy top-level collection.
    snap = await getDocs(query(collection(db, "courseScores"), where("courseId", "==", courseId)));
  }
  const all = snap.docs.map((d) => {
    const data = d.data();
    return {
      playerId: data.playerId ?? "",
      playerName: data.playerName ?? "",
      username: data.username ?? "",
      courseId: data.courseId ?? courseId,
      courseName: data.courseName ?? "",
      relativeToPar: data.relativeToPar ?? 0,
      holesPlayed: data.holesPlayed ?? 0,
      gameIQ: data.gameIQ ?? 0,
      date: data.date ?? 0,
      layoutName: data.layoutName,
      playerUid: data.playerUid ?? data.playerId,
      playerHandle: (data.playerHandle as string | undefined)?.replace(/^@/, ""),
      id: d.id,
      canonicalUid: "",
    };
  });
  // Collapse ALIAS ACCOUNTS to one canonical person so a player's linked logins don't each hold a
  // leaderboard row (that's what duplicated e.g. "Brady" on the board + in the derived records).
  const uids = [...new Set(all.map((s) => s.playerUid).filter(Boolean) as string[])];
  const canonOf = new Map<string, string>();
  await Promise.all(uids.map(async (uid) => { canonOf.set(uid, await resolveCanonicalId(uid).catch(() => uid)); }));
  for (const s of all) s.canonicalUid = (s.playerUid && canonOf.get(s.playerUid)) || s.playerUid || "";
  // Best score per canonical player PER LAYOUT (a player who played multiple layouts keeps one best on
  // EACH — keying by player alone hid their scores on every layout but their single best).
  const best = new Map<string, CourseScore>();
  for (const s of all) {
    const canon = (s.playerUid && canonOf.get(s.playerUid)) || s.playerUid || s.playerName;
    const key = `${canon}|${s.layoutName || ""}`;
    const cur = best.get(key);
    if (!cur || s.relativeToPar < cur.relativeToPar) best.set(key, s);
  }
  // Sanity guard: drop physically-impossible scores (e.g. a "-46" on a 4-hole round). The best any
  // round can shoot is acing every hole; even if every hole were a par 5 that's -4 per hole, so any
  // relativeToPar below -4×holesPlayed is bad data, not a record.
  return [...best.values()]
    .filter((s) => !s.holesPlayed || s.relativeToPar >= -4 * s.holesPlayed)
    .sort((a, b) => a.relativeToPar - b.relativeToPar)
    .slice(0, max);
}

export function slugify(name: string, id: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${id.slice(0, 8)}`;
}

export function idFromSlug(slug: string): string | null {
  const parts = slug.split("-");
  if (parts.length < 2) return null;
  const shortId = parts[parts.length - 1];
  return shortId;
}

/** URL slug for a city name (e.g. "Mason City" -> "mason-city"). Used by /courses/city/[code]/[name]. */
export function citySlug(city: string): string {
  return (city || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uuidUpper(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().toUpperCase()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`.toUpperCase();
}

/** Great-circle distance in FEET between two lat/lng points (haversine). */
export function distanceFt(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000; // metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  const metres = 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  return Math.round(metres * 3.28084);
}

export interface AltTeeWrite { id: string; label: string; lat: number; lng: number }
export interface AltBasketWrite { id: string; label: string; lat: number; lng: number; colorHex: string }
export interface MandoWrite { id: string; lat: number; lng: number; direction: "Left" | "Right" | "Down"; label: string }
export interface HoleDraft {
  par: number; teeLat: number; teeLng: number; basketLat: number; basketLng: number; notes?: string;
  elbows?: { lat: number; lng: number }[];
  alternateTees?: AltTeeWrite[];
  alternateBaskets?: AltBasketWrite[];
  mandos?: MandoWrite[];
}
export interface CourseDraft {
  name: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  courseType?: string;      // "Public" | "Private"
  terrain?: string;         // Mixed | Open | Wooded | Hilly | Desert | Coastal
  manualDifficulty?: string; // Beginner | Intermediate | Advanced | Expert | ""
  amenities?: string[];
  isFree?: boolean;
  courseFeeAmount?: number;
  coverPhotoUrl?: string;
  holes: HoleDraft[];
}

// Shared hole-doc builder used by BOTH create and edit so the schema never drifts.
function buildCourseHoles(draft: CourseDraft) {
  const holes = draft.holes.map((h, i) => {
    const elbows = h.elbows ?? []; // {lat,lng} objects (app contract)
    let dist = 0; let pa = { lat: h.teeLat, lng: h.teeLng };
    for (const e of elbows) { dist += distanceFt(pa.lat, pa.lng, e.lat, e.lng); pa = e; }
    dist += distanceFt(pa.lat, pa.lng, h.basketLat, h.basketLng);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hole: Record<string, any> = {
      id: uuidUpper(), holeNumber: i + 1, par: h.par > 0 ? h.par : 3, distance: Math.round(dist),
      teeLat: h.teeLat, teeLng: h.teeLng, basketLat: h.basketLat, basketLng: h.basketLng,
      elbows: elbows.map((e) => ({ lat: e.lat, lng: e.lng })), notes: h.notes?.trim() || "",
    };
    if (h.alternateTees?.length) hole.alternateTees = h.alternateTees.map((t) => ({ id: t.id, label: t.label, lat: t.lat, lng: t.lng }));
    if (h.alternateBaskets?.length) hole.alternateBaskets = h.alternateBaskets.map((b) => ({ id: b.id, label: b.label, lat: b.lat, lng: b.lng, colorHex: b.colorHex }));
    if (h.mandos?.length) hole.mandos = h.mandos.map((m) => ({ id: m.id, lat: m.lat, lng: m.lng, direction: m.direction, label: m.label }));
    return hole;
  });
  const par = holes.reduce((s, h) => s + h.par, 0);
  const totalDist = holes.reduce((s, h) => s + h.distance, 0);
  const latitude = draft.latitude ?? draft.holes.reduce((s, h) => s + h.teeLat, 0) / draft.holes.length;
  const longitude = draft.longitude ?? draft.holes.reduce((s, h) => s + h.teeLng, 0) / draft.holes.length;
  return { holes, par, totalDist, latitude, longitude };
}

/**
 * Create a NEW course from the web. Written as reviewStatus "Draft" + isDraft true so it is HIDDEN
 * in the public directory of BOTH apps (iOS hides reviewStatus=="Draft"; Android hides isDraft) and
 * on web — it only shows in the creator's "My courses" until approved. Matches the app course schema
 * exactly: course holes keyed `holeNumber`; altitude fields are OMITTED (never fabricated). Ownership
 * is stamped with the caller's resolved canonical id. Returns the new course id, or null on failure.
 */
export async function createCourse(uid: string, draft: CourseDraft, opts?: { presetId?: string; publish?: boolean }): Promise<string | null> {
  try {
    const cid = await resolveCanonicalId(uid);
    if (!draft.name?.trim() || draft.holes.length === 0) return null;
    const me = await getProfileLite(uid);
    const id = opts?.presetId || uuidUpper();
    const now = Date.now();
    const publish = opts?.publish === true;

    const { holes, par, totalDist, latitude, longitude } = buildCourseHoles(draft);
    const isFree = draft.isFree ?? true;

    const docData: Record<string, unknown> = {
      id,
      name: draft.name.trim(),
      city: draft.city?.trim() || "",
      state: draft.state?.trim() || "",
      description: draft.description?.trim() || "",
      // DRAFT LEAK FIX: a draft must be creator-only until published. Both apps' bulk sync drops
      // non-owned Private courses, but NOT non-owned drafts — so a draft left as "Public" in the
      // shared collection shows up in every user's app. Mark drafts Private (creator still sees
      // them everywhere) and stash the real type in plannedCourseType to restore on publish.
      courseType: publish ? (draft.courseType?.trim() || "Public") : "Private",
      plannedCourseType: draft.courseType?.trim() || "Public",
      terrain: draft.terrain?.trim() || "Mixed",
      amenities: draft.amenities ?? [],
      isFree,
      courseFee: isFree ? "Free" : "Pay to Play",
      courseFeeAmount: isFree ? 0 : (draft.courseFeeAmount ?? 0),
      isPublic: true,
      isFeatured: false,
      latitude, longitude,
      holes, holeCount: holes.length, par, distanceFt: totalDist,
      layouts: [],
      createdBy: me?.name || "",
      createdById: cid,
      adminIds: [],
      dateCreated: now,
      lastModified: now,
      // Publish → live everywhere (iOS reads reviewStatus, Android reads isDraft); both must agree.
      // Save as draft → hidden in both apps + web until the owner publishes it.
      reviewStatus: publish ? "Approved" : "Draft",
      isDraft: !publish,
    };
    if (publish) docData.submittedDate = now;
    if (draft.manualDifficulty?.trim()) docData.manualDifficulty = draft.manualDifficulty.trim();
    if (draft.coverPhotoUrl?.trim()) docData.coverPhotoUrl = draft.coverPhotoUrl.trim();

    await setDoc(doc(db, "courses", id), docData);
    return id;
  } catch {
    return null;
  }
}

/** Nearby + similarly-named existing courses, to warn about duplicates before creating. */
export async function findNearbyCourses(lat: number, lng: number, name: string, radiusMi = 2): Promise<Course[]> {
  try {
    const all = await getAllCourses();
    const n = name.trim().toLowerCase();
    const degLat = radiusMi / 69;
    const degLng = radiusMi / (69 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
    return all.filter((c) => {
      if (c.latitude == null || c.longitude == null) return false;
      const near = Math.abs(c.latitude - lat) <= degLat && Math.abs(c.longitude - lng) <= degLng;
      const nameMatch = !!n && c.name.toLowerCase().includes(n);
      return near || nameMatch;
    }).slice(0, 6);
  } catch {
    return [];
  }
}

// ---- Edit an existing course (same builder, write back to the same doc) ----
export interface EditHole {
  par: number;
  teeLat?: number; teeLng?: number; basketLat?: number; basketLng?: number;
  elbows: { lat: number; lng: number }[];
  alternateTees: AltTeeWrite[];
  alternateBaskets: AltBasketWrite[];
  mandos: MandoWrite[];
  notes: string;
}
export interface EditCourse {
  id: string; name: string; city: string; state: string;
  latitude?: number; longitude?: number;
  description: string; courseType: string; terrain: string; manualDifficulty: string;
  amenities: string[]; isFree: boolean; courseFeeAmount: number; coverPhotoUrl: string;
  holes: EditHole[];
  isDraft: boolean; // true if this course is still an unpublished draft (so the builder can offer Publish)
}

const numv = (x: unknown): number | undefined => (typeof x === "number" && !Number.isNaN(x) ? x : undefined);

async function ownsCourse(uid: string, data: DocumentData): Promise<boolean> {
  const owned = await getOwnedIds(uid);
  const createdById = (data.createdById as string) || "";
  const adminIds: string[] = Array.isArray(data.adminIds) ? data.adminIds.map(String) : [];
  return owned.has(createdById) || adminIds.some((a) => owned.has(a));
}

/**
 * Publish an owner's course so it goes live everywhere. Mirrors the app's publish: iOS reads
 * reviewStatus ("Approved"), Android reads isDraft (false) — we set BOTH so it shows on every
 * platform + web. Owner-only. Returns success.
 */
export async function publishCourse(uid: string, id: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, "courses", id));
    if (!snap.exists()) return false;
    const data = snap.data();
    if (!(await ownsCourse(uid, data))) return false;
    const now = Date.now();
    // Restore the real course type stashed at draft time (drafts are forced to "Private" so they
    // don't leak into other users' apps). Fall back to the current type for legacy docs.
    const restoredType = (data.plannedCourseType as string) || (data.courseType as string) || "Public";
    await updateDoc(doc(db, "courses", id), { reviewStatus: "Approved", isDraft: false, courseType: restoredType, submittedDate: now, lastModified: now });
    return true;
  } catch { return false; }
}

/** Load a course (owner-only) into the exact shape the builder needs — incl. every hole marker. */
export async function getCourseForEdit(uid: string, id: string): Promise<EditCourse | null> {
  try {
    const snap = await getDoc(doc(db, "courses", id));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!(await ownsCourse(uid, data))) return null;
    const rawHoles: DocumentData[] = Array.isArray(data.holes) ? data.holes : [];
    const holes: EditHole[] = rawHoles.map((h) => ({
      par: typeof h.par === "number" ? h.par : 3,
      teeLat: numv(h.teeLat), teeLng: numv(h.teeLng), basketLat: numv(h.basketLat), basketLng: numv(h.basketLng),
      elbows: (Array.isArray(h.elbows) ? h.elbows : []).map((e: DocumentData) => ({ lat: numv(e.lat), lng: numv(e.lng) })).filter((e) => e.lat != null && e.lng != null) as { lat: number; lng: number }[],
      alternateTees: (Array.isArray(h.alternateTees) ? h.alternateTees : []).map((t: DocumentData) => ({ id: String(t.id || uuidUpper()), label: String(t.label || ""), lat: numv(t.lat), lng: numv(t.lng) })).filter((t) => t.lat != null && t.lng != null) as AltTeeWrite[],
      alternateBaskets: (Array.isArray(h.alternateBaskets) ? h.alternateBaskets : []).map((b: DocumentData) => ({ id: String(b.id || uuidUpper()), label: String(b.label || ""), lat: numv(b.lat), lng: numv(b.lng), colorHex: String(b.colorHex || "3498DB") })).filter((b) => b.lat != null && b.lng != null) as AltBasketWrite[],
      mandos: (Array.isArray(h.mandos) ? h.mandos : []).map((m: DocumentData) => ({ id: String(m.id || uuidUpper()), lat: numv(m.lat), lng: numv(m.lng), direction: (["Left", "Right", "Down"].includes(m.direction) ? m.direction : "Left") as "Left" | "Right" | "Down", label: String(m.label || "") })).filter((m) => m.lat != null && m.lng != null) as MandoWrite[],
      notes: String(h.notes || ""),
    }));
    const draft = data.isDraft === true || String(data.reviewStatus || "").trim().toLowerCase() === "draft";
    // A draft is stored courseType:"Private" (anti-leak) with the real type in plannedCourseType.
    // Load the INTENDED type into the builder so the type selector is correct and saving doesn't
    // overwrite the user's choice with the transient "Private".
    const editType = (draft ? (data.plannedCourseType as string) : undefined) || data.courseType || "Public";
    return {
      id, name: data.name || "", city: data.city || "", state: data.state || "",
      latitude: numv(data.latitude), longitude: numv(data.longitude),
      description: data.description || "", courseType: editType, terrain: data.terrain || "Mixed",
      manualDifficulty: data.manualDifficulty || "", amenities: Array.isArray(data.amenities) ? data.amenities.map(String) : [],
      isFree: data.isFree !== false, courseFeeAmount: typeof data.courseFeeAmount === "number" ? data.courseFeeAmount : 0,
      coverPhotoUrl: typeof data.coverPhotoUrl === "string" ? data.coverPhotoUrl : "", holes,
      isDraft: draft,
    };
  } catch { return null; }
}

/**
 * Owner-only edit of an existing course. Writes ONLY the builder-managed fields (course details +
 * full holes incl. all markers) and PRESERVES everything else — createdById, dateCreated,
 * reviewStatus/isDraft, layouts, adminIds, community ratings/reviews, isFeatured. Never changes
 * ownership. Same schema as create, so mobile reads the edits identically. Returns success.
 */
export async function updateBuiltCourse(uid: string, id: string, draft: CourseDraft): Promise<boolean> {
  try {
    if (!draft.name?.trim() || draft.holes.length === 0) return false;
    const snap = await getDoc(doc(db, "courses", id));
    if (!snap.exists()) return false;
    const cur = snap.data();
    if (!(await ownsCourse(uid, cur))) return false;
    const { holes, par, totalDist, latitude, longitude } = buildCourseHoles(draft);
    const isFree = draft.isFree ?? true;
    const chosenType = draft.courseType?.trim() || "Public";
    // If this course is still a draft, keep it Private so it doesn't leak into other users' apps
    // (see createCourse) and stash the real type; only a published course gets the chosen type.
    const stillDraft = cur.isDraft === true || String(cur.reviewStatus || "").toLowerCase() === "draft";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {
      name: draft.name.trim(),
      city: draft.city?.trim() || "",
      state: draft.state?.trim() || "",
      description: draft.description?.trim() || "",
      courseType: stillDraft ? "Private" : chosenType,
      plannedCourseType: chosenType,
      terrain: draft.terrain?.trim() || "Mixed",
      amenities: draft.amenities ?? [],
      isFree,
      courseFee: isFree ? "Free" : "Pay to Play",
      courseFeeAmount: isFree ? 0 : (draft.courseFeeAmount ?? 0),
      latitude, longitude,
      holes, holeCount: holes.length, par, distanceFt: totalDist,
      manualDifficulty: draft.manualDifficulty?.trim() || "",
      lastModified: Date.now(),
    };
    if (draft.coverPhotoUrl?.trim()) update.coverPhotoUrl = draft.coverPhotoUrl.trim();
    await updateDoc(doc(db, "courses", id), update);
    return true;
  } catch { return false; }
}
