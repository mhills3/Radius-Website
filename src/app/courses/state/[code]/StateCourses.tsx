"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAllCourses, STATE_NAMES, type Course } from "@/lib/courses";
import CourseCard from "@/components/courses/CourseCard";

export default function StateCourses({ code }: { code: string }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllCourses().then(setCourses).catch(() => setCourses([])).finally(() => setLoading(false));
  }, []);

  const name = STATE_NAMES[code] ?? code;
  const targets = useMemo(() => new Set([code, (STATE_NAMES[code] ?? "").toUpperCase()].filter(Boolean)), [code]);
  const inState = useMemo(() => courses.filter((c) => targets.has((c.state ?? "").trim().toUpperCase())).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name)), [courses, targets]);
  const totalHoles = useMemo(() => inState.reduce((s, c) => s + (c.holeCount || 0), 0), [inState]);
  const cities = useMemo(() => new Set(inState.map((c) => c.city).filter(Boolean)).size, [inState]);

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <div className="relative overflow-hidden border-b border-black/[0.06]">
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#16221b", opacity: 0.04 }} />
        <div className="relative mx-auto max-w-7xl px-6 pb-8 pt-10">
          <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#9a7a3a] hover:underline">← All courses</Link>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Disc Golf Courses in {name}</h1>
          <p className="mt-2 max-w-2xl text-[#46554c]">{loading ? "Loading courses…" : `${inState.length} course${inState.length === 1 ? "" : "s"} across ${cities} ${cities === 1 ? "city" : "cities"} — maps, hole-by-hole layouts, ratings, and leaderboards.`}</p>
          {!loading && inState.length > 0 && (
            <div className="mt-5 flex gap-7">
              <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none">{inState.length}</div><div className="mt-1 text-xs text-[#8a968d]">courses</div></div>
              <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none">{cities}</div><div className="mt-1 text-xs text-[#8a968d]">cities</div></div>
              <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none">{totalHoles.toLocaleString()}</div><div className="mt-1 text-xs text-[#8a968d]">holes mapped</div></div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-black/5" />)}</div>
        ) : inState.length === 0 ? (
          <p className="rounded-2xl border border-black/8 bg-white p-12 text-center text-sm text-[#6b7a70]">No courses found in {name} yet. <Link href="/courses" className="font-bold text-[#9a7a3a] hover:underline">Browse all courses →</Link></p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{inState.map((c) => <CourseCard key={c.id} course={c} />)}</div>
        )}
      </div>
    </div>
  );
}
