"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getDecodedRounds, computeCareerStats, type DecodedRound } from "@/lib/rounds";
import { getAllCourses, slugify, type Course } from "@/lib/courses";
import { getUpcomingEvents, type LeagueEvent } from "@/lib/leagues";
import { getFeed, type FeedPost } from "@/lib/feed";
import Scorecard from "@/components/dashboard/Scorecard";
import RoundPreviewCard from "@/components/scorecard/RoundPreviewCard";

// --- one type + color system for the whole page ---
const HEAD = "font-[family-name:var(--font-heading)]";   // Sora — headings + labels
const BODY = "font-[family-name:var(--font-body)]";      // Inter — prose
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const; // all numerals
// Section label: identical size / tracking / color everywhere. Pair with `mb-3` for its content gap.
const label = `${HEAD} text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]`;
const divider = "border-[var(--hair)]";

const fmtToPar = (n: number | null | undefined) => (n == null ? "—" : n === 0 ? "E" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const scoreColor = (n: number | null) => (n == null ? "var(--cream)" : n < 0 ? "#8FBF9A" : n === 0 ? "var(--cream)" : "var(--sage-dim)");
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const timeAgo = (ms: number) => { const d = Math.floor((Date.now() - ms) / 86400000); return d <= 0 ? "today" : d === 1 ? "1d" : d < 7 ? `${d}d` : new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const miLabel = (mi: number) => `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Cumulative to-par line for the last round (gold; birdies climb).
function ToParLine({ round, w, h }: { round: DecodedRound; w: number; h: number }) {
  const holes = [...round.holes.filter((x) => x.played)].sort((a, b) => a.holeNumber - b.holeNumber);
  const cum = holes.reduce<number[]>((acc, x) => [...acc, (acc[acc.length - 1] ?? 0) + (x.score - x.par)], []);
  if (cum.length < 2) return null;
  const min = Math.min(0, ...cum), max = Math.max(0, ...cum), span = max - min || 1, pad = 4;
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad);
  const x = (i: number) => (i / (cum.length - 1)) * w;
  const pts = cum.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const base = y(0);
  // Area between the line and the par axis — split at the axis so under-par shades green, over-par gold.
  const area = `M0,${y(cum[0])}` + cum.map((v, i) => `L${x(i)},${y(v)}`).join("") + `L${w},${base}L0,${base}Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="block">
      <defs>
        {/* the par axis maps under-par below it, over-par above — so top = over (red), bottom = under (green) */}
        <clipPath id="tpl-over"><rect x="0" y="0" width={w} height={base} /></clipPath>
        <clipPath id="tpl-under"><rect x="0" y={base} width={w} height={h - base} /></clipPath>
      </defs>
      <path d={area} fill="rgba(224,102,102,0.18)" clipPath="url(#tpl-over)" />
      <path d={area} fill="rgba(143,191,154,0.20)" clipPath="url(#tpl-under)" />
      <line x1="0" y1={base} x2={w} y2={base} stroke="rgba(244,241,232,0.22)" strokeWidth="1" strokeDasharray="3 5" />
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={w} cy={y(cum[cum.length - 1])} r="3.4" fill="var(--gold)" />
    </svg>
  );
}

