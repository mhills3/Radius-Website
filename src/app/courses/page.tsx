"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { getAllCourses, getTopBuilders, slugify, isUSState, countryOf, STATE_NAMES, type Course, type Builder } from "@/lib/courses";
import { getRanksFor, type RankInfo } from "@/lib/community";
import { getPlayedCourses, type PlayedStat } from "@/lib/rounds";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/courses/CourseCard";
import CourseMap from "@/components/CourseMap";
import CoverageMap from "@/components/courses/CoverageMap";

function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [played, setPlayed] = useState<Map<string, PlayedStat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [holes, setHoles] = useState<"all" | "9" | "18+">("all");
  const [freeOnly, setFreeOnly] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [userLoc, setUserLoc] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | null>(null);
  const [mapMode, setMapMode] = useState<"pins" | "heat" | "coverage">("pins");
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [builderRanks, setBuilderRanks] = useState<Map<string, RankInfo>>(new Map());

  useEffect(() => {
    getAllCourses().then(setCourses).catch(() => setCourses([])).finally(() => setLoading(false));
    getTopBuilders(10).then((b) => { setBuilders(b); getRanksFor(b.map((x) => x.id).filter(Boolean)).then(setBuilderRanks).catch(() => {}); }).catch(() => {});
    // Support the sitelinks search box / shareable search URLs: /courses?search=term
    const q = new URLSearchParams(window.location.search).get("search");
    if (q) setSearch(q);
  }, []);
  useEffect(() => {
    if (user) getPlayedCourses(user.uid).then(setPlayed).catch(() => {});
    else setPlayed(new Map());
  }, [user]);

  const playedOf = (c: Course) => played.get(c.name.trim().toLowerCase());
  const yourCourses = useMemo(() => courses.filter((c) => played.has(c.name.trim().toLowerCase())).sort((a, b) => (played.get(b.name.trim().toLowerCase())?.lastDate ?? 0) - (played.get(a.name.trim().toLowerCase())?.lastDate ?? 0)).slice(0, 6), [courses, played]);

  const states = useMemo(() => [...new Set(courses.map((c) => c.state).filter(Boolean))].sort(), [courses]);
  const anyFilter = !!(search || stateFilter || holes !== "all" || freeOnly);

  // geo + fun stats
  const usStateCount = useMemo(() => new Set(courses.filter((c) => isUSState(c.state)).map((c) => c.state!.trim().toUpperCase())).size, [courses]);
  const countryCount = useMemo(() => new Set(courses.map((c) => countryOf(c))).size, [courses]);
  const topStates = useMemo(() => {
    const m = new Map<string, number>();
    courses.forEach((c) => { if (isUSState(c.state)) { const k = c.state!.trim().toUpperCase(); m.set(k, (m.get(k) || 0) + 1); } });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [courses]);
  const topCountries = useMemo(() => {
    const m = new Map<string, number>();
    courses.forEach((c) => { const k = countryOf(c); m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [courses]);
  const totalHoles = useMemo(() => courses.reduce((s, c) => s + (c.holeCount || 0), 0), [courses]);
  // cap at a realistic ceiling — a few courses carry corrupt distanceFt values.
  const longest = useMemo(() => courses.reduce<Course | null>((a, c) => (c.distanceFt > (a?.distanceFt || 0) && c.distanceFt < 60000 ? c : a), null), [courses]);
  const maxStateCount = topStates[0]?.[1] || 1;
  // Coverage choropleth counts, keyed by the geo dataset's UPPERCASE names.
  const stateCounts = useMemo(() => {
    const m = new Map<string, number>();
    courses.forEach((c) => {
      if (!isUSState(c.state)) return;
      const up = c.state!.trim().toUpperCase();
      let name = (STATE_NAMES[up] || c.state!.trim()).toUpperCase();
      if (name === "WASHINGTON DC") name = "DISTRICT OF COLUMBIA";
      m.set(name, (m.get(name) || 0) + 1);
    });
    return m;
  }, [courses]);
  const countryCounts = useMemo(() => {
    const ALIAS: Record<string, string> = { "UNITED STATES": "UNITED STATES OF AMERICA", US: "UNITED STATES OF AMERICA", USA: "UNITED STATES OF AMERICA" };
    const m = new Map<string, number>();
    courses.forEach((c) => {
      const co = countryOf(c);
      if (!co || co === "International") return;
      const key = ALIAS[co.toUpperCase()] || co.toUpperCase();
      m.set(key, (m.get(key) || 0) + 1);
    });
    return m;
  }, [courses]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const out = courses.filter((c) => {
      if (s && !`${c.name} ${c.city} ${c.state}`.toLowerCase().includes(s)) return false;
      if (stateFilter && c.state !== stateFilter) return false;
      if (holes === "9" && c.holeCount > 9) return false;
      if (holes === "18+" && c.holeCount < 18) return false;
      if (freeOnly && !c.isFree) return false;
      return true;
    });
    if (userLoc) {
      return [...out].sort((a, b) => {
        const da = a.latitude != null && a.longitude != null ? miles(userLoc, { lat: a.latitude, lng: a.longitude }) : 1e9;
        const dbb = b.latitude != null && b.longitude != null ? miles(userLoc, { lat: b.latitude, lng: b.longitude }) : 1e9;
        return da - dbb;
      });
    }
    return out;
  }, [courses, search, stateFilter, holes, freeOnly, userLoc]);

  const featured = useMemo(() => courses.filter((c) => c.isFeatured && c.coverPhotoUrl).slice(0, 3), [courses]);
  const newest = useMemo(() => [...courses].filter((c) => (c.dateCreated ?? 0) > 0).sort((a, b) => (b.dateCreated ?? 0) - (a.dateCreated ?? 0)).slice(0, 3), [courses]);
  const mostReviewed = useMemo(() => [...courses].filter((c) => (c.reviewCount ?? 0) > 0).sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0)).slice(0, 3), [courses]);
  const addedThisMonth = useMemo(() => courses.filter((c) => (c.dateCreated ?? 0) > Date.now() - 30 * 86400000).length, [courses]);
  const courseOfDay = useMemo(() => {
    // Rule: only courses that have a cover photo are eligible.
    const pool = courses.filter((c) => c.coverPhotoUrl);
    if (!pool.length) return null;
    return pool[Math.floor(Date.now() / 86400000) % pool.length];
  }, [courses]);
  const trending = useMemo(() => [...courses].filter((c) => (c.communityScoreCount ?? 0) > 0).sort((a, b) => (b.communityScoreCount ?? 0) - (a.communityScoreCount ?? 0)).slice(0, 3), [courses]);
  const topRated = useMemo(() => [...courses].filter((c) => (c.rating ?? 0) > 0 && c.coverPhotoUrl).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3), [courses]);
  const distOf = (c: Course) => (userLoc && c.latitude != null && c.longitude != null ? miles(userLoc, { lat: c.latitude, lng: c.longitude }) : null);

  const nearMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { const u = { lng: pos.coords.longitude, lat: pos.coords.latitude }; setUserLoc(u); setFlyTo({ ...u, zoom: 9 }); setView("map"); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      {/* hero — photo backed (DSC_8535 basket) */}
      <div className="relative isolate overflow-hidden bg-[var(--bg-deep)] text-[var(--cream)]">
        <Image src="/course/courses-hero.jpg" alt="" fill sizes="100vw" quality={88} className="-z-10 object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(15,24,19,0.8),rgba(15,24,19,0.72))]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-7 pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Find your next round</div>
              <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Courses</h1>
            </div>
            <div className="flex gap-7">
              <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none">{courses.length}</div><div className="mt-1 text-xs text-[rgba(245,237,225,0.6)]">courses</div></div>
              <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none">{usStateCount}</div><div className="mt-1 text-xs text-[rgba(245,237,225,0.6)]">US states</div></div>
              <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none">{countryCount}</div><div className="mt-1 text-xs text-[rgba(245,237,225,0.6)]">countries</div></div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-sm focus-within:border-[var(--gold)] sm:max-w-xs">
              <svg className="h-4 w-4 shrink-0 text-[#8a968d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses, cities…" className="w-full bg-transparent text-sm text-[#16221b] placeholder-[#8a968d] outline-none" />
            </div>
            <button onClick={nearMe} className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-bold shadow-sm transition-colors ${userLoc ? "border-[#4d94fa] bg-[#4d94fa]/10 text-[#2b6fd6]" : "border-black/10 bg-white text-[#46554c] hover:text-[#16221b]"}`}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {locating ? "Locating…" : userLoc ? "Near you" : "Near me"}
            </button>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#16221b] shadow-sm outline-none focus:border-[var(--gold)]">
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="inline-flex rounded-full border border-black/10 bg-white p-1 shadow-sm">
              {(["all", "9", "18+"] as const).map((h) => (
                <button key={h} onClick={() => setHoles(h)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${holes === h ? "bg-[#16221b] text-white" : "text-[#46554c] hover:text-[#16221b]"}`}>{h === "all" ? "Any" : h === "9" ? "9" : "18+"}</button>
              ))}
            </div>
            <button onClick={() => setFreeOnly((v) => !v)} className={`rounded-full border px-4 py-2.5 text-xs font-semibold shadow-sm transition-colors ${freeOnly ? "border-[var(--gold)] bg-[var(--gold)] text-[#16221b]" : "border-black/10 bg-white text-[#46554c] hover:text-[#16221b]"}`}>Free</button>
            <div className="ml-auto inline-flex rounded-full border border-black/10 bg-white p-1 shadow-sm">
              {(["list", "map"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} aria-label={v} className={`grid h-8 w-9 place-items-center rounded-full transition-colors ${view === v ? "bg-[var(--gold)] text-[#16221b]" : "text-[#46554c] hover:text-[#16221b]"}`}>
                  {v === "list" ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg> : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15" /></svg>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {view === "map" ? (
        /* ===== Split discovery (AllTrails/Zillow style) ===== */
        <>
          {/* context toolbar — meshes the hero into the map split */}
          <div className="border-b border-white/[0.06] bg-[var(--bg-deep)] text-[var(--cream)]">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-5 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="font-[family-name:var(--font-heading)] text-base font-extrabold">{filtered.length.toLocaleString()}</span>
                <span className="text-sm text-[var(--sage)]">{filtered.length === 1 ? "course" : "courses"}{stateFilter ? ` in ${stateFilter}` : userLoc ? " near you" : " on the map"}</span>
              </div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.06] p-1">
                {(["pins", "heat", "coverage"] as const).map((m) => (
                  <button key={m} onClick={() => setMapMode(m)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${mapMode === m ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{m === "pins" ? "📍 Pins" : m === "heat" ? "🔥 Heatmap" : "🗺️ Coverage"}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:h-[calc(100vh-251px)] lg:grid-cols-[400px_1fr]">
          <div className="order-2 overflow-y-auto border-r border-black/[0.06] bg-[#faf8f3] lg:order-1">
            {loading ? (
              <div className="space-y-2 p-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-black/5" />)}</div>
            ) : (
              <div className="divide-y divide-black/[0.05]">
                {filtered.map((c) => {
                  const d = distOf(c);
                  const active = highlightId === c.id;
                  return (
                    <Link key={c.id} href={`/courses/${slugify(c.name, c.id)}`} onMouseEnter={() => setHighlightId(c.id)} onMouseLeave={() => setHighlightId(null)} className={`group flex items-center gap-3.5 px-4 py-3 transition-colors ${active ? "bg-[var(--gold)]/[0.1]" : "hover:bg-black/[0.025]"}`}>
                      <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl bg-[var(--bg-deep)] ring-1 ring-black/[0.06]">
                        {c.coverPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.coverPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" />
                        ) : (
                          <span className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.3),var(--bg-deep))] font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--cream)]/50">{c.name.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate font-[family-name:var(--font-heading)] text-[15px] font-bold leading-tight text-[#16221b] group-hover:text-[#9a7a3a]">{c.name}</h3>
                          {c.rating ? <span className="shrink-0 text-xs font-bold text-[#9a7a3a]">★ {c.rating.toFixed(1)}</span> : null}
                        </div>
                        <div className="mt-1 flex items-center gap-1 truncate text-xs text-[#8a968d]">
                          <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                          <span className="truncate">{[c.city, c.state].filter(Boolean).join(", ")}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[#46554c]">{c.holeCount} holes · Par {c.par}</span>
                          {playedOf(c) && <span className="rounded-md bg-[#5fcf80]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#1d8f48]">✓ PLAYED</span>}
                          {d != null && <span className="ml-auto rounded-full bg-[#2b6fd6]/10 px-2 py-0.5 text-[11px] font-bold text-[#2b6fd6]">{d < 10 ? d.toFixed(1) : Math.round(d)} mi</span>}
                        </div>
                      </div>
                      <svg className="h-4 w-4 shrink-0 text-black/15 transition-colors group-hover:text-[#9a7a3a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                    </Link>
                  );
                })}
                {filtered.length === 0 && <p className="p-8 text-center text-sm text-[#6b7a70]">No courses match.</p>}
              </div>
            )}
          </div>
          <div className="relative order-1 h-[60vh] lg:order-2 lg:h-full">
            {mapMode === "coverage" ? (
              <CoverageMap stateCounts={stateCounts} countryCounts={countryCounts} />
            ) : (
              <CourseMap courses={filtered} filterActive={anyFilter} highlightId={highlightId} flyTo={flyTo} userLoc={userLoc} onSelect={setHighlightId} onLocate={setUserLoc} mode={mapMode} className="h-full w-full" />
            )}
          </div>
        </div>
        </>
      ) : (
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="lg:grid lg:grid-cols-[1fr_290px] lg:gap-8 lg:items-start">
            <div className="min-w-0">
              {!loading && !anyFilter && (
                <>
                  {courseOfDay && (
                    <Link href={`/courses/${slugify(courseOfDay.name, courseOfDay.id)}`} className="group mb-10 block overflow-hidden rounded-3xl border border-black/8 shadow-sm">
                      <div className="relative aspect-[21/9] w-full overflow-hidden bg-[var(--bg-deep)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={courseOfDay.coverPhotoUrl} alt={courseOfDay.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute left-5 top-5 rounded-full bg-[var(--gold)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#16221b]">☀️ Course of the day</div>
                        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3 text-white">
                          <div>
                            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold drop-shadow md:text-3xl">{courseOfDay.name}</h2>
                            <div className="mt-1 text-sm text-white/90 drop-shadow">📍 {[courseOfDay.city, courseOfDay.state].filter(Boolean).join(", ")} · {courseOfDay.holeCount} holes · Par {courseOfDay.par}{courseOfDay.rating ? ` · ★ ${courseOfDay.rating.toFixed(1)}` : ""}</div>
                          </div>
                          <span className="rounded-full bg-white/95 px-5 py-2.5 text-sm font-bold text-[#16221b] transition-transform group-hover:-translate-y-0.5">Explore →</span>
                        </div>
                      </div>
                    </Link>
                  )}
                  {trending.length > 0 && <Row title="🔥 Trending now" subtitle="Most played this season" items={trending} played={played} />}
                  {newest.length > 0 && <Row title="🆕 Recently added" subtitle={`${addedThisMonth} new in the last 30 days`} items={newest} played={played} />}
                  {mostReviewed.length > 0 && <Row title="💬 Most reviewed" items={mostReviewed} played={played} />}
                  {yourCourses.length > 0 && <Row title="⛳ Your courses" subtitle="Courses you've played — with your best" items={yourCourses} played={played} />}
                  {featured.length > 0 && <Row title="★ Featured" items={featured} played={played} />}
                  {topRated.length > 0 && <Row title="⭐ Top rated" items={topRated} played={played} />}
                </>
              )}
              {(anyFilter || loading) && (
                <>
                  {anyFilter && <h2 className="mb-4 mt-2 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">{filtered.length} result{filtered.length === 1 ? "" : "s"}</h2>}
                  {loading ? (
                    <div className="grid gap-5 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-black/5" />)}</div>
                  ) : filtered.length === 0 ? (
                    <p className="rounded-2xl border border-black/8 bg-white p-12 text-center text-sm text-[#6b7a70]">No courses match your filters.</p>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2">{filtered.map((c) => <CourseCard key={c.id} course={c} played={playedOf(c)} />)}</div>
                  )}
                </>
              )}
            </div>

            {/* SIDE RAIL — fun geographic intel */}
            <aside className="mt-10 lg:mt-0">
              <div className="space-y-4 lg:sticky lg:top-24">
                {user && (
                  <Link href="/courses/mine" className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/[0.08] p-4 shadow-sm transition-colors hover:bg-[var(--gold)]/[0.14]">
                    <div className="flex items-center gap-2.5">
                      <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: "linear-gradient(135deg,#e0a23a,#16221b)" }}>
                        <span className="absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.2 }} />
                        <svg className="relative h-4 w-4 text-[var(--cream)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" /></svg>
                      </span>
                      <div>
                        <div className="text-sm font-bold text-[#16221b]">My courses</div>
                        <div className="text-xs text-[#8a968d]">Manage courses & layouts you built</div>
                      </div>
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-[#9a7a3a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </Link>
                )}
                <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">🏗️ Top builders</div>
                  <div className="space-y-3">
                    {builders.length === 0 && <p className="text-sm text-[#8a968d]">—</p>}
                    {builders.map((b, i) => (
                      <div key={b.name + i} className="flex items-center gap-3">
                        <span className="w-3 shrink-0 text-xs font-bold text-[#9a7a3a]">{i + 1}</span>
                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--gold)]/15 text-xs font-bold text-[#9a7a3a]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {b.id && builderRanks.get(b.id)?.photo ? <img src={builderRanks.get(b.id)!.photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : b.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#16221b]">{b.name}</span>
                        <span className="shrink-0 text-xs font-bold text-[#6b7a70]">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">🗺️ Top states</div>
                  <div className="space-y-2.5">
                    {topStates.map(([st, n]) => (
                      <Link key={st} href={`/courses/state/${st}`} className="flex items-center gap-2.5 text-sm group">
                        <span className="w-7 shrink-0 font-bold text-[#16221b] group-hover:text-[#9a7a3a]">{st}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.max(8, (n / maxStateCount) * 100)}%` }} /></div>
                        <span className="w-8 shrink-0 text-right text-xs font-semibold text-[#6b7a70]">{n}</span>
                      </Link>
                    ))}
                    {topStates.length === 0 && <p className="text-sm text-[#8a968d]">—</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">🌍 Countries</div>
                  <div className="space-y-2">
                    {topCountries.map(([cn, n], i) => (
                      <div key={cn} className="flex items-center gap-2.5 text-sm">
                        <span className="w-3 shrink-0 text-xs font-bold text-[#9a7a3a]">{i + 1}</span>
                        <span className="flex-1 truncate font-semibold text-[#16221b]">{FLAG[cn] ?? "📍"} {cn}</span>
                        <span className="shrink-0 text-xs font-semibold text-[#6b7a70]">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">📊 By the numbers</div>
                  <div className="space-y-2.5 text-sm">
                    <Num label="Holes mapped" value={totalHoles.toLocaleString()} />
                    <Num label="Avg holes / course" value={courses.length ? Math.round(totalHoles / courses.length) : 0} />
                    <Num label="US states" value={usStateCount} />
                    <Num label="Countries" value={countryCount} />
                    <Num label="Added this month" value={`+${addedThisMonth}`} />
                    {longest && <Num label="Longest course" value={`${Math.round(longest.distanceFt).toLocaleString()} ft`} />}
                  </div>
                  {longest && <p className="mt-2 truncate text-xs text-[#8a968d]">🏆 {longest.name}</p>}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

const FLAG: Record<string, string> = {
  "United States": "🇺🇸", Canada: "🇨🇦", Mexico: "🇲🇽", "United Kingdom": "🇬🇧", Ireland: "🇮🇪", Finland: "🇫🇮", Sweden: "🇸🇪", Norway: "🇳🇴", Estonia: "🇪🇪", Germany: "🇩🇪", Netherlands: "🇳🇱", France: "🇫🇷", Czechia: "🇨🇿", Denmark: "🇩🇰", Australia: "🇦🇺", "New Zealand": "🇳🇿", Japan: "🇯🇵", International: "🌍",
};

function Num({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between"><span className="text-[#6b7a70]">{label}</span><span className="font-bold text-[#16221b]">{value}</span></div>;
}

function Row({ title, subtitle, items, played }: { title: string; subtitle?: string; items: Course[]; played?: Map<string, PlayedStat> }) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[#8a968d]">{subtitle}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((c) => <CourseCard key={c.id} course={c} played={played?.get(c.name.trim().toLowerCase())} />)}</div>
    </section>
  );
}
