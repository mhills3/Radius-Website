import { cache } from "react";
import { REST_BASE, fsDoc } from "./firestoreRest";

const KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE";

export interface PublishedStory {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  body: string;
  coverUrl?: string;
  tags: string[];
  author: string;
  dateMs: number;
  readMins: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runQuery(structuredQuery: any): Promise<Record<string, unknown>[]> {
  try {
    const r = await fetch(`${REST_BASE}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery }), next: { revalidate: 300 } });
    if (!r.ok) return [];
    const arr = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (arr as any[]).filter((e) => e.document).map((e) => fsDoc(e.document));
  } catch {
    return [];
  }
}

function toPub(d: Record<string, unknown>): PublishedStory {
  return {
    slug: (d.slug as string) ?? (d.id as string),
    title: (d.title as string) ?? "",
    excerpt: (d.excerpt as string) ?? "",
    category: (d.category as string) ?? "News",
    body: (d.body as string) ?? "",
    coverUrl: typeof d.coverUrl === "string" && /^https?:\/\//.test(d.coverUrl as string) ? (d.coverUrl as string) : undefined,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    author: (d.authorName as string) ?? "Radius writer",
    dateMs: Number(d.publishedAt) || Number(d.createdAt) || Number(d.updatedAt) || 0,
    readMins: Number(d.readMins) || 1,
  };
}

// equality-only filter (no composite index needed); sort in JS.
export const getPublishedStories = cache(async (): Promise<PublishedStory[]> => {
  const docs = await runQuery({
    from: [{ collectionId: "stories" }],
    where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } },
    limit: 100,
  });
  return docs.map(toPub).filter((s) => s.title).sort((a, b) => b.dateMs - a.dateMs);
});

export const getStoryBySlugServer = cache(async (slug: string): Promise<PublishedStory | null> => {
  const docs = await runQuery({
    from: [{ collectionId: "stories" }],
    where: { compositeFilter: { op: "AND", filters: [
      { fieldFilter: { field: { fieldPath: "slug" }, op: "EQUAL", value: { stringValue: slug } } },
      { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "published" } } },
    ] } },
    limit: 1,
  });
  return docs.length ? toPub(docs[0]) : null;
});