// A single stat as a progress ring (matches the My Game ring language: faint track + gold arc, value
// in the center, label beneath). `frac` (0..1) drives the arc; null value = empty ring.
function StatRing({ value, unit, frac, label, size = 68 }: { value: string; unit?: string; frac: number | null; label: string; size?: number }) {
  const r = size / 2 - 5, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, frac ?? 0));
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <g transform={`translate(${size / 2} ${size / 2})`}>
          <circle r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4.5" />
          {frac != null && <circle r={r} fill="none" stroke="var(--gold)" strokeWidth="4.5" strokeLinecap="round" strokeDasharray={`${p * C} ${C}`} transform="rotate(-90)" />}
          <text textAnchor="middle" dominantBaseline="central" y="0">
            <tspan style={{ fontSize: 16, fontWeight: 800, fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)", fill: "var(--cream)" }}>{value}</tspan>
            {unit && <tspan dx="1" style={{ fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)", fill: "var(--sage-dim)" }}>{unit}</tspan>}
          </text>
        </g>
      </svg>
      <div className={`${HEAD} text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--sage-dim)]`}>{label}</div>
    </div>
  );
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
  // Nearby courses — drop co-located/junk results (< 0.1 mi is almost always bad data, not a real course at your feet).
  const nearCourses = useMemo(() => {
    if (!loc) return [];
    return courses.map((c) => ({ c, co: coordsOf(c) })).filter((x) => x.co).map((x) => ({ c: x.c, mi: milesBetween(loc, x.co!) })).filter((x) => x.mi >= 0.1 && x.c.name.trim().length > 2).sort((a, b) => a.mi - b.mi).slice(0, 4);
  }, [courses, loc]);
  const nearEvents = useMemo(() => {
    if (!loc) return [];
    return events.map((e) => { const co = coordsOf(e.courseName ? byName.get(e.courseName.trim().toLowerCase()) : undefined); return co ? { e, mi: milesBetween(loc, co) } : null; }).filter((x): x is { e: LeagueEvent; mi: number } => !!x).sort((a, b) => a.mi - b.mi).slice(0, 2);
  }, [events, loc, byName]);
  const sceneCourses = useMemo(() => nearCourses.filter((x) => !nearEvents.some((ne) => ne.e.courseName?.trim().toLowerCase() === x.c.name.trim().toLowerCase())).slice(0, nearEvents.length > 0 ? 1 : 3), [nearCourses, nearEvents]);
  // The scene = latest community activity (round shares surface a score chip; everything else its course/text).
  const scene = useMemo(() => feed.slice(0, 3), [feed]);
  const showScene = scene.length >= 1;
  const showNear = nearEvents.length > 0 || nearCourses.length > 0;

  // Cardless "play a course" prompt whose copy adapts to what we know about the player.
  const courseNudge = useMemo(() => {
    const unplayed = nearCourses.find((x) => !playedNames.has(x.c.name.trim().toLowerCase()));
    if (unplayed) return { title: "A course you haven't played", body: `${unplayed.c.name} · ${miLabel(unplayed.mi)} away` };
    if (complete.length === 0) return { title: "Find your first course", body: "Browse courses near you, or add one that's missing." };
    return { title: "Where to next?", body: "Find a new course to play, or add one that isn't here yet." };
  }, [nearCourses, playedNames, complete]);

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

  // Shared page frame: same max-width + horizontal padding as the hero, so left edges line up exactly.
  const frame = "mx-auto max-w-[1200px] px-6 sm:px-10";

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
        {/* two-part scrim: darken the left where the text sits, then fade fully to page color at the bottom */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(15,23,18,0.96) 0%, rgba(15,23,18,0.62) 44%, rgba(15,23,18,0.22) 100%), linear-gradient(to bottom, transparent 30%, rgba(15,23,18,0.72) 74%, var(--bg-deep) 99%)" }} />
        <div className={`relative ${frame} pb-16 pt-10 sm:pt-12`}>
          <div className={`${label} !text-[var(--sage)]`}>{greeting()}</div>
          <div className={`${HEAD} mt-2 text-[38px] font-bold leading-none`}>{firstName}</div>
          {last ? (
            // last-round details (left) + score arc (right) share a bottom axis so the arc is anchored, not floating
            <div className="mt-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <div className={`${label} mb-3`}>Your last round</div>
                <div className={`${HEAD} text-2xl font-bold`}>{last.courseName}</div>
                <div className="mt-2.5 flex items-baseline gap-3.5">
                  <span className="text-[44px] font-bold leading-[0.85] tracking-[-0.03em]" style={{ ...MONO, color: scoreColor(last.relativeToPar) }}>{fmtToPar(last.relativeToPar)}</span>
                  <span className="text-xs text-[var(--sage)]" style={MONO}>{last.total} strokes · {last.holesPlayed} holes · {timeAgo(last.date)}</span>
                </div>
              </div>
              <div className="w-full md:w-[300px]">
                <ToParLine round={last} w={300} h={88} />
                <div className="mt-2 flex justify-between text-[9px] text-[var(--sage-dim)]" style={MONO}><span>Hole 1</span><span>Hole {last.holesPlayed}</span></div>
              </div>
            </div>
          ) : (
            <div className="mt-10">
              <div className={`${HEAD} text-xl font-bold`}>Play your first round</div>
              <p className="mt-1 text-sm text-[var(--text-body)]">Track a round in the Radius app and your stats appear here.</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== GRID — explicit: fluid main + fixed rail, 40px gutter, both start at the same Y ===== */}
      <div className={`${frame} pb-20 pt-8`}>
        <div className="grid gap-8 lg:grid-cols-[1fr_336px] lg:items-start lg:gap-10">
          {/* MAIN */}
          <div className="min-w-0">
            {workOn && (
              <div className={`border-b ${divider} pb-8`}>
                <div className={`${label} mb-3`}>What to work on</div>
                <p className={`${HEAD} max-w-xl text-[22px] font-semibold leading-[1.32] text-[var(--cream)]`}>{workOn}</p>
                <Link href="/bag?tab=improve" className="mt-4 inline-block text-[13px] font-semibold text-[var(--gold)]">Open Improve →</Link>
              </div>
            )}

            <div className={`${workOn ? "pt-8" : ""}`}>
              <div className="mb-3 flex items-baseline justify-between">
                <span className={label}>Recent rounds</span>
                <Link href="/bag" className={`${BODY} text-[12.5px] text-[var(--sage)] hover:text-[var(--cream)]`}>View all</Link>
              </div>
              {complete.length === 0 ? (
                <p className="text-sm text-[var(--sage-dim)]">No rounds yet — play one in the Radius app.</p>
              ) : (
                <div className="space-y-3.5">
                  {complete.slice(0, 6).map((r) => (
                    <RoundPreviewCard key={r.roundId} round={r} cover={byName.get(r.courseName.trim().toLowerCase())?.coverPhotoUrl} onClick={() => setOpen(r)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="min-w-0">
            {/* Play a course — a section, not a card; copy adapts to the player */}
            <div className={`border-b ${divider} pb-5`}>
              <div className={`${HEAD} text-[17px] font-bold text-[var(--cream)]`}>{courseNudge.title}</div>
              <p className={`${BODY} mt-1.5 text-[13.5px] leading-snug text-[var(--sage)]`}>{courseNudge.body}</p>
              <div className="mt-3.5 flex items-center gap-4">
                <Link href="/courses" className="text-[13.5px] font-semibold text-[var(--gold)]">Find a course →</Link>
                <Link href="/courses/new" className="text-[13.5px] font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Add a course</Link>
              </div>
            </div>

            {/* Your game — stat rings, mirroring the app */}
            <div className={`mt-5 border-b ${divider} pb-5`}>
              <div className={`${label} mb-4`}>Your game</div>
              <div className="grid grid-cols-3 gap-1">
                <StatRing label="C1X Putt" value={career && career.c1.att >= 3 && career.c1.pct != null ? `${Math.round(career.c1.pct * 100)}` : "—"} unit={career && career.c1.att >= 3 && career.c1.pct != null ? "%" : undefined} frac={career && career.c1.att >= 3 ? career.c1.pct : null} />
                <StatRing label="Avg Drive" value={career?.avgDriveFt ? `${Math.round(career.avgDriveFt)}` : "—"} unit={career?.avgDriveFt ? "ft" : undefined} frac={career?.avgDriveFt ? career.avgDriveFt / 400 : null} />
                <StatRing label="Fairway" value={career?.fairwayPct != null ? `${Math.round(career.fairwayPct * 100)}` : "—"} unit={career?.fairwayPct != null ? "%" : undefined} frac={career?.fairwayPct ?? null} />
              </div>
              <Link href="/bag" className="mt-4 inline-block text-[13px] font-semibold text-[var(--gold)]">Open My Game →</Link>
            </div>

            {/* Near you */}
            {showNear && (
              <div className={`mt-5 border-b ${divider} pb-5`}>
                <div className={`${label} mb-3`}>Near you</div>
                <div className="space-y-3.5">
                  {nearEvents.map(({ e, mi }) => (
                    <Link key={e.id} href="/leagues" className="flex items-center gap-3">
                      <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-lg bg-[#22302A]">
                        <span className="text-[6.5px] font-bold uppercase tracking-wide text-[var(--gold)]">{new Date(e.date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                        <span className="text-[12px] font-bold leading-none text-[var(--cream)]" style={MONO}>{new Date(e.date).getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-[var(--cream)]">{e.name}</span>
                        <span className="mt-0.5 block truncate text-[10.5px] text-[var(--sage-dim)]" style={MONO}>{e.courseName} · {miLabel(mi)}</span>
                      </span>
                    </Link>
                  ))}
                  {sceneCourses.map(({ c, mi }) => (
                    <Link key={c.id} href={`/courses/${slugify(c.name, c.id)}`} className="flex items-center gap-3">
                      {c.coverPhotoUrl && (
                        <span className="h-[36px] w-[36px] shrink-0 overflow-hidden rounded-lg bg-[#22302A]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-[var(--cream)]">{c.name}</span>
                        <span className="mt-0.5 block text-[10.5px] text-[var(--sage-dim)]" style={MONO}>{miLabel(mi)} · {playedNames.has(c.name.trim().toLowerCase()) ? "played" : "new to you"}</span>
                      </span>
                    </Link>
                  ))}
                  {nearEvents.length === 0 && nearCourses.length === 0 && <p className="text-[11px] text-[var(--sage-dim)]">No courses nearby yet.</p>}
                </div>
              </div>
            )}

            {/* The scene */}
            {showScene && (
              <div className="mt-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className={label}>The scene</span>
                  <Link href="/community" className={`${BODY} text-[12px] text-[var(--gold)] hover:text-[var(--gold-bright)]`}>More</Link>
                </div>
                <div className="space-y-3.5">
                  {scene.map((p) => (
                    <Link key={p.id} href="/community" className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#22302A] text-[11px] font-semibold text-[var(--sage)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.authorPhotoUrl ? <img src={p.authorPhotoUrl} alt="" className="h-full w-full object-cover" /> : (p.authorName || "?").charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-[var(--cream)]">{p.authorName}</span>
                        {p.linkedCourseName
                          ? <span className="mt-0.5 block truncate text-[10.5px] text-[var(--sage-dim)]" style={MONO}>{p.linkedCourseName}</span>
                          : <span className={`${BODY} mt-0.5 block truncate text-[11px] text-[var(--sage-dim)]`}>{p.text || "posted an update"}</span>}
                      </span>
                      {p.scoreToPar != null
                        ? <span className="w-9 shrink-0 text-right text-[14px] font-bold" style={{ ...MONO, color: scoreColor(p.scoreToPar) }}>{fmtToPar(p.scoreToPar)}</span>
                        : <span className="w-9 shrink-0 text-right text-[10.5px] text-[var(--sage-dim)]" style={MONO}>{timeAgo(p.createdAt)}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {open && <Scorecard round={open} rounds={complete} onClose={() => setOpen(null)} />}
    </div>
  );
}
