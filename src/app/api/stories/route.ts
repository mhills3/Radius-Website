import { NextResponse } from "next/server";
import { getPublishedStories } from "@/lib/storiesServer";

// Public JSON feed of published stories for the native apps' in-app reader.
// Shape per the agreed contract; `contentMarkdown` is the article body (markdown).
export const revalidate = 300;

const SITE = "https://www.radiusdiscgolf.com";

function toIso(ms: number): string | null {
  if (!ms) return null;
  const n = ms < 1e12 ? ms * 1000 : ms; // tolerate seconds-epoch
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function GET() {
  const stories = (await getPublishedStories()).map((s) => ({
    id: s.slug,
    title: s.title,
    category: s.category,
    excerpt: s.excerpt,
    url: `${SITE}/stories/${s.slug}`,
    coverImageUrl: s.coverUrl ?? null,
    author: s.author,
    readMinutes: s.readMins,
    publishedAt: toIso(s.dateMs),
    contentMarkdown: s.body,
  }));

  return NextResponse.json(
    { stories },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
