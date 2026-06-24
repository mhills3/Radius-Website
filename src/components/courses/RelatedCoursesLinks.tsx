import Link from "next/link";
import { slugify } from "@/lib/courses";

/**
 * Server-rendered crawlable internal links between course pages. The point is SEO: putting real
 * <a href> links to related courses (+ the state hub) in the HTML so search engines can discover and
 * pass authority across the whole catalog. Rendered by server components only (no "use client").
 */
export default function RelatedCoursesLinks({
  heading,
  courses,
  stateHref,
  stateLabel,
}: {
  heading: string;
  courses: { id: string; name: string; city?: string }[];
  stateHref?: string;
  stateLabel?: string;
}) {
  if (courses.length === 0 && !stateHref) return null;
  return (
    <section className="border-t border-black/[0.06] bg-[#faf8f3] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-extrabold tracking-tight text-[#16221b]">{heading}</h2>
        {courses.length > 0 && (
          <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id}>
                <Link href={`/courses/${slugify(c.name, c.id)}`} className="text-sm text-[#46554c] transition-colors hover:text-[#9a7a3a] hover:underline">
                  {c.name}
                  {c.city ? <span className="text-[#8a968d]"> · {c.city}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {stateHref && (
          <Link href={stateHref} className="mt-6 inline-block text-sm font-bold text-[#9a7a3a] hover:underline">
            {stateLabel} →
          </Link>
        )}
      </div>
    </section>
  );
}
