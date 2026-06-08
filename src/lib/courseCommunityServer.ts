import { cache } from "react";
import { REST_BASE, fsDoc } from "./firestoreRest";

const KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE";

export interface CoursePostSEO { id: string; text: string; author: string; authorPhotoUrl?: string; createdAt: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runQuery(collectionId: string, courseId: string, lim = 200): Promise<Record<string, unknown>[]> {
  try {
    const body = { structuredQuery: { from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath: "courseId" }, op: "EQUAL", value: { stringValue: courseId } } }, limit: lim } };
    const r = await fetch(`${REST_BASE}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), next: { revalidate: 120 } });
    if (!r.ok) return [];
    const arr = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (arr as any[]).filter((e) => e.document).map((e) => fsDoc(e.document));
  } catch {
    return [];
  }
}

export const getCourseDiscussionServer = cache(async (courseId: string): Promise<CoursePostSEO[]> => {
  const docs = await runQuery("courseDiscussions", courseId);
  return docs
    .map((d) => ({ id: d.id as string, text: (d.text as string) ?? "", author: (d.authorName as string) ?? "Radius player", authorPhotoUrl: typeof d.authorPhotoUrl === "string" && /^https?:\/\//.test(d.authorPhotoUrl as string) ? (d.authorPhotoUrl as string) : undefined, createdAt: Number(d.createdAt) || 0 }))
    .filter((p) => p.text.trim())
    .sort((a, b) => b.createdAt - a.createdAt);
});

export const getCourseMemberCountServer = cache(async (courseId: string): Promise<number> => {
  const docs = await runQuery("courseMembers", courseId, 1000);
  return docs.length;
});
