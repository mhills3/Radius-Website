import { NextResponse } from "next/server";
import { getPublishedStories } from "@/lib/storiesServer";
import { getAllPosts } from "@/lib/blog";

// Public JSON feed of stories for the native apps' in-app reader. Includes BOTH the live published
// stories (Firestore) and the seed/editorial posts the website shows, matching /stories.
// Shape per the agreed contract; `contentMarkdown` is the article body (markdown).
export const revalidate = 300;

const SITE = "https://radiusdiscgolf.com";

function toIso(ms: number): string | null {
  if (!ms) return null;
  const n = ms < 1e12 ? ms * 1000 : ms; // tolerate seconds-epoch
  const d = new Date(n);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function GET() {
  const live = await getPublishedStories().catch(() => []);
  const liveSlugs = new Set(live.map((s) => s.slug));

  const fromLive = live.map((s) => ({
    id: s.slug, title: s.title, category: s.category, excerpt: s.excerpt,
    url: `${SITE}/stories/${s.slug}`, coverImageUrl: s.coverUrl ?? null,
    author: s.author, readMinutes: s.readMins, publishedAt: toIso(s.dateMs),
    contentMarkdown: s.body, _t: s.dateMs,
  }));
  const fromSeed = getAllPosts()
    .filter((p) => !liveSlugs.has(p.slug)) // a live story with the same slug supersedes the seed
    .map((p) => {
      const t = new Date(`${p.date}T12:00:00Z`).getTime();
      return {
        id: p.slug, title: p.title, category: p.category, excerpt: p.excerpt,
        url: `${SITE}/stories/${p.slug}`, coverImageUrl: null,
        author: p.author, readMinutes: p.readMins, publishedAt: toIso(t),
        contentMarkdown: p.body, _t: t,
      };
    });

  const stories = [...fromLive, ...fromSeed]
    .sort((a, b) => b._t - a._t)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ _t, ...s }) => s);

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
