"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getMyCourses, slugify, isPrivateCourse, type Course } from "@/lib/courses";
import CourseAnalytics from "@/components/courses/CourseAnalytics";

const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function statusOf(c: Course): { label: string; dot: string; cls: string } {
  const rs = (c.reviewStatus || "").toLowerCase();
  if (c.isDraft === true || rs === "draft") return { label: "Draft", dot: "#9a7a3a", cls: "text-[#9a7a3a] bg-[#9a7a3a]/10" };
  if (rs.includes("pending")) return { label: "In review", dot: "#2b6fd6", cls: "text-[#2b6fd6] bg-[#2b6fd6]/10" };
  if (rs === "rejected") return { label: "Needs changes", dot: "#d9473f", cls: "text-[#d9473f] bg-[#d9473f]/10" };
  return { label: "Live", dot: "#3a8a52", cls: "text-[#3a8a52] bg-[#3a8a52]/10" };
}

function Stat({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="px-3 text-center first:pl-0 last:pr-0">
      <div className={`font-[family-name:var(--font-heading)] text-lg font-extrabold ${gold ? "text-[#9a7a3a]" : "text-[#16221b]"}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9aa39a]">{label}</div>
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

  const summary = useMemo(() => {
    const list = courses ?? [];
    const holes = list.reduce((s, c) => s + (c.holeCount || 0), 0);
    const rounds = list.reduce((s, c) => s + (c.communityScoreCount || 0), 0);
    if (!list.length) return "";
    const parts = [`${list.length} ${list.length === 1 ? "course" : "courses"}`, `${holes.toLocaleString()} holes mapped`];
    if (rounds > 0) parts.push(`${rounds.toLocaleString()} rounds logged`);
    return parts.join(" · ");
  }, [courses]);

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <div className="mx-auto max-w-4xl px-6 pt-24 pb-16">
        <Link href="/courses" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7a70] transition-colors hover:text-[#16221b]">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          Back to courses
        </Link>
        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">Course builder</div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em]">My courses &amp; layouts</h1>
            <p className="mt-2 text-sm text-[#46554c]">Every course and layout you&apos;ve built — review their stats and edit the details.{summary && <span className="text-[#8a968d]">{"  ·  " + summary}</span>}</p>
          </div>
          {user && (
            <Link href="/courses/new" className="group relative hidden shrink-0 overflow-hidden rounded-2xl shadow-[0_12px_28px_-12px_rgba(15,24,19,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-12px_rgba(15,24,19,0.85)] md:block">
              <span className="absolute -inset-x-10 inset-y-0 bg-[linear-gradient(110deg,transparent_30%,rgba(246,193,101,0.45),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#243a2e] to-[#16221b] px-5 py-3 ring-1 ring-[var(--gold)]/30 transition-colors group-hover:ring-[var(--gold)]/60">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--gold-bright)] to-[var(--gold)] text-[#16221b] shadow-[inset_0_1px_2px_rgba(255,255,255,0.45)]">
                  <span className="h-7 w-7 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url(/basket-icon.svg)" }} />
                </span>
                <span className="text-left">
                  <span className="block font-[family-name:var(--font-heading)] text-sm font-extrabold leading-tight tracking-tight text-[var(--cream)]">Build a course</span>
                  <span className="block text-[11px] leading-tight text-[var(--sage)]">Map it hole by hole</span>
                </span>
                <svg className="ml-1 h-4 w-4 text-[var(--gold)] transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </span>
            </Link>
          )}
        </div>

        {loading || courses === null ? (
          <div className="mt-8 space-y-4">{[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-black/5" />)}</div>
        ) : !user ? (
          <div className="mt-8 rounded-3xl border border-black/8 bg-white p-12 text-center"><p className="text-[#46554c]"><Link href="/login" className="font-bold text-[#9a7a3a] hover:underline">Sign in</Link> to manage your courses.</p></div>
        ) : courses.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-black/12 bg-white/60 p-14 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--gold)]/15"><span className="h-8 w-8 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url(/basket-icon.svg)" }} /></div>
            <p className="mt-4 font-[family-name:var(--font-heading)] text-xl font-extrabold">You haven&apos;t built any courses yet</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#8a968d]">Map your local course hole by hole — it&apos;ll show up here with community stats once it&apos;s live.</p>
            <Link href="/courses/new" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#16221b] px-6 py-3 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a]">
              <span className="h-5 w-5 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url(/basket-icon.svg)", filter: "brightness(0) invert(1)" }} />
              Build a course
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {courses.map((c) => {
              const status = statusOf(c);
              const isPrivate = isPrivateCourse(c);
              return (
                <div key={c.id} className="group overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_1px_3px_rgba(15,24,19,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(15,24,19,0.38)]">
                  <div className="flex gap-5 p-5">
                    <div className="relative h-28 w-40 shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-deep)] ring-1 ring-black/[0.06]">
                      {c.coverPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.coverPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]" />
                      ) : (
                        <span className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.32),var(--bg-deep))] font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--cream)]/45">{c.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="min-w-0 truncate font-[family-name:var(--font-heading)] text-xl font-extrabold tracking-tight">{c.name}</h2>
                        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#8a968d]">
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                        <span className="truncate">{[c.city, c.state].filter(Boolean).join(", ") || "Location not set"}</span>
                        {isPrivate && <span className="ml-1 rounded bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6b7a70]">Private</span>}
                        {c.isFeatured && <span className="rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9a7a3a]">★ Featured</span>}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#46554c]">{c.description || "No description yet."}</p>
                      <div className="mt-auto pt-2 text-[11px] text-[#a3a89f]">Created {fmtDate(c.dateCreated)}</div>
                    </div>
                  </div>

                  <div className="mx-5 flex items-center justify-between rounded-2xl bg-[#f6f2ea] px-2 py-3 ring-1 ring-black/[0.04] [&>div]:flex-1 divide-x divide-black/[0.06]">
                    <Stat label="Rating" value={c.rating ? `★ ${c.rating.toFixed(1)}` : "—"} gold={!!c.rating} />
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
