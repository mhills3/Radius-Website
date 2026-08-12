"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getDecodedRounds, computeCareerStats, type DecodedRound } from "@/lib/rounds";
import { getAllCourses, slugify, type Course } from "@/lib/courses";
import { getUpcomingEvents, type LeagueEvent } from "@/lib/leagues";
import { getFeed, type FeedPost } from "@/lib/feed";
import Scorecard from "@/components/dashboard/Scorecard";

const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const eyebrow = "text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]";
const hairline = "border-[var(--hair)]";

const fmtToPar = (n: number | null | undefined) => (n == null ? "—" : n === 0 ? "E" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const scoreColor = (n: number | null) => (n == null ? "var(--cream)" : n < 0 ? "#8FBF9A" : n === 0 ? "var(--cream)" : "var(--sage-dim)");
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const timeAgo = (ms: number) => { const d = Math.floor((Date.now() - ms) / 86400000); return d <= 0 ? "today" : d === 1 ? "1d" : d < 7 ? `${d}d` : new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Cumulative to-par line for one round (gold), any size.
function ToParLine({ round, w, h, showAxis }: { round: DecodedRound; w: number; h: number; showAxis?: boolean }) {
  const holes = [...round.holes.filter((x) => x.played)].sort((a, b) => a.holeNumber - b.holeNumber);
  const cum = holes.reduce<number[]>((acc, x) => [...acc, (acc[acc.length - 1] ?? 0) + (x.score - x.par)], []);
  if (cum.length < 2) return null;
  const min = Math.min(0, ...cum), max = Math.max(0, ...cum), span = max - min || 1;
  const pad = 4;
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad); // lower to-par = higher line (birdies climb)
  const pts = cum.map((v, i) => `${(i / (cum.length - 1)) * w},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="block">
      {showAxis && <line x1="0" y1={y(0)} x2={w} y2={y(0)} stroke="rgba(244,241,232,0.22)" strokeWidth="1" strokeDasharray="3 5" />}
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth={showAxis ? 2 : 1.4} strokeLinejoin="round" strokeLinecap="round" />
      {showAxis && <circle cx={w} cy={y(cum[cum.length - 1])} r="3.4" fill="var(--gold)" />}
    </svg>
  );
}

// Up to 3 scoring-mix dots (birdie / par / bogey+) present in the round.
function ScoreDots({ round }: { round: DecodedRound }) {
  const played = round.holes.filter((h) => h.played);
  const has = { b: played.some((h) => h.score - h.par < 0), p: played.some((h) => h.score - h.par === 0), o: played.some((h) => h.score - h.par > 0) };
  const dots = [has.b && "#3EA88F", has.p && "#D6D6D0", has.o && "#B5544A"].filter(Boolean) as string[];
  if (!dots.length) return null;
  return <div className="flex">{dots.map((c, i) => <span key={i} className="h-5 w-5 rounded-full border-[1.5px] border-[var(--bg-deep)]" style={{ background: c, marginLeft: i ? -6 : 0 }} />)}</div>;
}

export default function HomeView({ uid }: { uid: string }) {
  const { profile } = useAuth();
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [open, setOpen] = useState<DecodedRound | null>(null);

  useEffect(() => {
    let alive = true;
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getAllCourses().then((c) => alive && setCourses(c)).catch(() => {});
    getUpcomingEvents(60).then((e) => alive && setEvents(e)).catch(() => {});
    getFeed(20).then((f) => alive && setFeed(f)).catch(() => {});
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((p) => alive && setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
    }
    return () => { alive = false; };
  }, [uid]);

  const complete = useMemo(() => (rounds ? [...rounds].filter((r) => r.isComplete).sort((a, b) => b.date - a.date) : []), [rounds]);
  const last = complete[0];
  const career = useMemo(() => (rounds ? computeCareerStats(rounds) : null), [rounds]);
  const byName = useMemo(() => { const m = new Map<string, Course>(); courses.forEach((c) => { const k = c.name.trim().toLowerCase(); if (!m.has(k)) m.set(k, c); }); return m; }, [courses]);
  const cover = last ? byName.get(last.courseName.trim().toLowerCase())?.coverPhotoUrl : undefined;
  const firstName = (profile?.name || "Player").split(" ")[0];
  const playedNames = useMemo(() => new Set(complete.map((r) => r.courseName.trim().toLowerCase())), [complete]);

  const coordsOf = (c?: Course) => (c && c.latitude != null && c.longitude != null ? { lat: c.latitude, lng: c.longitude } : null);
  const nearCourses = useMemo(() => {
    if (!loc) return [];
    return courses.map((c) => ({ c, co: coordsOf(c) })).filter((x) => x.co).map((x) => ({ c: x.c, mi: milesBetween(loc, x.co!) })).sort((a, b) => a.mi - b.mi).slice(0, 4);
  }, [courses, loc]);
  const nearEvents = useMemo(() => {
    if (!loc) return [];
    return events.map((e) => { const co = coordsOf(e.courseName ? byName.get(e.courseName.trim().toLowerCase()) : undefined); return co ? { e, mi: milesBetween(loc, co) } : null; }).filter((x): x is { e: LeagueEvent; mi: number } => !!x).sort((a, b) => a.mi - b.mi).slice(0, 2);
  }, [events, loc, byName]);
  const scene = useMemo(() => feed.filter((p) => p.linkedCourseName && p.scoreToPar != null).slice(0, 3), [feed]);

  const workOn = useMemo(() => {
    if (!career) return null;
    if (career.c1.pct != null && career.c1.pct < 0.7) return `Putting is where you're losing the most. You're making ${Math.round(career.c1.pct * 100)}% on makeable putts inside 33 feet.`;
    if (career.fairwayPct != null && career.fairwayPct < 0.6) return `Off the tee — only ${Math.round(career.fairwayPct * 100)}% of your drives are finding the fairway.`;
    if (career.obRate != null && career.obRate > 0.08) return `Trouble is costing you — ${Math.round(career.obRate * 100)}% of your throws are going OB.`;
    if (career.rounds === 0) return "Play a shot-tracked round in the app and your focus builds itself.";
    return "Your game is well-rounded — keep stacking clean rounds.";
  }, [career]);

  if (rounds === null) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)] text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden">
        {cover && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(105deg, rgba(15,23,18,0.95) 0%, rgba(15,23,18,0.72) 46%, rgba(15,23,18,0.4) 100%), linear-gradient(to bottom, transparent 55%, var(--bg-deep) 100%)" }} />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-10 pt-10 sm:px-8 md:flex-row md:items-start md:pt-12">
          <div className="min-w-0 flex-1">
            <div className={`${eyebrow} text-[#8FA08A]`}>{greeting()}</div>
            <div className={`${HEAD} mt-2 text-4xl font-bold leading-none`}>{firstName}</div>
            {last ? (
              <div className="mt-8">
                <div className={`${eyebrow} mb-3`}>Your last round</div>
                <div className={`${HEAD} text-2xl font-bold`}>{last.courseName}</div>
                <div className="mt-2.5 flex items-baseline gap-3.5">
                  <span className="text-[44px] font-bold leading-[0.85] tracking-[-0.03em]" style={{ ...MONO, color: scoreColor(last.relativeToPar) }}>{fmtToPar(last.relativeToPar)}</span>
                  <span className="text-xs text-[var(--sage)]" style={MONO}>{last.total} strokes · {last.holesPlayed} holes · {timeAgo(last.date)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-8">
                <div className={`${HEAD} text-xl font-bold`}>Play your first round</div>
                <p className="mt-1 text-sm text-[var(--text-body)]">Track a round in the Radius app and your stats appear here.</p>
              </div>
            )}
          </div>
          {last && (
            <div className="w-full pt-2 md:w-[300px]">
              <ToParLine round={last} w={300} h={96} showAxis />
              <div className="mt-1.5 flex justify-between text-[9px] text-[var(--sage-dim)]" style={MONO}><span>Hole 1</span><span>Hole {last.holesPlayed}</span></div>
            </div>
          )}
        </div>
      </div>

      {/* ===== GRID ===== */}
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-2 sm:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-7">
          {/* MAIN */}
          <div className="min-w-0 flex-1">
            {workOn && (
              <div className={`border-b ${hairline} pb-6`}>
                <div className={eyebrow}>What to work on</div>
                <p className="mt-3 max-w-xl font-[family-name:var(--font-body)] text-[19px] leading-relaxed text-[var(--cream)]">{workOn}</p>
                <Link href="/bag?tab=improve" className="mt-3.5 inline-block text-[12.5px] font-semibold text-[var(--gold)]">Open Improve →</Link>
              </div>
            )}

            <div className="mt-6 flex items-baseline justify-between">
              <span className={eyebrow}>Recent rounds</span>
              <Link href="/bag" className="text-[11.5px] font-[family-name:var(--font-body)] text-[var(--sage)] hover:text-[var(--cream)]">View all</Link>
            </div>
            {complete.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--sage-dim)]">No rounds yet — play one in the Radius app.</p>
            ) : (
              <div className="mt-1">
                {complete.slice(0, 8).map((r, i, arr) => (
                  <button key={r.roundId} onClick={() => setOpen(r)} className={`flex w-full items-center gap-4 py-3.5 text-left transition-opacity hover:opacity-80 ${i < arr.length - 1 ? `border-b ${hairline}` : ""}`}>
                    <span className="grid h-[46px] w-[74px] shrink-0 place-items-center overflow-hidden rounded-lg bg-[#1E2A1C]"><ToParLine round={r} w={74} h={46} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-[var(--cream)]">{r.courseName}</span>
                      <span className="mt-1 block text-[10.5px] text-[var(--sage-dim)]" style={MONO}>{shortDate(r.date)} · {r.holesPlayed} holes · {r.total}</span>
                    </span>
                    <ScoreDots round={r} />
                    <span className="shrink-0 text-[17px] font-bold" style={{ ...MONO, color: scoreColor(r.relativeToPar) }}>{fmtToPar(r.relativeToPar)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="w-full shrink-0 lg:w-[284px]">
            <Link href="/courses" className="mb-6 block rounded-[11px] bg-[var(--gold)] py-3 text-center text-[13.5px] font-bold text-[#0F1712] transition-colors hover:bg-[var(--gold-bright)]">Find a course</Link>

            <div className={`border-b ${hairline} pb-5`}>
              <div className={`${eyebrow} mb-3.5`}>Your game</div>
              <div className="flex">
                {[
                  { v: career?.c1.pct != null ? `${Math.round(career.c1.pct * 100)}` : "—", u: career?.c1.pct != null ? "%" : "", l: "C1X Putt" },
                  { v: career?.avgDriveFt ? `${Math.round(career.avgDriveFt)}` : "—", u: career?.avgDriveFt ? "ft" : "", l: "Avg Drive" },
                  { v: career?.fairwayPct != null ? `${Math.round(career.fairwayPct * 100)}` : "—", u: career?.fairwayPct != null ? "%" : "", l: "Fairway" },
                ].map((s) => (
                  <div key={s.l} className="flex-1">
                    <div className="text-[21px] font-bold leading-none" style={MONO}>{s.v}<span className="text-[11px] text-[var(--sage-dim)]">{s.u}</span></div>
                    <div className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#4A5A48]">{s.l}</div>
                  </div>
                ))}
              </div>
              <Link href="/bag" className="mt-4 inline-block text-[12px] font-semibold text-[var(--gold)]">Open My Game →</Link>
            </div>

            {(nearEvents.length > 0 || nearCourses.length > 0) && (
              <div className={`mt-5 border-b ${hairline} pb-5`}>
                <div className={`${eyebrow} mb-3`}>Near you</div>
                <div className="space-y-3">
                  {nearEvents.map(({ e, mi }) => (
                    <Link key={e.id} href={`/leagues`} className={`flex items-center gap-3 border-b ${hairline} pb-3`}>
                      <span className="grid h-[34px] w-[34px] shrink-0 flex-col place-items-center rounded-lg bg-[#22302A]">
                        <span className="text-[6.5px] font-bold uppercase tracking-wide text-[var(--gold)]">{new Date(e.date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                        <span className="text-[12px] font-bold leading-none" style={MONO}>{new Date(e.date).getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-[var(--cream)]">{e.name}</span>
                        <span className="mt-0.5 block truncate text-[9.5px] text-[#4A5A48]" style={MONO}>{e.courseName} · {mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi</span>
                      </span>
                    </Link>
                  ))}
                  {nearCourses.filter((x) => !nearEvents.some((ne) => ne.e.courseName?.trim().toLowerCase() === x.c.name.trim().toLowerCase())).slice(0, nearEvents.length > 0 ? 1 : 3).map(({ c, mi }) => (
                    <Link key={c.id} href={`/courses/${slugify(c.name, c.id)}`} className="flex items-center gap-3">
                      <span className="h-[34px] w-[34px] shrink-0 overflow-hidden rounded-lg bg-[#2A3D30]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {c.coverPhotoUrl ? <img src={c.coverPhotoUrl} alt="" className="h-full w-full object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-[var(--cream)]">{c.name}</span>
                        <span className="mt-0.5 block text-[9.5px] text-[#4A5A48]" style={MONO}>{mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi · {playedNames.has(c.name.trim().toLowerCase()) ? "played" : "never played"}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {scene.length > 0 && (
              <div className="mt-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className={eyebrow}>The scene</span>
                  <Link href="/community" className="text-[11px] font-[family-name:var(--font-body)] text-[#7FA8C4]">More</Link>
                </div>
                <div className="space-y-3">
                  {scene.map((p, i, arr) => (
                    <Link key={p.id} href="/community" className={`flex items-center gap-2.5 ${i < arr.length - 1 ? `border-b ${hairline} pb-3` : ""}`}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#243642] text-[11px] font-semibold text-[#7FA8C4]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.authorPhotoUrl ? <img src={p.authorPhotoUrl} alt="" className="h-full w-full object-cover" /> : (p.authorName || "?").charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-[var(--cream)]">{p.authorName}</span>
                        <span className="mt-0.5 block truncate text-[9.5px] text-[#4A5A48]" style={MONO}>{p.linkedCourseName} · {timeAgo(p.createdAt)}</span>
                      </span>
                      <span className="shrink-0 text-[13px] font-bold" style={{ ...MONO, color: scoreColor(p.scoreToPar ?? null) }}>{fmtToPar(p.scoreToPar)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {open && <Scorecard round={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
