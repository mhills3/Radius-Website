"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAllCourses, getTotalCourseCount, slugify, type Course } from "@/lib/courses";
import { useMetricPref } from "@/lib/useMetricPref";
import { fmtDist } from "@/lib/units";

// Branded cover palette — keeps the home page professional & consistent (no amateur builder photos).
const TILE_COLORS = ["#2f6f4e", "#9a6b2f", "#3a5a8c", "#6b4a8c", "#2f6f6f", "#8c5a3a", "#4a7a3a"];
function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}

export default function CoursesStrip() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getAllCourses().then(setCourses).catch(() => setCourses([])).finally(() => setLoading(false));
    getTotalCourseCount().then(setTotalCount).catch(() => {});
  }, []);

  // surface the MOST-REVIEWED courses (most loved by the community), then rating, then size
  const list = useMemo(() => [...courses].sort((a, b) => ((b.reviewCount ?? 0) - (a.reviewCount ?? 0)) || ((b.rating ?? 0) - (a.rating ?? 0)) || (b.holeCount - a.holeCount) || a.name.localeCompare(b.name)).slice(0, 5), [courses]);
  const featured = list[0];
  const rest = useMemo(() => list.slice(1, 5), [list]);

  const PERKS = [
    { icon: "🛰️", label: "Satellite hole maps" },
    { icon: "🗺️", label: "Community layouts" },
    { icon: "🏆", label: "Course leaderboards" },
  ];

  return (
    <section id="courses" className="bg-[#f3eee4] text-[#16221b]">
      <div className="mx-auto max-w-7xl px-6 py-20 md:py-24">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9a7a3a]">Explore courses</div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[2.6rem]">
              Find your next round.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#46554c]">
              <span className="font-bold text-[#16221b]">{loading && !totalCount ? "…" : (totalCount || courses.length).toLocaleString()}</span> courses mapped by players — and counting.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {PERKS.map((p) => (
                <span key={p.label} className="inline-flex items-center gap-1.5 rounded-full border border-black/8 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#46554c]">
                  <span>{p.icon}</span>{p.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-black/10 bg-white px-5 py-3.5 shadow-sm focus-within:border-[var(--gold)]">
            <svg className="h-5 w-5 shrink-0 text-[#8a968d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && router.push("/courses")} placeholder="Search by name, city, or state" className="w-full bg-transparent text-base text-[#16221b] placeholder-[#8a968d] outline-none" />
            <button onClick={() => router.push("/courses")} className="shrink-0 rounded-xl bg-[var(--gold)] px-4 py-2 text-sm font-bold text-[#16221b] hover:bg-[var(--gold-bright)]">Search</button>
          </div>
        </div>

        {/* featured bento */}
        {loading ? (
          <div className="mt-12 grid auto-rows-[230px] grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="col-span-2 row-span-2 animate-pulse rounded-3xl bg-black/5" />
            {[0, 1, 2, 3].map((i) => <div key={i} className="animate-pulse rounded-3xl bg-black/5" />)}
          </div>
        ) : featured ? (
          <div className="mt-12 grid auto-rows-[230px] grid-cols-2 gap-4 lg:grid-cols-4">
            <CourseTile c={featured} featured className="col-span-2 row-span-2" />
            {rest.map((c) => <CourseTile key={c.id} c={c} className="col-span-1" />)}
          </div>
        ) : null}

        <div className="mt-10 text-center">
          <Link href="/courses" className="inline-flex items-center gap-2 rounded-full bg-[#16221b] px-7 py-3.5 text-sm font-bold text-[var(--cream)] transition-all hover:-translate-y-0.5 hover:bg-[#22332a]">
            Browse all {loading ? "" : courses.length.toLocaleString()} courses →
          </Link>
        </div>
      </div>
    </section>
  );
}

function CourseTile({ c, featured = false, className = "" }: { c: Course; featured?: boolean; className?: string }) {
  const color = colorFor(c.id || c.name);
  const metric = useMetricPref();
  return (
    <Link href={`/courses/${slugify(c.name, c.id)}`} className={`group relative overflow-hidden rounded-3xl shadow-sm ring-1 ring-inset ring-white/10 transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-22px_rgba(0,0,0,0.45)] ${className}`} style={{ background: `linear-gradient(140deg, ${color}, #0d140f 80%)` }}>
      {/* topo texture */}
      <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.08 }} />
      {/* big faint hole count for depth */}
      <div className={`pointer-events-none absolute font-[family-name:var(--font-heading)] font-extrabold leading-none text-white/[0.07] ${featured ? "right-5 top-2 text-[9rem]" : "right-3 top-1 text-[5rem]"}`}>{c.holeCount || ""}</div>
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(13,20,15,0.85),transparent_60%)]" />
      {featured && <span className="absolute left-4 top-4 rounded-full bg-[var(--gold)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#16221b]">Featured course</span>}
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className={`font-[family-name:var(--font-heading)] font-bold leading-tight tracking-tight text-white ${featured ? "text-2xl md:text-3xl" : "text-base"}`}>{c.name}</h3>
        <p className={`mt-0.5 text-[rgba(245,237,225,0.72)] ${featured ? "text-sm" : "text-xs"}`}>{c.city}{c.state ? `, ${c.state}` : ""}</p>
        <div className={`mt-3 flex flex-wrap gap-2 ${featured ? "text-xs" : "text-[11px]"} text-[var(--cream)]`}>
          <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">{c.holeCount} holes</span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">Par {c.par}</span>
          {featured && c.distanceFt > 0 && <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">{fmtDist(c.distanceFt, metric)}</span>}
        </div>
      </div>
    </Link>
  );
}
