import { db } from "./firebase";
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, limit } from "firebase/firestore";
import { getProfileLite } from "./account";

export interface DiscReview {
  id: string;
  discSlug: string;
  rating: number; // 0 = comment only (no star rating), 1–5 = review
  text: string;
  authorId: string;
  authorName: string;
  authorHandle?: string;
  authorPhotoUrl?: string;
  createdAt: number;
}

function uuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function map(id: string, d: Record<string, unknown>): DiscReview {
  return {
    id,
    discSlug: (d.discSlug as string) ?? "",
    rating: Number(d.rating) || 0,
    text: (d.text as string) ?? "",
    authorId: (d.authorId as string) ?? "",
    authorName: (d.authorName as string) ?? "Radius player",
    authorHandle: (d.authorHandle as string | undefined)?.replace(/^@/, ""),
    authorPhotoUrl: (d.authorPhotoUrl as string) || undefined,
    createdAt: Number(d.createdAt) || 0,
  };
}

export async function getDiscReviews(slug: string): Promise<DiscReview[]> {
  try {
    const snap = await getDocs(query(collection(db, "discReviews"), where("discSlug", "==", slug), limit(200)));
    return snap.docs.map((s) => map(s.id, s.data())).filter((r) => r.text.trim() || r.rating > 0).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function addDiscReview(uid: string, slug: string, rating: number, text: string): Promise<DiscReview | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const id = uuid();
  const now = Date.now();
  const review: DiscReview = {
    id, discSlug: slug, rating, text: text.trim(),
    authorId: profile.canonicalId, authorName: profile.name || "Radius player",
    authorHandle: profile.username, authorPhotoUrl: profile.profileImageUrl, createdAt: now,
  };
  const payload = Object.fromEntries(Object.entries(review).filter(([, v]) => v !== undefined));
  await setDoc(doc(db, "discReviews", id), payload);
  return review;
}

export async function deleteDiscReview(id: string): Promise<void> {
  await deleteDoc(doc(db, "discReviews", id));
}

export interface DiscBuzz { count: number; avg: number }
/** One read → per-disc review/comment counts + avg rating, keyed by disc slug. */
export async function getDiscReviewCounts(): Promise<Map<string, DiscBuzz>> {
  try {
    const snap = await getDocs(collection(db, "discReviews"));
    const agg = new Map<string, { count: number; sum: number; rated: number }>();
    snap.forEach((s) => {
      const d = s.data();
      const slug = d.discSlug as string;
      if (!slug) return;
      const a = agg.get(slug) ?? { count: 0, sum: 0, rated: 0 };
      a.count++;
      if ((Number(d.rating) || 0) > 0) { a.sum += Number(d.rating); a.rated++; }
      agg.set(slug, a);
    });
    const out = new Map<string, DiscBuzz>();
    for (const [slug, a] of agg) out.set(slug, { count: a.count, avg: a.rated ? a.sum / a.rated : 0 });
    return out;
  } catch {
    return new Map();
  }
}
