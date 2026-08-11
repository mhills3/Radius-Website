"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getDecodedRounds, computeCareerStats, type DecodedRound } from "@/lib/rounds";
import { getAllCourses, type Course } from "@/lib/courses";
import { getTrendingDiscs, type TrendingDisc } from "@/lib/feed";
import Scorecard from "@/components/dashboard/Scorecard";

const HEAD = "font-[family-name:var(--font-heading)]";
const eyebrow = `${HEAD} text-[10px] font-black uppercase tracking-[0.2em] text-[var(--sage-dim)]`;
const card = "rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6";
const fmtToPar = (n: number | null | undefined) => (n == null ? "—" : n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number | null) => (n == null ? "var(--cream)" : n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const timeAgo = (ms: number) => { const d = Math.floor((Date.now() - ms) / 86400000); return d <= 0 ? "today" : d === 1 ? "1 day ago" : d < 7 ? `${d} days ago` : new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

// Cumulative to-par line for the last round (inverted so under-par climbs), gold.
function ToParChart({ round }: { round: DecodedRound }) {
  const holes = [...round.holes.filter((h) => h.played)].sort((a, b) => a.holeNumber - b.holeNumber);
  const cum = holes.reduce<number[]>((acc, h) => [...acc, (acc[acc.length - 1] ?? 0) + (h.score - h.par)], []);
  if (cum.length < 2) return null;
  const w = 320, h = 72, min = Math.min(0, ...cum), max = Math.max(0, ...cum), span = max - min || 1;
  const y = (v: number) => h - ((v - min) / span) * h; // note: not inverted visually; lower to-par = lower line
  const pts = cum.map((v, i) => `${(i / (cum.length - 1)) * w},${y(v)}`).join(" ");
  const zeroY = y(0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[72px] w-full" preserveAspectRatio="none">
      <line x1="0" y1={zeroY} x2={w} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 4" />
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomeView({ uid }: { uid: string }) {
  const { profile } = useAuth();
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [trending, setTrending] = useState<TrendingDisc[]>([]);
  const [open, setOpen] = useState<DecodedRound | null>(null);

  useEffect(() => {
    let alive = true;
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getAllCourses().then((c) => alive && setCourses(c)).catch(() => {});
    getTrendingDiscs(10).then((t) => alive && setTrending(t)).catch(() => {});
    return () => { alive = false; };
  }, [uid]);

  const complete = useMemo(() => (rounds ? [...rounds].filter((r) => r.isComplete).sort((a, b) => b.date - a.date) : []), [rounds]);
  const last = complete[0];
  const career = useMemo(() => (rounds ? computeCareerStats(rounds) : null), [rounds]);
  const coverByName = useMemo(() => { const m = new Map<string, Course>(); courses.forEach((c) => { const k = c.name.trim().toLowerCase(); if (!m.has(k)) m.set(k, c); }); return m; }, [courses]);
  const lastCourse = last ? coverByName.get(last.courseName.trim().toLowerCase()) : undefined;
  const cover = lastCourse?.coverPhotoUrl;

  const workOn = useMemo(() => {
    if (!career) return null;
    if (career.c1.pct != null && career.c1.pct < 0.7) return `Putting is where you're losing the most — ${Math.round(career.c1.pct * 100)}% on makeable putts inside 33 feet.`;
    if (career.fairwayPct != null && career.fairwayPct < 0.6) return `Off the tee — only ${Math.round(career.fairwayPct * 100)}% of your drives are finding the fairway.`;
    if (career.obRate != null && career.obRate > 0.08) return `Trouble is costing you — ${Math.round(career.obRate * 100)}% of throws are going OB.`;
    if (career.rounds === 0) return "Play a shot-tracked round in the app and your focus builds itself.";
    return "Your game is well-rounded — keep stacking clean rounds.";
  }, [career]);

  const firstName = (profile?.name || "Player").split(" ")[0];

  if (rounds === null) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)] text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* Hero — last-course cover "melts" into the canvas behind the greeting */}
      <div className="relative">
        {cover && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[380px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-full w-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-[var(--bg-deep)]/70 to-[var(--bg-deep)]" />
          </div>
        )}
        <div className="relative mx-auto max-w-5xl px-6 pt-12">
          <div className="flex items-center justify-between">
            <div>
              <div className={`${eyebrow} text-[var(--gold)]`}>{greeting()}</div>
              <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>{firstName}</h1>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-lg font-bold text-[var(--cream)] ring-2 ring-[var(--gold)]/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {profile?.profileImageUrl ? <img src={profile.profileImageUrl} alt="" className="h-full w-full object-cover" /> : firstName.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Your last round */}
          {last ? (
            <Link href="/bag" className="group mt-6 block">
              <div className="mb-2 flex items-center justify-between">
                <span className={eyebrow}>Your last round</span>
                <span className="text-xs text-[var(--sage-dim)]">{timeAgo(last.date)}</span>
              </div>
              <div className={`${card} transition-colors group-hover:border-white/[0.14]`}>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className={`${HEAD} truncate text-2xl font-black text-[var(--cream)]`}>{last.courseName}</div>
                    <div className="mt-1 text-sm text-[var(--sage-dim)]">{last.holesPlayed} holes · {last.total} strokes</div>
                  </div>
                  <div className={`${HEAD} shrink-0 text-5xl font-black leading-none`} style={{ color: scoreColor(last.relativeToPar) }}>{fmtToPar(last.relativeToPar)}</div>
                </div>
                <div className="mt-4"><ToParChart round={last} /></div>
                <div className="mt-3 text-[13px] font-semibold text-[var(--gold)]">Open My Game →</div>
              </div>
            </Link>
          ) : (
            <div className={`${card} mt-6 text-center`}>
              <div className={`${HEAD} text-xl font-extrabold`}>Play your first round</div>
              <p className="mt-1 text-sm text-[var(--text-body)]">Track a round in the Radius app and your stats appear here.</p>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-16 pt-6">
        {/* What to work on */}
        {workOn && (
          <div className="border-y border-white/[0.07] py-5">
            <div className={eyebrow}>What to work on</div>
            <p className="mt-2 text-[19px] font-bold leading-snug text-[var(--cream)]">{workOn}</p>
            <Link href="/bag?tab=improve" className="mt-2 inline-block text-[13px] font-semibold text-[var(--gold)]">Open Improve →</Link>
          </div>
        )}

        {/* Quick links (web can't start a round — these are the doorways) */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { href: "/bag", label: "My Game", sub: "Overview · Bag · Improve" },
            { href: "/courses", label: "Find courses", sub: "Explore the map" },
            { href: "/community", label: "Community", sub: "The scene" },
          ].map((q) => (
            <Link key={q.href} href={q.href} className={`${card} group flex items-center justify-between !p-5 transition-colors hover:border-white/[0.14]`}>
              <div>
                <div className={`${HEAD} text-base font-extrabold text-[var(--cream)]`}>{q.label}</div>
                <div className="mt-0.5 text-xs text-[var(--sage-dim)]">{q.sub}</div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 shrink-0 text-[var(--gold)] transition-transform group-hover:translate-x-0.5"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          ))}
        </div>

        {/* The Scene — trending discs */}
        {trending.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <span className={eyebrow}>Today&apos;s trending discs</span>
              <Link href="/community" className="text-[13px] font-semibold text-[var(--gold)]">The scene →</Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trending.slice(0, 8).map((d) => (
                <span key={d.name} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm font-semibold text-[var(--cream)]">
                  {d.name}<span className="text-xs text-[var(--sage-dim)]">{d.throws.toLocaleString()}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent rounds */}
        {complete.length > 0 && (
          <div className="mt-8">
            <div className={`${eyebrow} mb-2`}>Recent rounds</div>
            <div className="divide-y divide-white/[0.05]">
              {complete.slice(0, 8).map((r) => (
                <button key={r.roundId} onClick={() => setOpen(r)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:opacity-80">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--cream)]">{r.courseName}</div>
                    <div className="text-xs text-[var(--sage-dim)]">{new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {r.holesPlayed} holes</div>
                  </div>
                  <span className={`${HEAD} shrink-0 text-xl font-black`} style={{ color: scoreColor(r.relativeToPar) }}>{fmtToPar(r.relativeToPar)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {open && <Scorecard round={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
