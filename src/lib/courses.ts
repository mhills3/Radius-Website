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
  getCountFromServer,
  DocumentData,
} from "firebase/firestore";
import { resolveCanonicalId } from "./account";

/** Lightweight count of all courses (server-side aggregation — one cheap read). */
export async function getCourseCount(): Promise<number> {
  try {
    const s = await getCountFromServer(collection(db, "courses"));
    return s.data().count;
  } catch {
    return 0;
  }
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
  lastModified: number;
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
}

function docToCourse(id: string, data: DocumentData): Course {
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
      distance: h.distance ?? 0,
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
            distance: h.distance ?? 0,
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
    lastModified: data.lastModified ?? 0,
    dateCreated: normMs(data.dateCreated ?? data.lastModified),
  };
}

// ms | unix-seconds | Swift reference-date seconds (2001) → ms
function normMs(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  if (n > 1e12) return n;
  if (n > 1e9) return n * 1000;
  if (n > 1e7) return (n + 978307200) * 1000;
  return 0;
}

export async function getAllCourses(): Promise<Course[]> {
  // Every course in the directory (matches the live site count).
  const snap = await getDocs(collection(db, "courses"));
  return snap.docs.map((d) => docToCourse(d.id, d.data())).filter((c) => c.name);
}

// ---- Geo classification (US states + countries) ----
const US_CODES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"];
const US_NAMES = ["ALABAMA","ALASKA","ARIZONA","ARKANSAS","CALIFORNIA","COLORADO","CONNECTICUT","DELAWARE","FLORIDA","GEORGIA","HAWAII","IDAHO","ILLINOIS","INDIANA","IOWA","KANSAS","KENTUCKY","LOUISIANA","MAINE","MARYLAND","MASSACHUSETTS","MICHIGAN","MINNESOTA","MISSISSIPPI","MISSOURI","MONTANA","NEBRASKA","NEVADA","NEW HAMPSHIRE","NEW JERSEY","NEW MEXICO","NEW YORK","NORTH CAROLINA","NORTH DAKOTA","OHIO","OKLAHOMA","OREGON","PENNSYLVANIA","RHODE ISLAND","SOUTH CAROLINA","SOUTH DAKOTA","TENNESSEE","TEXAS","UTAH","VERMONT","VIRGINIA","WASHINGTON","WEST VIRGINIA","WISCONSIN","WYOMING","DISTRICT OF COLUMBIA","WASHINGTON DC"];
export const US_STATES = new Set([...US_CODES, ...US_NAMES]);
export const STATE_NAMES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "Washington DC" };
export function isUSState(s?: string): boolean {
  return !!s && US_STATES.has(s.trim().toUpperCase());
}
// name, west, south, east, north
const COUNTRY_BOXES: [string, number, number, number, number][] = [
  ["Canada", -141, 49.0, -52, 83], ["Mexico", -118, 14.5, -86, 32.8],
  ["United Kingdom", -8.6, 49.8, 1.9, 60.9], ["Ireland", -10.6, 51.4, -5.9, 55.5],
  ["Finland", 20, 59.7, 31.6, 70.1], ["Sweden", 11, 55.3, 24.2, 69.1], ["Norway", 4.5, 57.9, 31, 71.2],
  ["Estonia", 21.7, 57.5, 28.2, 59.7], ["Germany", 5.8, 47.2, 15.1, 55.1], ["Netherlands", 3.3, 50.7, 7.2, 53.6],
  ["France", -5.2, 41.3, 9.6, 51.1], ["Czechia", 12, 48.5, 18.9, 51.1], ["Denmark", 8, 54.5, 15.2, 57.8],
  ["Australia", 113, -43.7, 154, -10.6], ["New Zealand", 166, -47.3, 178.6, -34], ["Japan", 129, 30.9, 146, 45.6],
];
export function countryOf(c: { state?: string; latitude?: number; longitude?: number }): string {
  if (isUSState(c.state)) return "United States";
  const lat = c.latitude, lng = c.longitude;
  if (typeof lat === "number" && typeof lng === "number") {
    for (const [name, w, s, e, n] of COUNTRY_BOXES) if (lng >= w && lng <= e && lat >= s && lat <= n) return name;
    if ((lat >= 24.5 && lat <= 49.4 && lng >= -125 && lng <= -66.9) || (lat >= 51 && lat <= 71.5 && lng >= -179 && lng <= -129) || (lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154)) return "United States";
  }
  return c.state?.trim() || "International";
}

export interface Builder {
  id: string;
  name: string;
  count: number;
}
/** Users who have built the most courses (merged across cross-platform accounts by name). */
export async function getTopBuilders(max = 10): Promise<Builder[]> {
  const snap = await getDocs(collection(db, "courses"));
  // Credit by builder ACCOUNT (createdById), the same way the app does. A builder's courses are
  // often saved to the shared pool under the name "Community", so grouping by display name (the
  // old behaviour) silently dropped those and undercounted — e.g. 64 instead of 85.
  const byId = new Map<string, { count: number; names: Map<string, number> }>();
  snap.forEach((d) => {
    const c = d.data();
    const id = ((c.createdById as string) || "").trim();
    if (!id) return; // unattributed courses aren't credited to any builder
    const name = ((c.createdBy as string) || "").trim();
    const e = byId.get(id) || { count: 0, names: new Map<string, number>() };
    e.count++;
    if (name && name.toLowerCase() !== "community") e.names.set(name, (e.names.get(name) || 0) + 1);
    byId.set(id, e);
  });
  // Merge accounts that resolve to the same builder name — handles a builder having multiple
  // un-unified account IDs (e.g. cross-platform). Accounts with no derived name stay keyed by id.
  const merged = new Map<string, { id: string; count: number; name: string; topIdCount: number }>();
  for (const [id, e] of byId) {
    const name = [...e.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    const key = name ? name.toLowerCase() : id;
    const m = merged.get(key);
    if (!m) {
      merged.set(key, { id, count: e.count, name, topIdCount: e.count });
    } else {
      m.count += e.count;
      if (e.count > m.topIdCount) { m.topIdCount = e.count; m.id = id; } // keep the account with most courses (best avatar)
      if (name && !m.name) m.name = name;
    }
  }
  const top = [...merged.values()]
    .map((m) => ({ id: m.id, count: m.count, name: m.name }))
    .sort((a, b) => b.count - a.count)
    .slice(0, max);
  // Resolve any display name we couldn't derive from courses (account only ever posted as "Community").
  await Promise.all(
    top.map(async (b) => {
      if (b.name) return;
      try {
        const u = await getDoc(doc(db, "users", b.id));
        const data = u.data();
        b.name = (((data?.name || data?.displayName || data?.username || "") as string).trim()) || "Course builder";
      } catch {
        b.name = "Course builder";
      }
    })
  );
  return top;
}

/** Courses (and layouts) the signed-in user built, newest first. */
export async function getMyCourses(uid: string): Promise<Course[]> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "courses"), where("createdById", "==", cid), limit(200)));
    return snap.docs.map((d) => docToCourse(d.id, d.data())).sort((a, b) => (b.dateCreated ?? 0) - (a.dateCreated ?? 0));
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
    };
  });
  // Best score per player, then sort by relativeToPar.
  const best = new Map<string, CourseScore>();
  for (const s of all) {
    const key = s.playerUid || s.playerName;
    const cur = best.get(key);
    if (!cur || s.relativeToPar < cur.relativeToPar) best.set(key, s);
  }
  return [...best.values()].sort((a, b) => a.relativeToPar - b.relativeToPar).slice(0, max);
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
