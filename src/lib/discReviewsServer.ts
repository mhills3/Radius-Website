import { cache } from "react";
import { REST_BASE, fsDoc } from "./firestoreRest";

const KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE";

export interface DiscReviewSEO {
  id: string;
  rating: number;
  text: string;
  author: string;
  authorPhotoUrl?: string;
  createdAt: number;
}

export const getDiscReviewsServer = cache(async (slug: string): Promise<DiscReviewSEO[]> => {
  try {
    const body = {
      structuredQuery: {
        from: [{ collectionId: "discReviews" }],
        where: { fieldFilter: { field: { fieldPath: "discSlug" }, op: "EQUAL", value: { stringValue: slug } } },
        limit: 200,
      },
    };
    const r = await fetch(`${REST_BASE}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), next: { revalidate: 120 } });
    if (!r.ok) return [];
    const arr = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (arr as any[])
      .filter((e) => e.document)
      .map((e) => { const d = fsDoc(e.document); return { id: d.id as string, rating: Number(d.rating) || 0, text: (d.text as string) ?? "", author: (d.authorName as string) ?? "Radius player", authorPhotoUrl: typeof d.authorPhotoUrl === "string" && /^https?:\/\//.test(d.authorPhotoUrl as string) ? (d.authorPhotoUrl as string) : undefined, createdAt: Number(d.createdAt) || 0 }; })
      .filter((r) => r.text.trim() || r.rating > 0)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
});
