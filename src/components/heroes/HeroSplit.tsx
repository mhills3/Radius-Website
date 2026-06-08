"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAllCourses, slugify, type Course } from "@/lib/courses";

// Option B — Editorial split: message + search on the left, a live data panel
// (real featured courses) on the right. Reads like a tool, not an ad.
export default function HeroSplit() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getAllCourses().then(setCourses).catch(() => setCourses([]));
  }, []);

  const panel = useMemo(() => {
    const feat = courses.filter((c) => c.isFeatured);
    return (feat.length ? feat : courses).slice(0, 5);
  }, [courses]);

  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div className="pointer-events-none absolute -left-40 top-0 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.10),transparent_66%)]" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_0.85fr] lg:py-24">
        {/* left */}
        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(246,193,101,0.2)] bg-[rgba(246,193,101,0.08)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            The home of disc golf
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.05] tracking-[-0.03em] md:text-[3.4rem]">
            Find your course.
            <br />
            <span className="bg-gradient-to-br from-[#f8cf80] via-[#f6c165] to-[#d4a04a] bg-clip-text text-transparent">
              Master your game.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--text-body)]">
            Search every course and track every round — your whole game, synced
            on any device.
          </p>
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-[var(--bg-card)]/70 px-5 py-4 backdrop-blur focus-within:border-[var(--gold)]/60">
            <svg className="h-5 w-5 shrink-0 text-[var(--sage)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && router.push("/courses")}
              placeholder="Search courses by name or city"
              className="w-full bg-transparent text-base text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none"
            />
            <button onClick={() => router.push("/courses")} className="shrink-0 rounded-xl bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[var(--bg-deep)] hover:bg-[var(--gold-bright)]">
              Search
            </button>
          </div>
          {courses.length > 0 && (
            <p className="mt-4 text-sm text-[var(--sage-dim)]">
              <span className="font-semibold text-[var(--sage)]">{courses.length.toLocaleString()}</span> courses mapped by the community
            </p>
          )}
        </div>

        {/* right: live data panel */}
        <div className="rounded-3xl border border-white/8 bg-[var(--bg-card)]/60 p-2 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.7)] backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">Featured courses</span>
            <Link href="/courses" className="text-xs font-medium text-[var(--gold)] hover:underline">View all →</Link>
          </div>
          <div className="space-y-1">
            {panel.length === 0 && (
              <div className="space-y-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="mx-2 h-14 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            )}
            {panel.map((c) => (
              <Link key={c.id} href={`/courses/${slugify(c.name, c.id)}`} className="mx-2 flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.04]">
                <div className="min-w-0">
                  <div className="truncate font-medium text-[var(--cream)]">{c.name}</div>
                  <div className="truncate text-sm text-[var(--sage-dim)]">{c.city}{c.state ? `, ${c.state}` : ""}</div>
                </div>
                <div className="flex shrink-0 gap-2 text-xs text-[var(--text-body)]">
                  <span className="rounded-full bg-white/5 px-2.5 py-1">{c.holeCount} holes</span>
                  <span className="rounded-full bg-white/5 px-2.5 py-1">Par {c.par}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
