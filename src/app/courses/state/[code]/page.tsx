import type { Metadata } from "next";
import Link from "next/link";
import { STATE_NAMES, slugify, citySlug } from "@/lib/courses";
import { listCoursesLite } from "@/lib/coursesServer";
import StateCourses from "./StateCourses";
import RelatedCoursesLinks from "@/components/courses/RelatedCoursesLinks";

export const revalidate = 86400;

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
  // Unique cities (for the "browse by city" hub links — feeds discovery of the city landing pages).
  const cityCounts = new Map<string, number>();
  for (const c of inState) { const cn = (c.city ?? "").trim(); if (cn) cityCounts.set(cn, (cityCounts.get(cn) ?? 0) + 1); }
  const cities = [...cityCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
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
      {/* Browse by city — server-rendered links so the city landing pages get discovered/crawled. */}
      {cities.length > 0 && (
        <section className="border-t border-black/[0.06] bg-[#faf8f3] px-6 pt-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-extrabold tracking-tight text-[#16221b]">Disc golf by city in {name}</h2>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {cities.map(([city, n]) => (
                <Link key={city} href={`/courses/city/${cc}/${citySlug(city)}`} className="text-sm text-[#46554c] transition-colors hover:text-[#9a7a3a] hover:underline">
                  {city} <span className="text-[#8a968d]">({n})</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Server-rendered crawlable index of every course in the state — the client grid above is
          for users; this guarantees the internal links are in the HTML for search engines. */}
      {inState.length > 0 && (
        <RelatedCoursesLinks heading={`All disc golf courses in ${name}`} courses={inState} />
      )}
    </>
  );
}
