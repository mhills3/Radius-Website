import { db } from "./firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField,
} from "firebase/firestore";
import { getProfileLite, resolveCanonicalId } from "./account";
import { createNotification } from "./notifications";
import type { MentionUser } from "./leaderboard";

export interface FeedPost {
  id: string;
  text: string;
  authorName: string;
  authorHandle?: string;
  authorPhotoUrl?: string;
  authorId?: string;
  createdAt: number;
  likeCount: number;
  commentCount: number;
  imageUrl?: string;
  taggedDiscName?: string;
  taggedDiscBrand?: string;
  taggedDiscSlug?: string;
  taggedCourseId?: string;
  taggedCourseSlug?: string;
  taggedCourseName?: string;
  taggedUsers?: { id: string; name: string; username: string }[];
  linkedCourseName?: string;
  linkedCourseSlug?: string;
  linkedCourseCover?: string;
  linkedBirdies?: number | null;
  scoreToPar?: number | null;
  holesPlayed?: number | null;
  reactions?: Record<string, number>;
}

// Reaction palette (web-side; total still tracked by likeCount for app parity).
export const REACTIONS: { key: string; emoji: string; label: string }[] = [
  { key: "like", emoji: "👍", label: "Like" },
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "disc", emoji: "🥏", label: "Nice" },
  { key: "wow", emoji: "😮", label: "Wow" },
  { key: "clap", emoji: "👏", label: "Respect" },
];
export const reactionEmoji = (k?: string) => REACTIONS.find((r) => r.key === k)?.emoji ?? "👍";

/** User-generated image URLs can be arbitrary/invalid (e.g. Android content:// URIs) — keep only real http(s) URLs. */
function safeHttp(u: unknown): string | undefined {
  return typeof u === "string" && /^https?:\/\//.test(u) ? u : undefined;
}

export async function getFeed(max = 40, before?: number): Promise<FeedPost[]> {
  try {
    const base = collection(db, "posts");
    const q = before
      ? query(base, where("createdAt", "<", before), orderBy("createdAt", "desc"), limit(max))
      : query(base, orderBy("createdAt", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const p = d.data();
        if (p.isDeleted) return null;
        return {
          id: d.id as string, // the Firestore doc id — comments/likes/reactions all live under this path
          text: (p.text ?? "") as string,
          authorName: (p.authorName ?? "Radius player") as string,
          authorHandle: (p.authorHandle as string | undefined)?.replace(/^@+/, "") || undefined,
          authorPhotoUrl: safeHttp(p.authorPhotoUrl),
          authorId: (p.createdById ?? p.authorId) as string | undefined,
          createdAt: (p.createdAt ?? p.date ?? p.lastUpdated ?? 0) as number,
          likeCount: (p.likeCount ?? 0) as number,
          commentCount: (p.commentCount ?? 0) as number,
          imageUrl: safeHttp(p.imageUrl ?? p.postImageUrl),
          taggedDiscName: p.taggedDiscName ?? undefined,
          taggedDiscBrand: p.taggedDiscBrand ?? undefined,
          taggedDiscSlug: p.taggedDiscSlug ?? undefined,
          taggedCourseId: p.taggedCourseId ?? undefined,
          taggedCourseSlug: p.taggedCourseSlug ?? undefined,
          taggedCourseName: p.taggedCourseName ?? undefined,
          taggedUsers: Array.isArray(p.taggedUsers) ? (p.taggedUsers as { id: string; name: string; username: string }[]) : undefined,
          linkedCourseName: p.linkedCourseName ?? p.courseName ?? undefined,
          linkedCourseSlug: p.linkedCourseSlug ?? p.taggedCourseSlug ?? undefined,
          linkedCourseCover: safeHttp(p.linkedCourseCover),
          linkedBirdies: typeof p.linkedBirdies === "number" ? p.linkedBirdies : null,
          scoreToPar: p.linkedScoreToPar ?? p.scoreToPar ?? null,
          holesPlayed: p.linkedHolesPlayed ?? p.holesPlayed ?? null,
          reactions: p.reactions && typeof p.reactions === "object" ? (p.reactions as Record<string, number>) : undefined,
        } as FeedPost;
      })
      .filter((p): p is FeedPost => !!p && (!!p.text.trim() || !!p.imageUrl));
  } catch {
    return [];
  }
}

