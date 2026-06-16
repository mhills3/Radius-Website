import type { Metadata } from "next";
import { idFromSlug, isUSState, isPrivateCourse } from "@/lib/courses";
import { getCourseMetaByShortId, type CourseMeta } from "@/lib/coursesServer";
import CourseDetailClient from "./CourseDetailClient";

function buildJsonLd(c: CourseMeta, slug: string) {
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
  const course = shortId ? await getCourseMetaByShortId(shortId).catch(() => null) : null;

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
  const course = shortId ? await getCourseMetaByShortId(shortId).catch(() => null) : null;
  // No structured data for private courses — keep them out of search results entirely.
  const jsonLd = course && !isPrivateCourse(course) ? buildJsonLd(course, slug) : null;
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
      <CourseDetailClient slug={slug} />
    </>
  );
}
