"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getMyCourses, slugify, type Course } from "@/lib/courses";
import CourseEditForm from "@/components/courses/CourseEditForm";
import CourseAnalytics from "@/components/courses/CourseAnalytics";

const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="text-center"><div className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[#16221b]">{value}</div><div className="text-[10px] font-bold uppercase tracking-wide text-[#8a968d]">{label}</div></div>;
}

export default function MyCoursesPage() {
  const { user, loading } = useAuth();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [statsOpen, setStatsOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;
    if (!user) { setCourses([]); return; }
    getMyCourses(user.uid).then(setCourses).catch(() => setCourses([]));
  }, [user, loading]);

  const applyPatch = (id: string, patch: Partial<Course>) => setCourses((prev) => prev?.map((c) => (c.id === id ? { ...c, ...patch } : c)) ?? null);
  const toggleStats = (id: string) => setStatsOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em]">My courses & layouts</h1>
            <p className="mt-2 text-sm text-[#46554c]">Every course and layout you&apos;ve built — review their stats and edit the details.</p>
          </div>
          {user && (
            <Link href="/courses/new" className="group relative hidden shrink-0 overflow-hidden rounded-2xl shadow-[0_12px_28px_-12px_rgba(15,24,19,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-12px_rgba(15,24,19,0.85)] md:block">
              <span className="absolute -inset-x-10 inset-y-0 bg-[linear-gradient(110deg,transparent_30%,rgba(246,193,101,0.45),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#243a2e] to-[#16221b] px-5 py-3 ring-1 ring-[var(--gold)]/30 transition-colors group-hover:ring-[var(--gold)]/60">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--gold-bright)] to-[var(--gold)] text-[#16221b] shadow-[inset_0_1px_2px_rgba(255,255,255,0.45)]">
                  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4M4 4l11 3-3 4 6 2-14 4" /></svg>
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
          <div className="mt-8 space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-black/5" />)}</div>
        ) : !user ? (
          <div className="mt-8 rounded-2xl border border-black/8 bg-white p-10 text-center"><p className="text-[#46554c]"><Link href="/login" className="font-bold text-[#9a7a3a] hover:underline">Sign in</Link> to manage your courses.</p></div>
        ) : courses.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-black/10 p-12 text-center">
            <div className="text-3xl">⛳</div>
            <p className="mt-3 font-bold">You haven&apos;t built any courses yet</p>
            <p className="mt-1 text-sm text-[#8a968d]">Courses and layouts you create in the Radius app show up here to manage.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {courses.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
                <div className="flex gap-4 p-4">
                  <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-deep)]">
                    {c.coverPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.3),var(--bg-deep))] font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--cream)]/50">{c.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-[family-name:var(--font-heading)] text-lg font-bold">{c.name}</h2>
                        <div className="truncate text-xs text-[#8a968d]">{[c.city, c.state].filter(Boolean).join(", ")}</div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {!c.isPublic && <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-bold text-[#6b7a70]">PRIVATE</span>}
                        {c.isFeatured && <span className="rounded-full bg-[var(--gold)]/20 px-2 py-0.5 text-[10px] font-bold text-[#9a7a3a]">FEATURED</span>}
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[#46554c]">{c.description || "No description yet."}</p>
                    <div className="mt-2 text-[11px] text-[#8a968d]">Created {fmtDate(c.dateCreated)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 border-y border-black/[0.06] bg-[#faf8f3] px-4 py-3">
                  <Stat label="Rating" value={c.rating ? `★ ${c.rating.toFixed(1)}` : "—"} />
                  <Stat label="Reviews" value={c.reviewCount ?? 0} />
                  <Stat label="Scores" value={c.communityScoreCount ?? 0} />
                  <Stat label="Holes" value={`${c.holeCount} · P${c.par}`} />
                </div>
                <div className="flex items-center justify-end gap-2 p-3">
                  <button onClick={() => toggleStats(c.id)} className="mr-auto rounded-full px-4 py-2 text-sm font-semibold text-[#9a7a3a] hover:text-[#16221b]">{statsOpen.has(c.id) ? "Hide analytics" : "📊 Analytics"}</button>
                  <Link href={`/courses/${slugify(c.name, c.id)}`} className="rounded-full px-4 py-2 text-sm font-semibold text-[#46554c] hover:text-[#16221b]">View page</Link>
                  <button onClick={() => setEditing(c)} className="rounded-full bg-[#16221b] px-5 py-2 text-sm font-bold text-[var(--cream)] hover:bg-[#22332a]">Edit details</button>
                </div>
                {statsOpen.has(c.id) && <div className="border-t border-black/[0.06] bg-[#faf8f3] p-4"><CourseAnalytics course={c} /></div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && <CourseEditForm course={editing} onSaved={(patch) => applyPatch(editing.id, patch)} onClose={() => setEditing(null)} />}
    </div>
  );
}
