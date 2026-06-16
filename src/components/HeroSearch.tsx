"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAllCourses, getTotalCourseCount, slugify, type Course } from "@/lib/courses";

export default function HeroSearch() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    getAllCourses()
      .then(setCourses)
      .catch(() => setCourses([]));
    getTotalCourseCount().then(setTotalCount).catch(() => {});
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return courses
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.state.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [courses, query]);

  const featured = useMemo(
    () => courses.filter((c) => c.isFeatured).slice(0, 4),
    [courses],
  );

  function submit() {
    router.push("/courses");
  }

  const showResults = focused && results.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="relative">
        <div
          className={`flex items-center gap-3 rounded-2xl border bg-[var(--bg-card)]/80 px-5 py-4 backdrop-blur transition-colors ${
            focused ? "border-[var(--gold)]/60" : "border-white/10"
          }`}
        >
          <svg
            className="h-5 w-5 shrink-0 text-[var(--sage)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Search courses by name, city, or state"
            className="w-full bg-transparent text-base text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none"
            aria-label="Search disc golf courses"
          />
          <button
            onClick={submit}
            className="hidden shrink-0 rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[var(--bg-deep)] transition-colors hover:bg-[var(--gold-bright)] sm:block"
          >
            Search
          </button>
        </div>

        {/* live results */}
        {showResults && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-mid)] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)]">
            {results.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${slugify(c.name, c.id)}`}
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.04]"
              >
                <span className="font-medium text-[var(--cream)]">{c.name}</span>
                <span className="shrink-0 text-sm text-[var(--sage-dim)]">
                  {c.city}
                  {c.state ? `, ${c.state}` : ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* utility line + quick links */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--sage-dim)]">
        {(totalCount || courses.length) > 0 && (
          <span>
            <span className="font-semibold text-[var(--sage)]">
              {(totalCount || courses.length).toLocaleString()}
            </span>{" "}
            courses mapped by the community
          </span>
        )}
        <Link
          href="/courses"
          className="font-medium text-[var(--gold)] hover:underline"
        >
          Browse all courses →
        </Link>
      </div>

      {/* featured course chips */}
      {featured.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.14em] text-[var(--sage-dim)]">
            Featured
          </span>
          {featured.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${slugify(c.name, c.id)}`}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-[var(--cream)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--gold)]"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
