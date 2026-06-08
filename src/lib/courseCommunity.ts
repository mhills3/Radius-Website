import { db } from "./firebase";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, limit } from "firebase/firestore";
import { resolveCanonicalId, getProfileLite } from "./account";

export interface CoursePost {
  id: string;
  courseId: string;
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

function mapPost(id: string, d: Record<string, unknown>): CoursePost {
  return {
    id,
    courseId: (d.courseId as string) ?? "",
    text: (d.text as string) ?? "",
    authorId: (d.authorId as string) ?? "",
    authorName: (d.authorName as string) ?? "Radius player",
    authorHandle: (d.authorHandle as string | undefined)?.replace(/^@/, ""),
    authorPhotoUrl: (d.authorPhotoUrl as string) || undefined,
    createdAt: Number(d.createdAt) || 0,
  };
}

export async function getCourseDiscussion(courseId: string): Promise<CoursePost[]> {
  try {
    const snap = await getDocs(query(collection(db, "courseDiscussions"), where("courseId", "==", courseId), limit(200)));
    return snap.docs.map((s) => mapPost(s.id, s.data())).filter((p) => p.text.trim()).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function addCoursePost(uid: string, courseId: string, text: string): Promise<CoursePost | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const id = uuid();
  const now = Date.now();
  const post: CoursePost = { id, courseId, text: text.trim(), authorId: profile.canonicalId, authorName: profile.name || "Radius player", authorHandle: profile.username, authorPhotoUrl: profile.profileImageUrl, createdAt: now };
  const payload = Object.fromEntries(Object.entries(post).filter(([, v]) => v !== undefined));
  await setDoc(doc(db, "courseDiscussions", id), payload);
  return post;
}

// ---- Group membership ----
export async function isMember(uid: string, courseId: string): Promise<boolean> {
  try {
    const cid = await resolveCanonicalId(uid);
    const s = await getDoc(doc(db, "courseMembers", `${courseId}_${cid}`));
    return s.exists();
  } catch {
    return false;
  }
}
export async function joinCourse(uid: string, courseId: string): Promise<void> {
  const profile = await getProfileLite(uid);
  if (!profile) return;
  await setDoc(doc(db, "courseMembers", `${courseId}_${profile.canonicalId}`), { courseId, uid: profile.canonicalId, name: profile.name || "Radius player", photoUrl: profile.profileImageUrl ?? null, joinedAt: Date.now() }, { merge: true });
}
export async function leaveCourse(uid: string, courseId: string): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await deleteDoc(doc(db, "courseMembers", `${courseId}_${cid}`));
}
export async function getMemberCount(courseId: string): Promise<number> {
  try {
    const snap = await getDocs(query(collection(db, "courseMembers"), where("courseId", "==", courseId), limit(1000)));
    return snap.size;
  } catch {
    return 0;
  }
}
