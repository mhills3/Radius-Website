import type { Metadata } from "next";
import Link from "next/link";
import { STATE_NAMES, citySlug, slugify } from "@/lib/courses";
import { listCoursesLite, type CourseMeta } from "@/lib/coursesServer";

// ISR — generated on first request, cached + regenerated daily.
export const revalidate = 86400;

type Props = { params: Promise<{ code: string; name: string }> };
const SITE = "https://radiusdiscgolf.com";

async function load(code: string, name: string): Promise<{ cc: string; cityName: string; inCity: CourseMeta[] }> {
  const cc = code.toUpperCase();
  const all = await listCoursesLite().catch(() => []);
  const targets = new Set([cc, (STATE_NAMES[cc] ?? "").toUpperCase()].filter(Boolean));
  const inCity = all
    .filter((c) => targets.has((c.state ?? "").trim().toUpperCase()) && citySlug(c.city ?? "") === name.toLowerCase())
    .sort((a, b) => a.name.localeCompare(b.name));
  const cityName = inCity[0]?.city || name.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  return { cc, cityName, inCity };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code, name } = await params;
  const { cc, cityName, inCity } = await load(code, name);
  const stateName = STATE_NAMES[cc] ?? cc;
  const title = `Disc Golf Courses in ${cityName}, ${stateName}`;
  const ogTitle = `${title} | Radius Disc Golf`;
  const description = `${inCity.length || "Find"} disc golf course${inCity.length === 1 ? "" : "s"} in ${cityName}, ${stateName} — maps, hole-by-hole layouts, ratings and leaderboards on Radius.`;
  return {
    title,
    description,
    alternates: { canonical: `/courses/city/${cc}/${name.toLowerCase()}` },
    // Don't index an empty city page (no courses) — avoids thin/doorway pages.
    ...(inCity.length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title: ogTitle, description, type: "website" },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

export default async function Page({ params }: Props) {
  const { code, name } = await params;
  const { cc, cityName, inCity } = await load(code, name);
  const stateName = STATE_NAMES[cc] ?? cc;

  const jsonLd = inCity.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `Disc Golf Courses in ${cityName}, ${stateName}`,
        numberOfItems: inCity.length,
        itemListElement: inCity.slice(0, 100).map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE}/courses/${slugify(c.name, c.id)}`,
          name: c.name,
        })),
      }
    : null;

  return (
    <div className="min-h-screen bg-[#faf8f3]">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <div className="mx-auto max-w-5xl px-6 py-14">
        <Link href={`/courses/state/${cc}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#9a7a3a] hover:underline">← {stateName} disc golf courses</Link>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] text-[#16221b]">Disc Golf Courses in {cityName}, {stateName}</h1>
        <p className="mt-2 max-w-2xl text-[#46554c]">
          {inCity.length > 0
            ? `${inCity.length} disc golf course${inCity.length === 1 ? "" : "s"} in ${cityName} — maps, hole-by-hole layouts, ratings, and leaderboards.`
            : `No disc golf courses mapped in ${cityName} yet.`}
        </p>

        {inCity.length > 0 ? (
          <ul className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {inCity.map((c) => (
              <li key={c.id}>
                <Link href={`/courses/${slugify(c.name, c.id)}`} className="font-semibold text-[#16221b] transition-colors hover:text-[#9a7a3a] hover:underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Link href="/courses" className="mt-8 inline-block font-bold text-[#9a7a3a] hover:underline">Browse all courses →</Link>
        )}
      </div>
    </div>
  );
}
