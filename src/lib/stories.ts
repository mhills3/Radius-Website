import { db } from "./firebase";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, orderBy, limit } from "firebase/firestore";
import { resolveCanonicalId, getProfileLite } from "./account";

export interface StoryDoc {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  body: string;
  coverUrl?: string;
  tags: string[];
  authorId: string;
  authorName: string;
  authorPhotoUrl?: string;
  status: "published" | "draft";
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
  readMins: number;
}

// Topics span all of disc golf — not just Radius — so writers can cover news, the
// pro tour / PDGA, players, courses, gear, and culture down the road.
export const STORY_CATEGORIES = [
  "News",
  "Pro Tour",
  "Tournaments",
  "Players",
  "Getting Started",
  "Technique",
  "Practice",
  "Gear",
  "Disc Reviews",
  "Course Management",
  "Courses",
  "Improve",
  "Culture",
  "Community",
];

function uuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "story";
}
export function readMinsOf(body: string): number {
  return Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 200));
}

function map(id: string, d: Record<string, unknown>): StoryDoc {
  return {
    id,
    slug: (d.slug as string) ?? id,
    title: (d.title as string) ?? "",
    excerpt: (d.excerpt as string) ?? "",
    category: (d.category as string) ?? "News",
    body: (d.body as string) ?? "",
    coverUrl: (d.coverUrl as string) || undefined,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    authorId: (d.authorId as string) ?? "",
    authorName: (d.authorName as string) ?? "Radius writer",
    authorPhotoUrl: (d.authorPhotoUrl as string) || undefined,
    status: (d.status as "published" | "draft") ?? "draft",
    createdAt: Number(d.createdAt) || 0,
    updatedAt: Number(d.updatedAt) || 0,
    publishedAt: typeof d.publishedAt === "number" ? d.publishedAt : null,
    readMins: Number(d.readMins) || readMinsOf((d.body as string) ?? ""),
  };
}

/** The signed-in user's own stories (drafts + published), newest first. */
export async function getMyStories(uid: string): Promise<StoryDoc[]> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "stories"), where("authorId", "==", cid), limit(100)));
    return snap.docs.map((s) => map(s.id, s.data())).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function getStory(id: string): Promise<StoryDoc | null> {
  try {
    const s = await getDoc(doc(db, "stories", id));
    return s.exists() ? map(s.id, s.data()) : null;
  } catch {
    return null;
  }
}

export interface StoryInput {
  id?: string;
  slug?: string;
  title: string;
  excerpt: string;
  category: string;
  body: string;
  coverUrl?: string;
  tags: string[];
  status: "published" | "draft";
  createdAt?: number;
  publishedAt?: number | null;
}

export async function saveStory(uid: string, input: StoryInput): Promise<StoryDoc | null> {
  const profile = await getProfileLite(uid);
  if (!profile || !profile.writer) return null;
  const now = Date.now();
  const id = input.id || uuid();
  const slug = input.slug || `${kebab(input.title)}-${id.slice(0, 6)}`;
  const createdAt = input.createdAt || now;
  const publishedAt = input.status === "published" ? input.publishedAt || now : input.publishedAt ?? null;
  const story: StoryDoc = {
    id, slug,
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    category: input.category,
    body: input.body,
    coverUrl: input.coverUrl?.trim() || undefined,
    tags: input.tags,
    authorId: profile.canonicalId,
    authorName: profile.name || "Radius writer",
    authorPhotoUrl: profile.profileImageUrl,
    status: input.status,
    createdAt, updatedAt: now, publishedAt,
    readMins: readMinsOf(input.body),
  };
  // strip undefined for Firestore
  const payload = Object.fromEntries(Object.entries(story).filter(([, v]) => v !== undefined));
  await setDoc(doc(db, "stories", id), payload, { merge: true });
  return story;
}

export async function deleteStory(id: string): Promise<void> {
  await deleteDoc(doc(db, "stories", id));
}
