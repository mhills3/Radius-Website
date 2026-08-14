"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { setProfileCover, getDashboard, type Dashboard } from "@/lib/account";
import { uploadProfileCover } from "@/lib/postImage";
import { rankForIQ, rankLabel, rankProgress } from "@/lib/rank";
import LevelBadge from "@/components/scorecard/LevelBadge";
import RankTiersModal from "@/components/scorecard/RankTiersModal";
import { getDecodedRounds, computeCareerStats, computeStrokesGained, rankedCategories, type DecodedRound } from "@/lib/rounds";
import { getAllCourses, slugify, type Course } from "@/lib/courses";
import { getPutterDiscNames, getBag } from "@/lib/bag";
import type { BagDisc } from "@/components/scorecard/RoundPreviewCard";
import { getUpcomingEvents, type LeagueEvent } from "@/lib/leagues";
import { getFeed, type FeedPost } from "@/lib/feed";
import { flightMapImageUrl, courseSatelliteUrl } from "@/lib/flightMap";
import Scorecard from "@/components/dashboard/Scorecard";
import RoundPreviewCard from "@/components/scorecard/RoundPreviewCard";
import RoundsHeatmap from "@/components/dashboard/RoundsHeatmap";

// --- one type + color system for the whole page ---
const HEAD = "font-[family-name:var(--font-heading)]";   // Sora — headings + labels
const BODY = "font-[family-name:var(--font-body)]";      // Inter — prose
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const; // all numerals
// Section label: identical size / tracking / color everywhere. Pair with `mb-3` for its content gap.
const label = `${HEAD} text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]`;
const divider = "border-[var(--hair)]";
const chip = `${HEAD} inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] px-3 py-1 text-[11px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--cream)]`;

