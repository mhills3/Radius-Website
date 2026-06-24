import type { Metadata } from "next";
import { STATE_NAMES, slugify } from "@/lib/courses";
import { listCoursesLite } from "@/lib/coursesServer";
import StateCourses from "./StateCourses";
import RelatedCoursesLinks from "@/components/courses/RelatedCoursesLinks";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const cc = code.toUpperCase();
  const name = STATE_NAMES[cc] ?? cc;
  const title = `Disc Golf Courses in ${name}`;
  const ogTitle = `${title} | Radius Disc Golf`;
  const description = `Browse disc golf courses in ${name} — maps, hole-by-hole layouts, ratings, leaderboards, and your bests. Find your next round on Radius.`;
  return {
    title,
    description,
    alternates: { canonical: `/courses/state/${cc}` },
    openGraph: { title: ogTitle, description, type: "website" },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

export default async function Page({ params }: Props) {
  const { code } = await params;
  const cc = code.toUpperCase();
  const name = STATE_NAMES[cc] ?? cc;

  const all = await listCoursesLite().catch(() => []);
  const targets = new Set([cc, (STATE_NAMES[cc] ?? "").toUpperCase()].filter(Boolean));
  const inState = all.filter((c) => targets.has((c.state ?? "").trim().toUpperCase()));
  const jsonLd = inState.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Disc Golf Courses in ${name}`,
        numberOfItems: inState.length,
        itemListElement: inState.slice(0, 100).map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://radiusdiscgolf.com/courses/${slugify(c.name, c.id)}`,
          name: c.name,
        })),
      }
    : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <StateCourses code={cc} />
      {/* Server-rendered crawlable index of every course in the state — the client grid above is
          for users; this guarantees the internal links are in the HTML for search engines. */}
      {inState.length > 0 && (
        <RelatedCoursesLinks heading={`All disc golf courses in ${name}`} courses={inState} />
      )}
    </>
  );
}
