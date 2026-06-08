"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAllCourses, slugify, type Course } from "@/lib/courses";

// Option C — Directory-forward: a slim search hero that blends straight into a
// live grid of courses. Maximum "website of utility" — you're using it instantly.
export default function HeroDirectory() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getAllCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  const grid = useMemo(() => {
    const feat = courses.filter((c) => c.isFeatured);
    return (feat.length >= 6 ? feat : courses).slice(0, 6);
  }, [courses]);

  return (
    <section className="border-b border-white/5">
      <div className="mx-auto max-w-7xl px-6 pb-14 pt-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              The home of disc golf
            </div>
            <h1 className="max-w-2xl font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[2.75rem]">
              Every course. Every round. One place.
            </h1>
          </div>
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-[var(--bg-card)]/70 px-5 py-3.5 focus-within:border-[var(--gold)]/60">
            <svg className="h-5 w-5 shrink-0 text-[var(--sage)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && router.push("/courses")}
              placeholder="Search courses…"
              className="w-full bg-transparent text-base text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none"
            />
          </div>
        </div>

        <div className="mt-10 mb-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">Popular right now</span>
          <Link href="/courses" className="text-sm font-medium text-[var(--gold)] hover:underline">Browse all →</Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grid.length === 0 &&
            [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
            ))}
          {grid.map((c) => (
            <Link key={c.id} href={`/courses/${slugify(c.name, c.id)}`} className="group rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition-all hover:-translate-y-1 hover:border-[var(--gold)]/40 hover:shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight group-hover:text-[var(--gold)]">{c.name}</h2>
              <p className="mt-1 text-sm text-[var(--sage)]">{c.city}{c.state ? `, ${c.state}` : ""}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-body)]">
                <span className="rounded-full bg-white/5 px-3 py-1">{c.holeCount} holes</span>
                <span className="rounded-full bg-white/5 px-3 py-1">Par {c.par}</span>
                {c.distanceFt > 0 && <span className="rounded-full bg-white/5 px-3 py-1">{c.distanceFt.toLocaleString()} ft</span>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