const fmtToPar = (n: number | null | undefined) => (n == null ? "—" : n === 0 ? "E" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const scoreColor = (n: number | null) => (n == null ? "var(--cream)" : n < 0 ? "#8FBF9A" : n === 0 ? "var(--cream)" : "var(--sage-dim)");
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
// WMO weather codes → short label + emoji (Open-Meteo current weather).
function wmo(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear", icon: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { label: "Overcast", icon: "☁️" };
  if (code <= 48) return { label: "Fog", icon: "🌫️" };
  if (code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code <= 77) return { label: "Snow", icon: "❄️" };
  if (code <= 82) return { label: "Showers", icon: "🌧️" };
  if (code <= 86) return { label: "Snow", icon: "❄️" };
  return { label: "Storms", icon: "⛈️" };
}
const timeAgo = (ms: number) => { const d = Math.floor((Date.now() - ms) / 86400000); return d <= 0 ? "today" : d === 1 ? "1d" : d < 7 ? `${d}d` : new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
// Rounds cadence: rounds this year, current week streak, and this-month vs last (matches the app dashboard).
function roundsSummary(dates: number[]) {
  const now = new Date(), thisYear = now.getFullYear(), WEEK = 7 * 86400000;
  const roundsThisYear = dates.filter((ms) => new Date(ms).getFullYear() === thisYear).length;
  const weekKey = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d.getTime(); };
  const weeks = new Set(dates.map(weekKey));
  let streak = 0, w = weekKey(now.getTime());
  if (!weeks.has(w)) w -= WEEK; // grace: count from last week if none yet this week
  while (weeks.has(w)) { streak++; w -= WEEK; }
  const inMonth = (ms: number, mo: number, yr: number) => { const d = new Date(ms); return d.getMonth() === mo && d.getFullYear() === yr; };
  const cntThis = dates.filter((ms) => inMonth(ms, now.getMonth(), thisYear)).length;
  const lastMo = now.getMonth() === 0 ? 11 : now.getMonth() - 1, lastMoYr = now.getMonth() === 0 ? thisYear - 1 : thisYear;
  const cntLast = dates.filter((ms) => inMonth(ms, lastMo, lastMoYr)).length;
  return { roundsThisYear, streak, cntThis, cntLast, monthDelta: cntThis - cntLast };
}
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
  const sw = size >= 82 ? 5.5 : 4.5;
  return (
    <div className="flex flex-col items-center gap-2.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <g transform={`translate(${size / 2} ${size / 2})`}>
          <circle r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
          {frac != null && <circle r={r} fill="none" stroke="var(--gold)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${p * C} ${C}`} transform="rotate(-90)" />}
          <text textAnchor="middle" dominantBaseline="central" y="0">
            <tspan style={{ fontSize: size * 0.235, fontWeight: 800, fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)", fill: "var(--cream)" }}>{value}</tspan>
            {unit && <tspan dx="1" style={{ fontSize: size * 0.13, fontWeight: 700, fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)", fill: "var(--sage-dim)" }}>{unit}</tspan>}
          </text>
        </g>
      </svg>
      <div className={`${HEAD} text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--sage-dim)]`}>{label}</div>
    </div>
  );
}

// Cardless Game IQ status for the hero: dial with the score, tier emblem, and the IQ-history spark.
function HeroIQ({ iq, history }: { iq: number; history: { t: number; iq: number }[] }) {
  const [tiers, setTiers] = useState(false);
  const rank = rankForIQ(iq);
  const rankText = rankLabel(rank);
  const prog = rankProgress(iq, rank);
  const toNext = rank.nextIQ != null ? Math.max(0, rank.nextIQ - iq) : 0;
  const nextText = rank.nextIQ != null ? rankLabel(rankForIQ(rank.nextIQ)) : null;
  const trend = history.length >= 2 ? history[history.length - 1].iq - history[history.length - 2].iq : 0;
  // dial geometry
  const S = 150, R = S / 2 - 9, C = 2 * Math.PI * R;
  // spark geometry
  const pts = history.slice(-16).map((h) => h.iq);
  const sw = 300, sh = 60, sp = 4;
  const smin = Math.min(...pts), smax = Math.max(...pts), sspan = smax - smin || 1;
  const sx = (i: number) => (pts.length <= 1 ? sw : (i / (pts.length - 1)) * sw);
  const sy = (v: number) => sp + (1 - (v - smin) / sspan) * (sh - 2 * sp);
  const line = pts.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");
  const area = pts.length ? `M0,${sh} ${pts.map((v, i) => `L${sx(i)},${sy(v)}`).join(" ")} L${sw},${sh} Z` : "";

  return (
    <>
    <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:gap-8 md:w-[420px]">
      {/* IQ dial */}
      <div className="relative shrink-0" style={{ width: S, height: S }}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
          <g transform={`translate(${S / 2} ${S / 2})`}>
            <circle r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="5" />
            <circle r={R} fill="none" stroke={rank.color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${prog * C} ${C}`} transform="rotate(-90)" />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`${HEAD} text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]`}>Game IQ</div>
          <div style={{ ...MONO, fontSize: 56, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em", color: "var(--cream)" }}>{iq}</div>
          <div className={`${HEAD} mt-1.5 rounded-full px-2.5 py-[3px] text-[10px] font-bold`} style={{ background: `${rank.color}22`, color: rank.color }}>{rankText}</div>
        </div>
      </div>
      {/* rank + spark */}
      <div className="w-full min-w-0 flex-1">
        <button onClick={() => setTiers(true)} className="group flex items-center gap-3 text-left" title="See all rank tiers">
          <LevelBadge iq={iq} size={40} />
          <div className="min-w-0">
            <div className={`${HEAD} truncate text-[18px] font-bold text-[var(--cream)]`}>{rankText}</div>
            <div className="text-[12px] text-[var(--sage-dim)] transition-colors group-hover:text-[var(--sage)]" style={MONO}>Rank {rank.level} of 30 · view tiers</div>
          </div>
        </button>
        <div className="mt-4 flex items-center gap-2">
          <span className={`${HEAD} text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]`}>IQ History</span>
          {trend !== 0 && (
            <span className="text-[12px] font-bold" style={{ color: trend > 0 ? "#8FBF9A" : "#C87F6A" }}>{trend > 0 ? "▲" : "▼"}{Math.abs(trend)}</span>
          )}
        </div>
        <svg className="mt-1.5 block w-full" viewBox={`0 0 ${sw} ${sh}`} preserveAspectRatio="none" height={sh}>
          <defs><linearGradient id="hiq-spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={rank.color} stopOpacity="0.24" /><stop offset="100%" stopColor={rank.color} stopOpacity="0" /></linearGradient></defs>
          {pts.length >= 2 && <>
            <path d={area} fill="url(#hiq-spark)" />
            <polyline points={line} fill="none" stroke={rank.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={sx(pts.length - 1)} cy={sy(pts[pts.length - 1])} r="4" fill={rank.color} />
          </>}
        </svg>
        {toNext > 0 && nextText ? (
          <div className="mt-2.5 text-[14px]" style={MONO}><span className="font-bold text-[var(--cream)]">{toNext} IQ</span><span className="text-[var(--sage-dim)]"> to </span><span className="font-bold text-[var(--gold)]">{nextText}</span></div>
        ) : (
          <div className="mt-2.5 text-[14px] font-bold text-[var(--gold)]" style={MONO}>Top rank reached</div>
        )}
      </div>
    </div>
    {tiers && <RankTiersModal iq={iq} onClose={() => setTiers(false)} />}
    </>
  );
}

export default function HomeView({ uid }: { uid: string }) {
  const { profile } = useAuth();
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<LeagueEvent[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [open, setOpen] = useState<DecodedRound | null>(null);
  const [putterNames, setPutterNames] = useState<Set<string>>(new Set());
  const [discMap, setDiscMap] = useState<Map<string, BagDisc>>(new Map());
  const [sortNewest, setSortNewest] = useState(true);   // ↑↓ Date (newest) vs Score (best to par)
  const [rangeKey, setRangeKey] = useState("last5");     // Last 5 / Events / MMM yyyy / All
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadedCover, setUploadedCover] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [weather, setWeather] = useState<{ temp: number; label: string; icon: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getDashboard(uid).then((d) => alive && setDash(d)).catch(() => {});
    getAllCourses().then((c) => alive && setCourses(c)).catch(() => {});
    getUpcomingEvents(60).then((e) => alive && setEvents(e)).catch(() => {});
    getFeed(20).then((f) => alive && setFeed(f)).catch(() => {});
    getPutterDiscNames().then((s) => alive && setPutterNames(s)).catch(() => {});
    getBag(uid).then((b) => alive && setDiscMap(new Map(b.discs.map((d) => [d.name.trim().toLowerCase(), { photoUrl: d.photoUrl, color: d.color, speed: d.speed }])))).catch(() => {});
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((p) => alive && setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
    }
    return () => { alive = false; };
  }, [uid]);

  // today's weather at the user's location (Open-Meteo — free, no key)
  useEffect(() => {
    if (!loc) return;
    const ctrl = new AbortController();
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => { const c = j?.current; if (c && typeof c.temperature_2m === "number") setWeather({ temp: Math.round(c.temperature_2m), ...wmo(Number(c.weather_code) || 0) }); })
      .catch(() => {});
    return () => ctrl.abort();
  }, [loc]);

  const coverPhoto = uploadedCover ?? profile?.coverPhotoUrl;
  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const url = await uploadProfileCover(uid, file); await setProfileCover(uid, url); setUploadedCover(url); }
    catch { /* surface silently — keep the current cover */ }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const complete = useMemo(() => (rounds ? [...rounds].filter((r) => r.isComplete).sort((a, b) => b.date - a.date) : []), [rounds]);
  // Month filter options — one per month that has rounds, newest first (complete is already date-desc).
  const monthOpts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of complete) { const d = new Date(r.date); const key = `${d.getFullYear()}-${d.getMonth() + 1}`; if (!seen.has(key)) seen.set(key, d.toLocaleDateString("en-US", { month: "short", year: "numeric" })); }
    return [...seen.entries()].map(([key, mlabel]) => ({ key, label: mlabel }));
  }, [complete]);
  // iOS Recent Activity: filter by range, then sort by date (newest) or score (best), cap 120.
  const shownRounds = useMemo(() => {
    let ranged: DecodedRound[];
    if (rangeKey === "all") ranged = complete;
    else if (rangeKey === "events") ranged = complete.filter((r) => r.leagueEventId != null);
    else if (rangeKey === "last5") ranged = complete.slice(0, 5);
    else ranged = complete.filter((r) => { const d = new Date(r.date); return `${d.getFullYear()}-${d.getMonth() + 1}` === rangeKey; });
    const sorted = sortNewest ? ranged : [...ranged].sort((a, b) => a.relativeToPar - b.relativeToPar);
    return sorted.slice(0, 120);
  }, [complete, rangeKey, sortNewest]);
  const rangeLabel = rangeKey === "last5" ? "Last 5" : rangeKey === "all" ? "All" : rangeKey === "events" ? "Events" : (monthOpts.find((m) => m.key === rangeKey)?.label ?? "Last 5");
  const last = complete[0];
  const roundDates = useMemo(() => (dash?.roundMetas ?? complete).map((m) => m.date), [dash, complete]);
  const cadence = roundDates.length ? roundsSummary(roundDates) : null;
  const career = useMemo(() => (rounds ? computeCareerStats(rounds, putterNames) : null), [rounds, putterNames]);
  const byName = useMemo(() => { const m = new Map<string, Course>(); courses.forEach((c) => { const k = c.name.trim().toLowerCase(); if (!m.has(k)) m.set(k, c); }); return m; }, [courses]);
  const lastCourse = last ? byName.get(last.courseName.trim().toLowerCase()) : undefined;
  const cover = lastCourse?.coverPhotoUrl;
  // Crisp aerial hero: satellite auto-fit to the GPS round, else a satellite centred on the course,
  // else the (low-res) cover photo as a last resort.
  const heroImg = coverPhoto
    ?? (last ? flightMapImageUrl(last, 1280, 460) : null)
    ?? (lastCourse?.latitude != null && lastCourse?.longitude != null ? courseSatelliteUrl(lastCourse.latitude, lastCourse.longitude, 1280, 460, 15.5) : null)
    ?? cover;
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

  // Always names the weakest area — the strokes-gained biggest leak (same #1 as "Where your strokes
  // go"), with per-category coaching copy. Only when there's genuinely no shot data at all does it ask
  // for a tracked round.
  const sg = useMemo(() => (rounds ? computeStrokesGained(rounds, putterNames) : null), [rounds, putterNames]);
  const workOn = useMemo(() => {
    if (!sg || !career) return null;
    const leak = rankedCategories(sg).filter((c) => c.eligible)[0];
    if (leak) {
      if (leak.id === "putting") return `Putting is where you're losing the most — ${sg.c1xPct}% on makeable putts inside 33 feet.`;
      if (leak.id === "tee") return sg.teeObPct >= 10 ? `OB is the leak off the tee — ${sg.teeObPct}% of your drives.` : `Off the tee is your biggest leak — only ${sg.teeFairwayPct}% of your drives are finding the fairway.`;
      if (leak.id === "approach") return `Your approach game is the leak — you're leaving ${sg.proximityAvgFt}-foot putts on average.`;
      if (leak.id === "short") return `Around the green is costing you — you're saving just ${sg.scramblePct}% after trouble.`;
    }
    // Not enough measured shots in any one category yet — still surface the most useful signal we have.
    if (career.c1.att >= 3 && career.c1.pct != null) return `Sharpen your putting — you're at ${Math.round(career.c1.pct * 100)}% on makeable putts inside 33 feet.`;
    if (career.teeAttempts >= 3 && career.fairwayPct != null) return `Off the tee — ${Math.round(career.fairwayPct * 100)}% of your drives are finding the fairway.`;
    if (career.avgToPar != null) return `You're averaging ${career.avgToPar > 0 ? "+" : ""}${career.avgToPar.toFixed(1)} to par — track your shots to pinpoint the leak.`;
    return "Play a shot-tracked round in the app and your focus builds itself.";
  }, [sg, career]);

  if (rounds === null) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)] text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }

  // Shared page frame: same max-width + horizontal padding as the hero, so left edges line up exactly.
  const frame = "mx-auto max-w-[1200px] px-6 sm:px-10";

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden">
        {heroImg && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImg} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        {/* two-part scrim: darken the left where the text sits, then fade fully to page color at the bottom */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(15,23,18,0.96) 0%, rgba(15,23,18,0.62) 44%, rgba(15,23,18,0.22) 100%), linear-gradient(to bottom, transparent 30%, rgba(15,23,18,0.72) 74%, var(--bg-deep) 99%)" }} />
        {/* change cover */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="grid h-8 w-8 place-items-center rounded-full bg-black/35 text-[var(--cream)] backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-50" title="Change cover photo" aria-label="Change cover photo">
            {uploading ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onCoverFile} />
        </div>
        <div className={`relative ${frame} pb-16 pt-10 sm:pt-12`}>
          {/* whole left stack (greeting → last round) + Game IQ (right), vertically centered on the cover */}
          <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between md:gap-10">
            <div className="min-w-0">
              {weather && (
                <div className="mb-2 flex items-center gap-1.5 text-[13px] text-[var(--sage)]">
                  <span className="text-base leading-none">{weather.icon}</span>
                  <span className="font-semibold text-[var(--cream)]" style={MONO}>{weather.temp}°</span>
                  <span>{weather.label}</span>
                </div>
              )}
              <div className={`${label} !text-[var(--sage)]`}>{greeting()}</div>
              <div className="mt-2 flex items-center gap-3.5">
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-lg font-bold text-[var(--cream)] ring-2 ring-white/20">
                  {profile?.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.profileImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : firstName.charAt(0).toUpperCase()}
                </span>
                <div className={`${HEAD} text-[38px] font-bold leading-none`}>{firstName}</div>
              </div>
              {last ? (
                <div className="mt-8">
                  <div className={`${label} mb-3`}>Your last round</div>
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
            {dash && dash.iqCurrent > 0
              ? <HeroIQ iq={dash.iqCurrent} history={dash.iqHistory} />
              : last ? <div className="w-full md:w-[300px]"><ToParLine round={last} w={300} h={88} /></div> : null}
          </div>
        </div>
      </div>

      {/* ===== GRID — explicit: fluid main + fixed rail, 40px gutter, both start at the same Y ===== */}
      <div className={`${frame} pb-20 pt-8`}>
        <div className="grid gap-8 lg:grid-cols-[1fr_384px] lg:items-start lg:gap-10">
          {/* MAIN */}
          <div className="min-w-0">
            {workOn && (
              <div className={`border-b ${divider} pb-10`}>
                <div className={`${label} mb-4`}>What to work on</div>
                <p className={`${HEAD} max-w-2xl text-[30px] font-semibold leading-[1.28] text-[var(--cream)] sm:text-[34px]`}>{workOn}</p>
                <Link href="/bag?tab=improve" className="mt-5 inline-block text-[15px] font-semibold text-[var(--gold)]">Open Improve →</Link>
              </div>
            )}

            <div className={`${workOn ? "pt-8" : ""}`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className={label}>Recent rounds</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSortNewest((v) => !v)} className={chip} title="Sort by date or score">
                    <span className="text-[var(--sage-dim)]">↑↓</span> {sortNewest ? "Date" : "Score"}
                  </button>
                  <div className="relative">
                    <button onClick={() => setMenuOpen((v) => !v)} className={chip}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3 w-3"><path d="M3 6h18M6 12h12M10 18h4" /></svg>
                      {rangeLabel}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 z-50 mt-1.5 max-h-72 w-40 overflow-y-auto rounded-xl border border-[var(--hair-strong)] bg-[var(--bg-mid)] py-1.5 shadow-xl">
                          {[{ key: "last5", label: "Last 5" }, { key: "events", label: "Events" }, ...monthOpts, { key: "all", label: "All" }].map((o) => (
                            <button key={o.key} onClick={() => { setRangeKey(o.key); setMenuOpen(false); }} className={`block w-full px-3.5 py-1.5 text-left text-[12.5px] ${rangeKey === o.key ? "font-bold text-[var(--gold)]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{o.label}</button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {complete.length === 0 ? (
                <p className="text-sm text-[var(--sage-dim)]">No rounds yet — play one in the Radius app.</p>
              ) : shownRounds.length === 0 ? (
                <p className="text-sm text-[var(--sage-dim)]">No rounds in this range.</p>
              ) : (
                <div className="space-y-3.5">
                  {shownRounds.map((r) => (
                    <RoundPreviewCard key={r.roundId} round={r} cover={byName.get(r.courseName.trim().toLowerCase())?.coverPhotoUrl} onClick={() => setOpen(r)} discMap={discMap} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="min-w-0">
            {/* Your rounds — activity heatmap (its own section at the top of the rail) */}
            {cadence && (
              <div className={`border-b ${divider} pb-6`}>
                <div className="mb-4 flex items-baseline justify-between gap-2">
                  <span className={label}>Your rounds</span>
                  <span className="text-[14px] text-[var(--sage)]" style={MONO}><span className="font-bold text-[var(--cream)]">{cadence.roundsThisYear}</span> this year</span>
                </div>
                <RoundsHeatmap dates={roundDates} />
                <div className={`mt-5 flex items-center justify-between border-t ${divider} pt-4 text-[14px]`} style={MONO}>
                  <span><span className="text-[var(--sage-dim)]">Streak </span><span className="font-bold text-[var(--cream)]">{cadence.streak} wk{cadence.streak === 1 ? "" : "s"}</span>{cadence.streak >= 2 && <span> 🔥</span>}</span>
                  <span>
                    <span className="text-[var(--sage-dim)]">This month </span><span className="font-bold text-[var(--cream)]">{cadence.cntThis}</span>
                    {(cadence.cntThis > 0 || cadence.cntLast > 0) && <span className={`ml-1.5 font-semibold ${cadence.monthDelta >= 0 ? "text-[#5fcf80]" : "text-[#f08c8c]"}`}>{cadence.monthDelta >= 0 ? `▲ ${cadence.monthDelta}` : `▼ ${Math.abs(cadence.monthDelta)}`} vs last</span>}
                  </span>
                </div>
              </div>
            )}

            {/* Play a course — a section, not a card; copy adapts to the player */}
            <div className={`mt-6 border-b ${divider} pb-6`}>
              <div className={`${HEAD} text-[19px] font-bold text-[var(--cream)]`}>{courseNudge.title}</div>
              <p className={`${BODY} mt-2 text-[15px] leading-snug text-[var(--sage)]`}>{courseNudge.body}</p>
              <div className="mt-4 flex items-center gap-5">
                <Link href="/courses" className="text-[15px] font-semibold text-[var(--gold)]">Find a course →</Link>
                <Link href="/courses/new" className="text-[15px] font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Add a course</Link>
              </div>
            </div>

            {/* Your game — stat rings, mirroring the app */}
            <div className={`mt-6 border-b ${divider} pb-6`}>
              <div className={`${label} mb-5`}>Your game</div>
              <div className="grid grid-cols-3 gap-2">
                <StatRing size={86} label="C1X Putt" value={career && career.c1.att >= 3 && career.c1.pct != null ? `${Math.round(career.c1.pct * 100)}` : "—"} unit={career && career.c1.att >= 3 && career.c1.pct != null ? "%" : undefined} frac={career && career.c1.att >= 3 ? career.c1.pct : null} />
                <StatRing size={86} label="Avg Drive" value={career?.avgDriveFt ? `${Math.round(career.avgDriveFt)}` : "—"} unit={career?.avgDriveFt ? "ft" : undefined} frac={career?.avgDriveFt ? career.avgDriveFt / 400 : null} />
                <StatRing size={86} label="Fairway" value={career?.fairwayPct != null ? `${Math.round(career.fairwayPct * 100)}` : "—"} unit={career?.fairwayPct != null ? "%" : undefined} frac={career?.fairwayPct ?? null} />
              </div>
              <Link href="/bag" className="mt-5 inline-block text-[15px] font-semibold text-[var(--gold)]">Open My Game →</Link>
            </div>

            {/* Near you */}
            {showNear && (
              <div className={`mt-6 border-b ${divider} pb-6`}>
                <div className={`${label} mb-4`}>Near you</div>
                <div className="space-y-4">
                  {nearEvents.map(({ e, mi }) => (
                    <Link key={e.id} href="/leagues" className="flex items-center gap-3">
                      <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg bg-[#22302A]">
                        <span className="text-[7.5px] font-bold uppercase tracking-wide text-[var(--gold)]">{new Date(e.date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                        <span className="text-[14px] font-bold leading-none text-[var(--cream)]" style={MONO}>{new Date(e.date).getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-[var(--cream)]">{e.name}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-[var(--sage-dim)]" style={MONO}>{e.courseName} · {miLabel(mi)}</span>
                      </span>
                    </Link>
                  ))}
                  {sceneCourses.map(({ c, mi }) => (
                    <Link key={c.id} href={`/courses/${slugify(c.name, c.id)}`} className="flex items-center gap-3">
                      {c.coverPhotoUrl && (
                        <span className="h-[42px] w-[42px] shrink-0 overflow-hidden rounded-lg bg-[#22302A]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-[var(--cream)]">{c.name}</span>
                        <span className="mt-0.5 block text-[12px] text-[var(--sage-dim)]" style={MONO}>{miLabel(mi)} · {playedNames.has(c.name.trim().toLowerCase()) ? "played" : "new to you"}</span>
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
                <div className={`${label} mb-4`}>The scene</div>
                <div className="space-y-4">
                  {scene.map((p) => (
                    <Link key={p.id} href="/community" className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[#22302A] text-[13px] font-semibold text-[var(--sage)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.authorPhotoUrl ? <img src={p.authorPhotoUrl} alt="" className="h-full w-full object-cover" /> : (p.authorName || "?").charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-[var(--cream)]">{p.authorName}</span>
                        {p.linkedCourseName
                          ? <span className="mt-0.5 block truncate text-[12px] text-[var(--sage-dim)]" style={MONO}>{p.linkedCourseName}</span>
                          : <span className={`${BODY} mt-0.5 block truncate text-[12.5px] text-[var(--sage-dim)]`}>{p.text || "posted an update"}</span>}
                      </span>
                      {p.scoreToPar != null
                        ? <span className="w-10 shrink-0 text-right text-[16px] font-bold" style={{ ...MONO, color: scoreColor(p.scoreToPar) }}>{fmtToPar(p.scoreToPar)}</span>
                        : <span className="w-10 shrink-0 text-right text-[12px] text-[var(--sage-dim)]" style={MONO}>{timeAgo(p.createdAt)}</span>}
                    </Link>
                  ))}
                </div>
                <Link href="/community" className="group mt-5 flex items-center justify-center gap-1.5 rounded-[10px] border border-[var(--hair-strong)] py-3 text-[13px] font-semibold text-[var(--sage)] transition-colors hover:border-[var(--gold)]/45 hover:bg-[var(--gold)]/[0.05] hover:text-[var(--gold)]">
                  See more in Community
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>

      {open && <Scorecard round={open} rounds={complete} onClose={() => setOpen(null)} />}
    </div>
  );
}