/** Post ids the user has liked (mirrors the app's userLikes/{uid}.postIds). */
export async function getLikedPostIds(uid: string): Promise<Set<string>> {
  try {
    const snap = await getDoc(doc(db, "userLikes", uid));
    const ids = snap.exists() ? (snap.data().postIds as string[]) ?? [] : [];
    return new Set(ids);
  } catch {
    return new Set();
  }
}

/** Toggle a like exactly like the apps: likes subdoc + likeCount increment + userLikes array. uid = raw auth uid. */
export async function toggleLike(uid: string, postId: string, currentlyLiked: boolean): Promise<void> {
  const likeRef = doc(db, "posts", postId, "likes", uid);
  const postRef = doc(db, "posts", postId);
  const userLikesRef = doc(db, "userLikes", uid);
  if (!currentlyLiked) {
    await setDoc(likeRef, { liked: true, likedAt: Date.now() });
    await updateDoc(postRef, { likeCount: increment(1) });
    await setDoc(userLikesRef, { postIds: arrayUnion(postId) }, { merge: true });
  } else {
    await deleteDoc(likeRef);
    await updateDoc(postRef, { likeCount: increment(-1) });
    await setDoc(userLikesRef, { postIds: arrayRemove(postId) }, { merge: true });
  }
}

/** Like/unlike a comment (or threaded reply) — likes subdoc + likeCount increment. */
export async function toggleCommentLike(uid: string, postId: string, commentId: string, currentlyLiked: boolean): Promise<void> {
  const likeRef = doc(db, "posts", postId, "comments", commentId, "likes", uid);
  const cRef = doc(db, "posts", postId, "comments", commentId);
  if (!currentlyLiked) {
    await setDoc(likeRef, { liked: true, likedAt: Date.now() });
    await updateDoc(cRef, { likeCount: increment(1) });
  } else {
    await deleteDoc(likeRef);
    await updateDoc(cRef, { likeCount: increment(-1) });
  }
}

/** Comment ids the user has liked on a post. */
export async function getLikedCommentIds(uid: string, postId: string): Promise<Set<string>> {
  try {
    const snap = await getDocs(collection(db, "posts", postId, "comments"));
    const liked = new Set<string>();
    await Promise.all(snap.docs.map(async (c) => {
      const l = await getDoc(doc(db, "posts", postId, "comments", c.id, "likes", uid));
      if (l.exists()) liked.add(c.id);
    }));
    return liked;
  } catch {
    return new Set();
  }
}

