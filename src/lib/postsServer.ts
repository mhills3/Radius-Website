import { cache } from "react";
import { fsGet, fsList } from "./firestoreRest";

const http = (u: unknown) => (typeof u === "string" && /^https?:\/\//.test(u) ? u : undefined);
function ms(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  if (n > 1e12) return n;
  if (n > 1e9) return n * 1000;
  if (n > 1e7) return (n + 978307200) * 1000;
  return 0;
}
const handle = (h: unknown) => (typeof h === "string" ? h.replace(/^@+/, "") : undefined);

export interface CommentSEO { id: string; authorName: string; authorHandle?: string; text: string; createdAt: number }
export interface PostSEO {
  id: string; text: string; authorName: string; authorHandle?: string; authorPhotoUrl?: string;
  createdAt: number; likeCount: number; commentCount: number; imageUrl?: string;
  linkedCourseName?: string; scoreToPar?: number | null; taggedDiscName?: string;
}
export interface ThreadSEO {
  id: string; title: string; body: string; category: string; authorName: string; authorHandle?: string; authorPhotoUrl?: string;
  createdAt: number; score: number; replyCount: number; viewCount: number; imageUrl?: string;
}

export const getPostById = cache(async (id: string): Promise<PostSEO | null> => {
  const p = await fsGet(`posts/${id}`);
  if (!p) return null;
  return {
    id,
    text: (p.text as string) ?? "",
    authorName: (p.authorName as string) ?? "Radius player",
    authorHandle: handle(p.authorHandle),
    authorPhotoUrl: http(p.authorPhotoUrl),
    createdAt: ms(p.createdAt ?? p.date),
    likeCount: Number(p.likeCount) || 0,
    commentCount: Number(p.commentCount) || 0,
    imageUrl: http(p.imageUrl),
    linkedCourseName: (p.linkedCourseName as string) || undefined,
    scoreToPar: typeof p.linkedScoreToPar === "number" ? (p.linkedScoreToPar as number) : null,
    taggedDiscName: (p.taggedDiscName as string) || undefined,
  };
});

export async function getPostComments(id: string): Promise<CommentSEO[]> {
  const rows = await fsList(`posts/${id}/comments`, { max: 200 });
  return rows
    .map((c) => ({ id: c.id as string, authorName: (c.authorName as string) ?? "Radius player", authorHandle: handle(c.authorHandle), text: (c.text as string) ?? (c.body as string) ?? "", createdAt: ms(c.createdAt ?? c.date) }))
    .filter((c) => c.text.trim())
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listPosts(): Promise<{ id: string; createdAt: number }[]> {
  const rows = await fsList("posts", { mask: ["createdAt", "text"], max: 4000 });
  return rows.filter((p) => p.text).map((p) => ({ id: p.id as string, createdAt: ms(p.createdAt) }));
}

export const getThreadByIdSEO = cache(async (id: string): Promise<ThreadSEO | null> => {
  const t = await fsGet(`threads/${id}`);
  if (!t) return null;
  return {
    id,
    title: (t.title as string) ?? "",
    body: (t.body as string) ?? (t.preview as string) ?? "",
    category: (t.category as string) ?? "General",
    authorName: (t.authorName as string) ?? "Radius player",
    authorHandle: handle(t.authorHandle),
    authorPhotoUrl: http(t.authorPhotoUrl),
    createdAt: ms(t.createdAt ?? t.date),
    score: (Number(t.upvotes) || 0) - (Number(t.downvotes) || 0),
    replyCount: Number(t.replyCount) || 0,
    viewCount: Number(t.viewCount) || 0,
    imageUrl: http(t.imageUrl),
  };
});

export async function getThreadRepliesSEO(id: string): Promise<CommentSEO[]> {
  const rows = await fsList(`threads/${id}/replies`, { max: 300 });
  return rows
    .map((r) => ({ id: r.id as string, authorName: (r.authorName as string) ?? "Radius player", authorHandle: handle(r.authorHandle), text: (r.text as string) ?? (r.body as string) ?? "", createdAt: ms(r.createdAt ?? r.date) }))
    .filter((r) => r.text.trim())
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function listThreads(): Promise<{ id: string; createdAt: number }[]> {
  const rows = await fsList("threads", { mask: ["createdAt", "title"], max: 4000 });
  return rows.filter((t) => t.title).map((t) => ({ id: t.id as string, createdAt: ms(t.createdAt) }));
}
