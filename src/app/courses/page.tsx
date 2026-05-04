"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getAllCourses, slugify, type Course } from "@/lib/courses";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");

  useEffect(() => {
    getAllCourses().then((c) => {
      setCourses(c);
      setLoading(false);
    });
  }, []);

  const states = useMemo(() => {
    const s = new Set(courses.map((c) => c.state).filter(Boolean));
    return Array.from(s).sort();
  }, [courses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return courses.filter((c) => {
      if (stateFilter && c.state !== stateFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.city.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [courses, search, stateFilter]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Header */}
      <div className="mb-10 max-w-2xl">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-tight">
          Disc Golf <span className="text-[var(--gold)]">Courses</span>
        </h1>
        <p className="mt-3 text-[var(--text-body)]">
          Browse courses mapped by the Radius community. Click any course for
          hole-by-hole details, leaderboards, and more.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by name or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none transition-colors focus:border-[var(--gold)]/50 md:w-80"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--cream)] outline-none transition-colors focus:border-[var(--gold)]/50"
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-20 text-[var(--sage)]">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading courses...
        </div>
      )}

      {/* Results */}
      {!loading && (
        <>
          <p className="mb-6 text-sm text-[var(--sage-dim)]">
            {filtered.length} course{filtered.length !== 1 ? "s" : ""} found
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${slugify(course.name, course.id)}`}
                className="group rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition-all hover:-translate-y-1 hover:border-[var(--gold)]/40 hover:shadow-[0_16px_48px_rgba(0,0,0,0.35)]"
              >
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight group-hover:text-[var(--gold)]">
                  {course.name}
                </h2>
                <p className="mt-1 text-sm text-[var(--sage)]">
                  {course.city}
                  {course.state ? `, ${course.state}` : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--text-body)]">
                  <span className="rounded-full bg-white/5 px-3 py-1">
                    {course.holeCount} holes
                  </span>
                  <span className="rounded-full bg-white/5 px-3 py-1">
                    Par {course.par}
                  </span>
                  {course.distanceFt > 0 && (
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      {course.distanceFt.toLocaleString()} ft
                    </span>
                  )}
                  {course.terrain && (
                    <span className="rounded-full bg-white/5 px-3 py-1 capitalize">
                      {course.terrain}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="py-20 text-center text-[var(--sage-dim)]">
              No courses match your search.
            </p>
          )}
        </>
      )}
    </div>
  );
}
