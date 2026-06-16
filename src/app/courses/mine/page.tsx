"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getMyCourses, slugify, isPrivateCourse, type Course } from "@/lib/courses";
import CourseAnalytics from "@/components/courses/CourseAnalytics";

const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function statusOf(c: Course): { label: string; cls: string } | null {
  const rs = (c.reviewStatus || "").toLowerCase();
  if (c.isDraft === true || rs === "draft") return { label: "Draft", cls: "bg-[#9a7a3a]/90 text-white" };
  if (rs === "pending" || rs.includes("pending")) return { label: "In review", cls: "bg-[#2b6fd6]/90 text-white" };
  if (rs === "rejected") return { label: "Needs changes", cls: "bg-[#d9473f]/90 text-white" };
  return { label: "Live", cls: "bg-[#3a8a52]/90 text-white" };
}

function HeroStat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none text-[var(--cream)]">{value}</div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--sage)]">{label}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-[#16221b]">{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a968d]">{label}</div>
    </div>
  );
}

export default function MyCoursesPage() {
  const { user, loading } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [statsOpen, setStatsOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    if (!user) { setCourses([]); return; }
    getMyCourses(user.uid).then(setCourses).catch(() => setCourses([]));
  }, [user, loading]);

  const toggleStats = (id: string) => setStatsOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const agg = useMemo(() => {
    const list = courses ?? [];
    const holes = list.reduce((s, c) => s + (c.holeCount || 0), 0);
    const scores = list.reduce((s, c) => s + (c.communityScoreCount || 0), 0);
    const rated = list.filter((c) => (c.rating || 0) > 0);
    const avg = rated.length ? rated.reduce((s, c) => s + (c.rating || 0), 0) / rated.length : 0;
    return { count: list.length, holes, scores, avg };
  }, [courses]);

  const BuildButton = (
    <Link href="/courses/new" className="group relative inline-flex shrink-0 overflow-hidden rounded-2xl shadow-[0_14px_32px_-12px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5">
      <span className="absolute -inset-x-10 inset-y-0 bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.5),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="relative flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[var(--gold-bright)] to-[var(--gold)] px-5 py-3 ring-1 ring-black/10">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#16221b]/90">
          <span className="h-6 w-6 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url(/basket-icon.svg)", filter: "brightness(0) invert(1)" }} />
        </span>
        <span className="text-left">
          <span className="block font-[family-name:var(--font-heading)] text-sm font-extrabold leading-tight tracking-tight text-[#16221b]">Build a course</span>
          <span className="block text-[11px] leading-tight text-[#16221b]/70">Map it hole by hole</span>
        </span>
        <svg className="ml-1 h-4 w-4 text-[#16221b] transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      {/* ===== premium hero ===== */}
      <div className="relative overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff" }} />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.18),transparent_70%)]" />
        <div className="relative mx-auto max-w-5xl px-6 pt-20 pb-10">
          <Link href="/courses" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Back to courses
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Course builder</div>
              <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">My courses &amp; layouts</h1>
              <p className="mt-2.5 max-w-xl text-sm text-[var(--text-body)]">Every course and layout you&apos;ve built — track how the community is playing them and keep the details sharp.</p>
            </div>
            {user && <div className="hidden md:block">{BuildButton}</div>}
          </div>

          {user && courses && courses.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6">
              <HeroStat value={agg.count} label="Courses" />
              <HeroStat value={agg.holes.toLocaleString()} label="Holes mapped" />
              <HeroStat value={agg.scores.toLocaleString()} label="Rounds logged" />
              <HeroStat value={agg.avg > 0 ? `★ ${agg.avg.toFixed(1)}` : "—"} label="Avg rating" />
            </div>
          )}
        </div>
      </div>

      {/* ===== content ===== */}
      <div className="mx-auto max-w-4xl px-6 py-10">
        {user && (
          <div className="mb-6 md:hidden">{BuildButton}</div>
        )}

        {loading || courses === null ? (
          <div className="space-y-4">{[0, 1].map((i) => <div key={i} className="h-52 animate-pulse rounded-3xl bg-black/5" />)}</div>
        ) : !user ? (
          <div className="rounded-3xl border border-black/8 bg-white p-12 text-center"><p className="text-[#46554c]"><Link href="/login" className="font-bold text-[#9a7a3a] hover:underline">Sign in</Link> to manage your courses.</p></div>
        ) : courses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/12 bg-white/60 p-14 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--gold)]/15"><span className="h-8 w-8 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url(/basket-icon.svg)" }} /></div>
            <p className="mt-4 font-[family-name:var(--font-heading)] text-xl font-extrabold">You haven&apos;t built any courses yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#8a968d]">Map your local course hole by hole — it&apos;ll show up here with community stats once it&apos;s live.</p>
            <div className="mt-6 flex justify-center">{BuildButton}</div>
          </div>
        ) : (
          <div className="space-y-5">
            {courses.map((c) => {
              const status = statusOf(c);
              const isPrivate = isPrivateCourse(c);
              return (
                <div key={c.id} className="group overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_2px_12px_-6px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/[0.12] hover:shadow-[0_22px_46px_-22px_rgba(15,24,19,0.45)]">
                  <div className="flex flex-col sm:flex-row">
                    <div className="relative h-44 w-full shrink-0 overflow-hidden bg-[var(--bg-deep)] sm:h-auto sm:w-56">
                      {c.coverPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.coverPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                      ) : (
                        <span className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.32),var(--bg-deep))] font-[family-name:var(--font-heading)] text-4xl font-bold text-[var(--cream)]/45">{c.name.charAt(0)}</span>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent sm:bg-gradient-to-r" />
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        {status && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur ${status.cls}`}>{status.label}</span>}
                        {isPrivate && <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">Private</span>}
                        {c.isFeatured && <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#16221b] backdrop-blur">★ Featured</span>}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col p-5">
                      <h2 className="font-[family-name:var(--font-heading)] text-xl font-extrabold tracking-tight">{c.name}</h2>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#8a968d]">
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                        <span className="truncate">{[c.city, c.state].filter(Boolean).join(", ") || "Location not set"}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#46554c]">{c.description || "No description yet."}</p>
                      <div className="mt-auto pt-3 text-[11px] text-[#a3a89f]">Created {fmtDate(c.dateCreated)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 border-y border-black/[0.06] bg-[#faf8f3] px-4 py-3.5">
                    <Stat label="Rating" value={c.rating ? `★ ${c.rating.toFixed(1)}` : "—"} />
                    <Stat label="Reviews" value={c.reviewCount ?? 0} />
                    <Stat label="Rounds" value={c.communityScoreCount ?? 0} />
                    <Stat label="Holes" value={`${c.holeCount} · P${c.par}`} />
                  </div>

                  <div className="flex items-center justify-end gap-1.5 p-3">
                    <button onClick={() => toggleStats(c.id)} className="mr-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-[#9a7a3a] transition-colors hover:bg-[var(--gold)]/10 hover:text-[#16221b]">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M8 16v-5M13 16V8M18 16v-9" /></svg>
                      {statsOpen.has(c.id) ? "Hide analytics" : "Analytics"}
                    </button>
                    <Link href={`/courses/${slugify(c.name, c.id)}`} className="rounded-full px-4 py-2 text-sm font-semibold text-[#46554c] transition-colors hover:bg-black/[0.04] hover:text-[#16221b]">View page</Link>
                    <Link href={`/courses/${slugify(c.name, c.id)}/edit`} className="inline-flex items-center gap-1.5 rounded-full bg-[#16221b] px-5 py-2 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a]">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                      Edit course
                    </Link>
                  </div>

                  {statsOpen.has(c.id) && <div className="border-t border-black/[0.06] bg-[#faf8f3] p-4"><CourseAnalytics course={c} /></div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
