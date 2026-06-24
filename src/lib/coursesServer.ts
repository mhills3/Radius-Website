// Firestore access via the REST API (used by server components for SEO metadata + sitemap).
// The gRPC client SDK can't reach Firestore from the Next server runtime, so these use
// plain fetch against the REST endpoint instead. Only called from server code.
import { cache } from "react";
import { isPubliclyListed, isPrivateCourse, docToCourse, type Course } from "./courses";

const PROJECT = "radius-dg";
const KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const ref = (id: string) => `projects/${PROJECT}/databases/(default)/documents/courses/${id}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sv(f: any): unknown {
  if (!f) return undefined;
  if ("stringValue" in f) return f.stringValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return f.doubleValue;
  if ("booleanValue" in f) return f.booleanValue;
  if ("timestampValue" in f) return Date.parse(f.timestampValue);
  if ("nullValue" in f) return null;
  if ("arrayValue" in f) return (f.arrayValue?.values || []).map(sv);
  if ("mapValue" in f) { const o: Record<string, unknown> = {}; const fs = f.mapValue?.fields || {}; for (const k in fs) o[k] = sv(fs[k]); return o; }
  return undefined;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDoc(d: any): Record<string, unknown> {
  const id = (d.name as string).split("/").pop()!;
  const out: Record<string, unknown> = { id };
  for (const k in d.fields || {}) out[k] = sv(d.fields[k]);
  return out;
}

export interface CourseMeta {
  id: string;
  name: string;
  city?: string;
  state?: string;
  holeCount?: number;
  par?: number;
  description?: string;
  coverPhotoUrl?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  dateCreated?: number;
  courseType?: string;
}

// cache() dedupes the call so generateMetadata + the page body share one fetch per request.
export const getCourseMetaByShortId = cache(async (shortId: string): Promise<CourseMeta | null> => {
  const body = {
    structuredQuery: {
      from: [{ collectionId: "courses" }],
      where: { compositeFilter: { op: "AND", filters: [
        { fieldFilter: { field: { fieldPath: "__name__" }, op: "GREATER_THAN_OR_EQUAL", value: { referenceValue: ref(shortId) } } },
        { fieldFilter: { field: { fieldPath: "__name__" }, op: "LESS_THAN", value: { referenceValue: ref(shortId + "\uf8ff") } } },
      ] } },
      select: { fields: ["name", "city", "state", "holeCount", "par", "description", "coverPhotoUrl", "latitude", "longitude", "rating", "reviewCount", "courseType"].map((fieldPath) => ({ fieldPath })) },
      limit: 1,
    },
  };
  try {
    const r = await fetch(`${BASE}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), next: { revalidate: 86400 } });
    if (!r.ok) return null;
    const arr = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hit = (arr as any[]).find((e) => e.document);
    return hit ? (parseDoc(hit.document) as unknown as CourseMeta) : null;
  } catch {
    return null;
  }
});

/**
 * Full course (incl. holes/layouts) via REST, mapped to the client `Course` shape — so the course
 * detail page can SERVER-RENDER its content (H1, description, hole-by-hole table, ratings) into the
 * HTML for SEO, instead of leaving an empty client shell. cache() dedupes with generateMetadata.
 */
export const getCourseFullByShortId = cache(async (shortId: string): Promise<Course | null> => {
  const body = {
    structuredQuery: {
      from: [{ collectionId: "courses" }],
      where: { compositeFilter: { op: "AND", filters: [
        { fieldFilter: { field: { fieldPath: "__name__" }, op: "GREATER_THAN_OR_EQUAL", value: { referenceValue: ref(shortId) } } },
        { fieldFilter: { field: { fieldPath: "__name__" }, op: "LESS_THAN", value: { referenceValue: ref(shortId + "\uf8ff") } } },
      ] } },
      limit: 1, // NB: no `select` — we want the whole doc (holes, layouts, etc.)
    },
  };
  try {
    const r = await fetch(`${BASE}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), next: { revalidate: 86400 } });
    if (!r.ok) return null;
    const arr = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hit = (arr as any[]).find((e) => e.document);
    if (!hit) return null;
    const data = parseDoc(hit.document);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return docToCourse(data.id as string, data as any);
  } catch {
    return null;
  }
});

/** All courses (id + name + state + created) for the sitemap. */
export async function listCoursesLite(): Promise<CourseMeta[]> {
  const out: CourseMeta[] = [];
  let token = "";
  try {
    do {
      const mask = ["name", "city", "state", "dateCreated", "lastModified", "reviewStatus", "isDraft", "courseType"].map((m) => `&mask.fieldPaths=${m}`).join("");
      const url = `${BASE}/courses?pageSize=300&key=${KEY}${token ? `&pageToken=${token}` : ""}${mask}`;
      const r = await fetch(url, { next: { revalidate: 86400 } });
      if (!r.ok) break;
      const j = await r.json();
      for (const d of j.documents || []) {
        const o = parseDoc(d) as Record<string, unknown>;
        const raw = (o.dateCreated as number) || (o.lastModified as number) || 0;
        const dc = raw > 1e12 ? raw : raw > 1e9 ? raw * 1000 : raw > 1e7 ? (raw + 978307200) * 1000 : 0;
        // Never list drafts/pending/rejected or PRIVATE courses in the sitemap — they must stay
        // out of search engines, matching the apps' visibility rules.
        const c = { reviewStatus: o.reviewStatus as string | undefined, isDraft: o.isDraft as boolean | undefined, courseType: o.courseType as string | undefined };
        if (o.name && isPubliclyListed(c) && !isPrivateCourse(c)) out.push({ id: o.id as string, name: o.name as string, city: o.city as string | undefined, state: o.state as string | undefined, dateCreated: dc });
      }
      token = j.nextPageToken || "";
    } while (token);
  } catch {
    /* return what we have */
  }
  return out;
}
