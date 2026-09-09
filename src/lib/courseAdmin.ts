import { db, functions } from "./firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// Mirrors src/lib/courseRemoval.ts for the "make me an admin of this course"
// queue. Every evidence field is computed by the onAdminRequestCreated trigger
// and stored on the request doc — render what's there, never re-derive.

export interface AdminRequestEvidence {
  alreadyAdmin?: boolean;
  coursesBuilt?: number;
  currentAdminCount?: number;
  ownerName?: string;
}
export interface AdminCourseSnapshot { name?: string; city?: string; state?: string; holeCount?: number }
export interface AdminRequest {
  id: string;
  courseId?: string;
  courseName: string;
  courseSnapshot?: AdminCourseSnapshot;
  reasonKey?: string;   // maintainer | designer | club | inactive_mapper | other
  detail?: string;      // free text, ≥10 chars
  requesterId?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterEmailMissing?: boolean;
  requesterUsername?: string;
  evidence?: AdminRequestEvidence;
  status: string;       // pending | invalid | error | approved | denied
  /** Server-stamped when the evidence trigger failed — card is deny-only. */
  triggerError?: string;
  validationErrors?: string[];
  createdAt?: number;
  // Stamped by the resolve callable — surfaced in the History view.
  reviewedAt?: number;
  reviewedBy?: string;
  note?: string;
}

/** Everything the staff queue shows: pending requests + the server-flagged invalid ones. */
export async function getAdminAccessRequests(): Promise<AdminRequest[]> {
  const snap = await getDocs(query(collection(db, "courseAdminRequests"), where("status", "in", ["pending", "invalid", "error"])));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminRequest, "id">) }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Resolved requests (approved/denied) — the History tab, newest decision first. */
export async function getResolvedAdminRequests(max = 60): Promise<AdminRequest[]> {
  const snap = await getDocs(query(collection(db, "courseAdminRequests"), where("status", "in", ["approved", "denied"])));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AdminRequest, "id">) }))
    .sort((a, b) => ((b.reviewedAt ?? b.createdAt ?? 0) - (a.reviewedAt ?? a.createdAt ?? 0)))
    .slice(0, max);
}

export interface ResolveAdminResult { ok?: boolean; alreadyResolved?: boolean; status?: string; error?: string }

/**
 * THE ONLY way to act on a request. The callable re-checks staff server-side
 * with the Admin SDK; approve arrayUnions the requester's canonical id into
 * the course's adminIds (plus the owner's, so no predicate anywhere demotes
 * the owner); deny changes nothing on the course. Idempotent on double-click.
 */
export async function resolveCourseAdminRequest(requestId: string, decision: "approve" | "deny", note?: string): Promise<ResolveAdminResult> {
  const fn = httpsCallable<{ requestId: string; decision: "approve" | "deny"; note?: string }, ResolveAdminResult>(functions, "resolveCourseAdminRequest");
  const res = await fn({ requestId, decision, ...(note ? { note } : {}) });
  return res.data ?? {};
}