/** The user's reaction type per post (web-side map). */
export async function getReactionMap(uid: string): Promise<Record<string, string>> {
  try {
    const snap = await getDoc(doc(db, "userReactions", uid));
    return snap.exists() ? (snap.data() as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * React to a post. Keeps likeCount canonical (= number of reactors, synced to app)
 * while a denormalized `reactions` map on the post holds the emoji mix (app ignores it).
 */
export async function setReaction(uid: string, postId: string, newType: string, oldType?: string): Promise<void> {
  const postRef = doc(db, "posts", postId);
  const userLikesRef = doc(db, "userLikes", uid);
  const userReRef = doc(db, "userReactions", uid);
  if (oldType && oldType === newType) {
    // remove reaction
    await updateDoc(postRef, { [`reactions.${newType}`]: increment(-1), likeCount: increment(-1) });
    await setDoc(userLikesRef, { postIds: arrayRemove(postId) }, { merge: true });
    await setDoc(userReRef, { [postId]: deleteField() }, { merge: true });
  } else if (oldType) {
    // switch reaction type (count unchanged)
    await updateDoc(postRef, { [`reactions.${oldType}`]: increment(-1), [`reactions.${newType}`]: increment(1) });
    await setDoc(userReRef, { [postId]: newType }, { merge: true });
  } else {
    // new reaction
    await updateDoc(postRef, { [`reactions.${newType}`]: increment(1), likeCount: increment(1) });
    await setDoc(userLikesRef, { postIds: arrayUnion(postId) }, { merge: true });
    await setDoc(userReRef, { [postId]: newType }, { merge: true });
  }
}

/** Create a text post in the exact shape the iOS/Android apps read (createdById = canonical id). */
export interface CourseTag { id: string; slug: string; name: string }
export interface DiscTag { name: string; brand: string; slug: string }

export interface SharedRound { courseName: string; scoreToPar: number; holesPlayed: number; birdies?: number; cover?: string; slug?: string; courseId?: string }
export async function createPost(uid: string, text: string, opts?: { course?: CourseTag; disc?: DiscTag; imageUrl?: string; mentions?: MentionUser[]; round?: SharedRound }): Promise<FeedPost | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const course = opts?.course;
  const disc = opts?.disc;
  const imageUrl = opts?.imageUrl;
  const mentions = opts?.mentions ?? [];
  const round = opts?.round;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  const data = {
    id,
    authorName: profile.name,
    authorHandle: profile.username,
    authorId: profile.canonicalId,
    createdById: profile.canonicalId,
    authorPhotoUrl: profile.profileImageUrl ?? null,
    text,
    imageUrl: imageUrl ?? null,
    taggedDiscName: disc?.name ?? null,
    taggedDiscBrand: disc?.brand ?? null,
    taggedDiscSlug: disc?.slug ?? null,
    taggedDiscFlight: null,
    taggedCourseId: course?.id ?? round?.courseId ?? null,
    taggedCourseSlug: course?.slug ?? round?.slug ?? null,
    taggedCourseName: course?.name ?? (round ? round.courseName : null),
    taggedUserIds: mentions.map((m) => m.id),
    taggedUsers: mentions.map((m) => ({ id: m.id, name: m.name, username: m.username })),
    linkedCourseName: round?.courseName ?? null,
    linkedCourseSlug: round?.slug ?? null,
    linkedCourseCover: round?.cover ?? null,
    linkedBirdies: round?.birdies ?? null,
    linkedScoreToPar: round ? round.scoreToPar : null,
    linkedHolesPlayed: round ? round.holesPlayed : null,
    linkURL: null,
    likeCount: 0,
    commentCount: 0,
    feedType: "trending",
    createdAt: now,
    lastUpdated: now,
  };
  await setDoc(doc(db, "posts", id), data);
  // notify mentioned users (best-effort, skips self)
  for (const m of mentions) await createNotification({ recipientId: m.id, actor: profile, type: "mention", postId: id, preview: text });
  return {
    id,
    text,
    authorName: profile.name,
    authorHandle: profile.username,
    authorPhotoUrl: profile.profileImageUrl,
    authorId: profile.canonicalId,
    createdAt: now,
    likeCount: 0,
    commentCount: 0,
    imageUrl: imageUrl ?? undefined,
    taggedDiscName: disc?.name,
    taggedDiscBrand: disc?.brand,
    taggedDiscSlug: disc?.slug,
    taggedCourseId: course?.id ?? round?.courseId,
    taggedCourseSlug: course?.slug ?? round?.slug,
    taggedCourseName: course?.name ?? round?.courseName,
    taggedUsers: mentions.map((m) => ({ id: m.id, name: m.name, username: m.username })),
    linkedCourseName: round?.courseName,
    linkedCourseSlug: round?.slug,
    linkedCourseCover: round?.cover,
    linkedBirdies: round?.birdies ?? null,
    scoreToPar: round ? round.scoreToPar : null,
    holesPlayed: round ? round.holesPlayed : null,
  };
}

/** Community feed posts that tagged a given disc (by slug), newest first. */
export async function getPostsTaggingDisc(slug: string, max = 20): Promise<FeedPost[]> {
  try {
    const snap = await getDocs(query(collection(db, "posts"), where("taggedDiscSlug", "==", slug), limit(max)));
    return snap.docs
      .map((d) => { const p = d.data(); if (p.isDeleted) return null; return {
        id: d.id as string, text: (p.text ?? "") as string,
        authorName: (p.authorName ?? "Radius player") as string,
        authorHandle: (p.authorHandle as string | undefined)?.replace(/^@+/, "") || undefined,
        authorPhotoUrl: safeHttp(p.authorPhotoUrl), authorId: (p.createdById ?? p.authorId) as string | undefined,
        createdAt: (p.createdAt ?? p.lastUpdated ?? 0) as number,
        likeCount: (p.likeCount ?? 0) as number, commentCount: (p.commentCount ?? 0) as number,
        imageUrl: safeHttp(p.imageUrl ?? p.postImageUrl),
        taggedDiscName: p.taggedDiscName ?? undefined, taggedDiscBrand: p.taggedDiscBrand ?? undefined, taggedDiscSlug: p.taggedDiscSlug ?? undefined,
      } as FeedPost; })
      .filter((p): p is FeedPost => !!p && !!p.text.trim())
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/** Community feed posts that tagged a given course (newest first). */
export async function getPostsTaggingCourse(courseId: string, max = 20): Promise<FeedPost[]> {
  try {
    const snap = await getDocs(query(collection(db, "posts"), where("taggedCourseId", "==", courseId), limit(max)));
    return snap.docs
      .map((d) => { const p = d.data(); if (p.isDeleted) return null; return {
        id: d.id as string, text: (p.text ?? "") as string,
        authorName: (p.authorName ?? "Radius player") as string,
        authorHandle: (p.authorHandle as string | undefined)?.replace(/^@+/, "") || undefined,
        authorPhotoUrl: safeHttp(p.authorPhotoUrl), authorId: (p.createdById ?? p.authorId) as string | undefined,
        createdAt: (p.createdAt ?? p.lastUpdated ?? 0) as number,
        likeCount: (p.likeCount ?? 0) as number, commentCount: (p.commentCount ?? 0) as number,
        taggedCourseId: p.taggedCourseId ?? undefined, taggedCourseSlug: p.taggedCourseSlug ?? undefined, taggedCourseName: p.taggedCourseName ?? undefined,
      } as FeedPost; })
      .filter((p): p is FeedPost => !!p && !!p.text.trim())
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// ---- Trending discs (aggregate discTrends throwCounts community-wide) ----
export interface TrendingDisc {
  name: string;
  throws: number;
}
const SKIP_TREND = new Set(["score", "tap in", "tap-in", ""]);
export async function getTrendingDiscs(max = 8): Promise<TrendingDisc[]> {
  try {
    const snap = await getDocs(query(collection(db, "discTrends"), limit(4000))); // all-time: aggregate every throw-log doc
    const agg = new Map<string, number>();
    snap.forEach((d) => {
      const tc = (d.data().throwCounts as Record<string, number>) ?? {};
      for (const [k, v] of Object.entries(tc)) {
        if (SKIP_TREND.has(k.toLowerCase())) continue;
        agg.set(k, (agg.get(k) ?? 0) + (Number(v) || 0));
      }
    });
    return [...agg.entries()].map(([name, throws]) => ({ name, throws })).sort((a, b) => b.throws - a.throws).slice(0, max);
  } catch {
    return [];
  }
}

// ---- Comments ----
export interface Comment {
  id: string;
  authorName: string;
  authorHandle?: string;
  authorPhotoUrl?: string;
  authorId?: string;
  text: string;
  createdAt: number;
  likeCount: number;
  parentCommentId?: string | null;
  taggedUsers?: { id: string; name: string; username: string }[];
}
// Resolve current profile photos by user id (batched + session-cached). Used to backfill comment
// avatars — many older comments never stored authorPhotoUrl, so we look it up from the profile.
const photoCache = new Map<string, string | null>();
export async function getProfilePhotos(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const need: string[] = [];
  for (const id of new Set(ids.filter(Boolean))) {
    if (photoCache.has(id)) { const p = photoCache.get(id); if (p) out.set(id, p); }
    else need.push(id);
  }
  await Promise.all(need.slice(0, 60).map(async (id) => {
    try {
      // Comments written by the apps can carry a raw auth uid while the user's real doc lives
      // under their canonical id — resolve the alias before giving up, or the photo looks missing.
      let s = await getDoc(doc(db, "users", id));
      let url = s.exists() ? safeHttp(s.data().profileImageUrl) : undefined;
      if (!url) {
        const cid = await resolveCanonicalId(id);
        if (cid !== id) {
          s = await getDoc(doc(db, "users", cid));
          url = s.exists() ? safeHttp(s.data().profileImageUrl) : undefined;
        }
      }
      photoCache.set(id, url ?? null);
      if (url) out.set(id, url);
    } catch { photoCache.set(id, null); }
  }));
  return out;
}

export async function getComments(postId: string): Promise<Comment[]> {
  try {
    const snap = await getDocs(query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"), limit(100)));
    const list = snap.docs
      .map((d) => {
        const c = d.data();
        const handle = (c.authorHandle as string | undefined)?.replace(/^@/, "");
        return {
          id: (c.id ?? d.id) as string,
          authorName: (c.authorName ?? "Radius player") as string,
          authorHandle: handle || undefined,
          authorPhotoUrl: safeHttp(c.authorPhotoUrl),
          authorId: (c.createdById ?? c.authorId) as string | undefined,
          text: (c.text ?? "") as string,
          createdAt: (c.createdAt ?? 0) as number,
          likeCount: (c.likeCount ?? 0) as number,
          parentCommentId: (c.parentCommentId as string | null) ?? null,
          taggedUsers: Array.isArray(c.taggedUsers) ? (c.taggedUsers as { id: string; name: string; username: string }[]) : undefined,
        };
      })
      .filter((c) => c.text.trim());
    // Backfill missing avatars from the author's current profile photo.
    const missing = list.filter((c) => !c.authorPhotoUrl && c.authorId).map((c) => c.authorId!);
    if (missing.length) {
      const photos = await getProfilePhotos(missing);
      for (const c of list) if (!c.authorPhotoUrl && c.authorId) { const p = photos.get(c.authorId); if (p) c.authorPhotoUrl = p; }
    }
    return list;
  } catch {
    return [];
  }
}
export async function addComment(uid: string, postId: string, text: string, opts?: { parentCommentId?: string | null; mentions?: MentionUser[]; parentAuthorId?: string | null }): Promise<Comment | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  const mentions = opts?.mentions ?? [];
  const parentCommentId = opts?.parentCommentId ?? null;
  await setDoc(doc(db, "posts", postId, "comments", id), {
    id, postId, text,
    authorName: profile.name, authorHandle: profile.username,
    authorId: profile.canonicalId, createdById: profile.canonicalId,
    authorPhotoUrl: profile.profileImageUrl ?? null, gifUrl: null,
    likeCount: 0, parentCommentId, createdAt: now,
    taggedUserIds: mentions.map((m) => m.id),
    taggedUsers: mentions.map((m) => ({ id: m.id, name: m.name, username: m.username })),
  });
  await updateDoc(doc(db, "posts", postId), { commentCount: increment(1) });
  for (const m of mentions) await createNotification({ recipientId: m.id, actor: profile, type: "mention", postId, preview: text });
  // Notify the comment author when someone replies to their comment (matches the apps).
  if (parentCommentId && opts?.parentAuthorId && !mentions.some((m) => m.id === opts.parentAuthorId)) {
    await createNotification({ recipientId: opts.parentAuthorId, actor: profile, type: "reply", postId, preview: text });
  }
  return { id, authorName: profile.name, authorHandle: profile.username, authorPhotoUrl: profile.profileImageUrl, authorId: profile.canonicalId, text, createdAt: now, likeCount: 0, parentCommentId, taggedUsers: mentions.map((m) => ({ id: m.id, name: m.name, username: m.username })) };
}

/** Reddit-ish hot score: engagement decayed by post age. */
export function hotScore(p: FeedPost): number {
  const hours = Math.max(0, (Date.now() - p.createdAt) / 3600000);
  return (p.likeCount + 2 * p.commentCount + 1) / Math.pow(hours + 2, 1.3);
}

export function timeAgo(ms: number): string {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
