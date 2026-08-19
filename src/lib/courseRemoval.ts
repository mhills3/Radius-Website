import { db, functions } from "./firebase";
import { collection, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// Every field here is computed by a Cloud Function on create and stored on the request document.
// Do NOT re-derive any of it in the browser — just render what's on the doc.
export interface DuplicateCandidate {
  courseId?: string;
  name: string;
  city?: string;
  state?: string;
  holeCount?: number;
  createdBy?: string;
  milesAway?: number;
  sameName?: boolean;
  lat?: number;
  lng?: number;
}
export interface CourseSnapshot { name?: string; city?: string; state?: string; lat?: number; lng?: number; holeCount?: number }
export interface RemovalEvidence {
  requesterBuiltIt?: boolean;
  likelyDuplicates?: DuplicateCandidate[];
  roundsPlayed?: number;
  holeCount?: number;
  isPublished?: boolean;
}
export interface RemovalRequest {
  id: string;
  courseId?: string;
  courseName: string;
  courseSnapshot?: CourseSnapshot;
  reasonKey?: string;   // duplicate | mistake | closed | wrong_location | other
  detail?: string;      // free text, ≥10 chars
  requesterName?: string;
  requesterEmail?: string;
  requesterEmailMissing?: boolean;
  requesterUsername?: string;
  evidence?: RemovalEvidence;
  status: string;       // pending | invalid | approved | denied
  validationErrors?: string[];
  createdAt?: number;
}

/** Just the count of pending requests — for the Admin nav badge + hub card (cheap server-side count). */
export async function getPendingRemovalCount(): Promise<number> {
  try {
    const c = await getCountFromServer(query(collection(db, "courseRemovalRequests"), where("status", "==", "pending")));
    return c.data().count;
  } catch { return 0; }
}

/** Everything the staff queue shows: pending requests + the server-flagged invalid ones. */
export async function getRemovalRequests(): Promise<RemovalRequest[]> {
  const snap = await getDocs(query(collection(db, "courseRemovalRequests"), where("status", "in", ["pending", "invalid"])));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<RemovalRequest, "id">) }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export interface ResolveResult { ok?: boolean; alreadyResolved?: boolean; error?: string }
/**
 * THE ONLY way to act on a request. The callable re-checks staff server-side with the Admin SDK and
 * performs the soft delete (approve → isDraft + reviewStatus "removed"). Idempotent — a double-click
 * returns { alreadyResolved: true }. It throws typed HttpsErrors (failed-precondition) when the
 * requester doesn't own the course (pass override: true to proceed anyway) or the course name no
 * longer matches the reviewed snapshot. Never write the decision to Firestore from the client.
 */
export async function resolveCourseRemoval(requestId: string, decision: "approve" | "deny", note?: string, override?: boolean): Promise<ResolveResult> {
  const fn = httpsCallable<{ requestId: string; decision: "approve" | "deny"; note?: string; override?: boolean }, ResolveResult>(functions, "resolveCourseRemoval");
  const res = await fn({ requestId, decision, ...(note ? { note } : {}), ...(override ? { override: true } : {}) });
  return res.data ?? {};
}

/** Pull a readable message + whether the failure is the overridable ownership precondition. */
export function parseResolveError(e: unknown): { message: string; overridable: boolean } {
  const err = (e ?? {}) as { code?: string; message?: string; details?: { requiresOverride?: boolean; reason?: string } };
  const code = (err.code || "").replace(/^functions\//, "");
  const message = err.message || "Something went wrong.";
  const details = err.details;
  const nameMismatch = details?.reason === "name_mismatch" || /\bname\b|no longer match|snapshot|renamed/i.test(message);
  // Ownership precondition is the one staff can override; the name-mismatch guard is a hard stop.
  const overridable = code === "failed-precondition" && !nameMismatch && (details?.requiresOverride === true || /own|builder|override/i.test(message) || true);
  return { message, overridable };
}

const MAP_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoibWlrZXkzIiwiYSI6ImNtb3Fra25hZzB6dnIycHB6ZHMxcjIwNHYifQ.tyyS7i-aoR54_l11rW0Khg";
/** Static Mapbox map with the course pin (gold "A") and the top likely-duplicate pin (blue "B"), auto-fit. */
export function twoPinMapUrl(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number } | null, w = 520, h = 200): string | null {
  if (typeof a.lat !== "number" || typeof a.lng !== "number") return null;
  const pins = [`pin-l-a+f6c165(${a.lng.toFixed(5)},${a.lat.toFixed(5)})`];
  const hasB = b && typeof b.lat === "number" && typeof b.lng === "number";
  if (hasB) pins.push(`pin-l-b+8fbde3(${b!.lng!.toFixed(5)},${b!.lat!.toFixed(5)})`);
  const placement = hasB ? "auto" : `${a.lng.toFixed(5)},${a.lat.toFixed(5)},12,0`;
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pins.join(",")}/${placement}/${w}x${h}@2x?access_token=${MAP_TOKEN}&padding=44`;
}
