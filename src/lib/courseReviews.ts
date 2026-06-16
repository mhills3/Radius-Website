import { db } from "./firebase";
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc } from "firebase/firestore";

/**
 * Course reviews — EXACT cross-platform contract (verified against iOS FirestoreService.swift
 * and Android CourseSyncService.kt):
 *
 *   Reviews live in the SUBCOLLECTION  courses/{courseId}/reviews/{reviewId}
 *   Fields: id, courseId, authorName, authorUid, authorPhotoUrl?, rating (Int 1-5),
 *           comment (String), dateMillis (Long, ms epoch), photoUrl?
 *   Aggregates on the course doc: rating (Double avg) + reviewCount (Int).
 *
 * Both apps ALSO fall back to a top-level `courseReviews` collection (legacy iOS) and an inline
 * `reviews` array on the course doc, so we read all three and de-dupe by review id. There is no
 * per-review moderation flag — every review is public.
 */
export interface CourseReviewItem {
  id: string;
  authorName: string;
  authorUid: string;
  authorPhotoUrl?: string;
  rating: number;
  comment: string;
  dateMillis: number;
  photoUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseReview(id: string, r: any): CourseReviewItem | null {
  if (!r || typeof r !== "object") return null;
  const rating = Number(r.rating) || 0;
  const comment = String(r.comment ?? r.text ?? r.review ?? "");
  if (!comment && !(rating > 0)) return null;
  const dateMillis = Number(r.dateMillis ?? r.date ?? r.createdAt ?? 0) || 0;
  const photo = typeof r.authorPhotoUrl === "string" && /^https?:\/\//.test(r.authorPhotoUrl) ? r.authorPhotoUrl : undefined;
  const img = typeof r.photoUrl === "string" && /^https?:\/\//.test(r.photoUrl) ? r.photoUrl : undefined;
  return {
    id: String(r.id || id),
    authorName: String(r.authorName ?? r.author ?? r.username ?? "Player"),
    authorUid: String(r.authorUid ?? r.authorId ?? r.userId ?? ""),
    authorPhotoUrl: photo,
    rating: Math.max(0, Math.min(5, Math.round(rating))),
    comment,
    dateMillis,
    photoUrl: img,
  };
}

/** Read every review for a course from all three sources the apps use, de-duped by id, newest first. */
export async function getCourseReviews(courseId: string): Promise<CourseReviewItem[]> {
  const byId = new Map<string, CourseReviewItem>();
  const add = (it: CourseReviewItem | null) => { if (it) byId.set(it.id, it); };

  // 1. Primary: courses/{courseId}/reviews subcollection
  try {
    const snap = await getDocs(collection(db, "courses", courseId, "reviews"));
    snap.docs.forEach((d) => add(parseReview(d.id, d.data())));
  } catch { /* ignore */ }

  // 2. Legacy top-level courseReviews where courseId == this course
  try {
    const snap = await getDocs(query(collection(db, "courseReviews"), where("courseId", "==", courseId)));
    snap.docs.forEach((d) => add(parseReview(d.id, d.data())));
  } catch { /* ignore */ }

  // 3. Legacy inline array on the course doc
  try {
    const cs = await getDoc(doc(db, "courses", courseId));
    const arr = cs.exists() && Array.isArray(cs.data().reviews) ? cs.data().reviews : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    arr.forEach((r: any, i: number) => add(parseReview(`inline_${i}`, r)));
  } catch { /* ignore */ }

  return [...byId.values()].sort((a, b) => b.dateMillis - a.dateMillis);
}

/**
 * Publish (or update) the current user's review, then recompute the course's aggregate
 * rating + reviewCount — exactly as the apps do. Re-reviewing replaces the user's existing
 * review (matched by authorUid) instead of stacking duplicates. Returns the fresh review list.
 */
export async function submitCourseReview(
  courseId: string,
  input: { uid: string; authorName: string; authorPhotoUrl?: string; rating: number; comment: string; dateMillis: number },
): Promise<CourseReviewItem[]> {
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  const comment = input.comment.trim();

  // Reuse this user's existing review id so an edit overwrites rather than duplicates.
  const existing = await getCourseReviews(courseId);
  const mine = existing.find((r) => r.authorUid && r.authorUid === input.uid && !r.id.startsWith("inline_"));
  const reviewId = mine?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${input.uid}_${input.dateMillis}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docData: Record<string, any> = {
    id: reviewId,
    courseId,
    authorName: input.authorName || "Player",
    authorUid: input.uid,
    rating,
    comment,
    dateMillis: input.dateMillis,
  };
  if (input.authorPhotoUrl) docData.authorPhotoUrl = input.authorPhotoUrl;

  await setDoc(doc(db, "courses", courseId, "reviews", reviewId), docData, { merge: true });

  // Recompute aggregate from the canonical subcollection + legacy sources.
  const all = await getCourseReviews(courseId);
  const rated = all.filter((r) => r.rating > 0);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
  try {
    await updateDoc(doc(db, "courses", courseId), { rating: avg, reviewCount: rated.length, lastModified: input.dateMillis });
  } catch { /* aggregate is best-effort; the review itself is saved */ }

  return all;
}
