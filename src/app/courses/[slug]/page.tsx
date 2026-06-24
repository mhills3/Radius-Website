import type { Metadata } from "next";
import { idFromSlug, isUSState, isPrivateCourse, STATE_NAMES, type Course } from "@/lib/courses";
import { getCourseFullByShortId, listCoursesLite } from "@/lib/coursesServer";
import CourseDetailClient from "./CourseDetailClient";
import RelatedCoursesLinks from "@/components/courses/RelatedCoursesLinks";

function buildJsonLd(c: Course, slug: string) {
  const url = `https://radiusdiscgolf.com/courses/${slug}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ld: Record<string, any> = { "@context": "https://schema.org", "@type": "SportsActivityLocation", name: c.name, url, sport: "Disc Golf" };
  if (c.description?.trim()) ld.description = c.description.trim();
  if (c.coverPhotoUrl) ld.image = c.coverPhotoUrl;
  if (c.city || c.state) ld.address = { "@type": "PostalAddress", ...(c.city ? { addressLocality: c.city } : {}), ...(c.state ? { addressRegion: c.state } : {}), ...(isUSState(c.state) ? { addressCountry: "US" } : {}) };
  if (typeof c.latitude === "number" && typeof c.longitude === "number") ld.geo = { "@type": "GeoCoordinates", latitude: c.latitude, longitude: c.longitude };
  if (c.rating && c.reviewCount) ld.aggregateRating = { "@type": "AggregateRating", ratingValue: c.rating, reviewCount: c.reviewCount, bestRating: 5, worstRating: 1 };
  return ld;
}

type Props = { params: Promise<{ slug: string }> };

function nameFromSlug(slug: string): string {
  const parts = slug.split("-");
  if (parts.length > 1) parts.pop(); // drop the short-id suffix
  return parts.map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ").trim() || "Disc Golf Course";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shortId = idFromSlug(slug);
  const course = shortId ? await getCourseFullByShortId(shortId).catch(() => null) : null;

  const name = course?.name || nameFromSlug(slug);
  const loc = course ? [course.city, course.state].filter(Boolean).join(", ") : "";
  const bits = course ? [`${course.holeCount} holes`, course.par ? `par ${course.par}` : "", loc].filter(Boolean).join(" · ") : "";
  // `title` is short — the root layout template appends "| Radius Disc Golf".
  const title = `${name}${loc ? ` — ${loc}` : ""}`;
  const ogTitle = `${title} | Radius Disc Golf`;
  const description = course?.description?.trim()
    ? course.description.trim().slice(0, 155)
    : `${name} disc golf course${loc ? ` in ${loc}` : ""}${bits ? ` — ${bits}` : ""}. Hole-by-hole layout, satellite map, ratings and leaderboards on Radius.`;
  // Private courses must never be indexed — they're viewable only by their creator.
  const isPrivate = !!course && isPrivateCourse(course);
  return {
    title,
    description,
    alternates: { canonical: `/courses/${slug}` },
    ...(isPrivate ? { robots: { index: false, follow: false } } : {}),
    openGraph: { title: ogTitle, description, type: "website", images: course?.coverPhotoUrl ? [course.coverPhotoUrl] : undefined },
    twitter: { card: "summary_large_image", title: ogTitle, description, images: course?.coverPhotoUrl ? [course.coverPhotoUrl] : undefined },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const shortId = idFromSlug(slug);
  const course = shortId ? await getCourseFullByShortId(shortId).catch(() => null) : null;
  const isPrivate = !!course && isPrivateCourse(course);
  // No structured data for private courses — keep them out of search results entirely.
  const jsonLd = course && !isPrivate ? buildJsonLd(course, slug) : null;
  // Seed the client with server-fetched data so the course content (H1, description, hole-by-hole,
  // ratings) is in the SSR HTML for SEO — NOT for private courses (those must never be in the HTML).
  const initialCourse = course && !isPrivate ? course : undefined;

  // Internal linking (SEO): server-render crawlable links to other public courses in the same state
  // (same city first) + the state hub, so search engines can crawl/authority-flow across the catalog.
  const st = course?.state?.trim().toUpperCase();
  const related = course && !isPrivate && st
    ? (await listCoursesLite().catch(() => []))
        .filter((c) => c.id !== course.id && (c.state || "").trim().toUpperCase() === st)
        .sort((a, b) => {
          const ac = (a.city || "").trim().toLowerCase() === (course.city || "").trim().toLowerCase() ? 0 : 1;
          const bc = (b.city || "").trim().toLowerCase() === (course.city || "").trim().toLowerCase() ? 0 : 1;
          return ac - bc || a.name.localeCompare(b.name);
        })
        .slice(0, 30)
    : [];
  const stateName = st && isUSState(course!.state) ? (STATE_NAMES[st] || course!.state) : course?.state;
  const stateHref = st && isUSState(course!.state) ? `/courses/state/${st}` : undefined;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <CourseDetailClient slug={slug} initialCourse={initialCourse} />
      {initialCourse && (related.length > 0 || stateHref) && (
        <RelatedCoursesLinks
          heading={`More disc golf courses${stateName ? ` in ${stateName}` : ""}`}
          courses={related}
          stateHref={stateHref}
          stateLabel={stateName ? `All ${stateName} disc golf courses` : undefined}
        />
      )}
    </>
  );
}
