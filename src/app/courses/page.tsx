"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { getAllCourses, getTotalCourseCount, getTopBuilders, slugify, isUSState, canonicalState, stateAbbr, countryOf, STATE_NAMES, type Course, type Builder } from "@/lib/courses";
import { getOwnedIds } from "@/lib/account";
import { getRanksFor, type RankInfo } from "@/lib/community";
import { getPlayedCourses, type PlayedStat } from "@/lib/rounds";
import { useAuth } from "@/components/AuthProvider";
import CourseCard from "@/components/courses/CourseCard";
import CourseMap from "@/components/CourseMap";
import { useMetricPref } from "@/lib/useMetricPref";
import { fmtDist } from "@/lib/units";
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
  const metric = useMetricPref();
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalCount, setTotalCount] = useState(0);
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
  const [mapBounds, setMapBounds] = useState<{ west: number; south: number; east: number; north: number } | null>(null);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [builderRanks, setBuilderRanks] = useState<Map<string, RankInfo>>(new Map());
  // List ↔ map link: refs to result rows so a highlighted pin scrolls its row into view.
  const rowRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    getTopBuilders(10).then((b) => { setBuilders(b); getRanksFor(b.map((x) => x.id).filter(Boolean)).then(setBuilderRanks).catch(() => {}); }).catch(() => {});
    // Headline "courses" stat = the full mapped-course total (matches the homepage banner exactly).
    getTotalCourseCount().then(setTotalCount).catch(() => {});
    // Support the sitelinks search box / shareable search URLs: /courses?search=term
    const q = new URLSearchParams(window.location.search).get("search");
    if (q) setSearch(q);
  }, []);
  useEffect(() => {
    let live = true;
    // Load the public directory — and, for a signed-in user, include the PRIVATE courses they own
    // (their linked ids) so a builder still sees their own private course on the list/map while it
    // stays hidden from everyone else.
    (async () => {
      const ownerIds = user ? await getOwnedIds(user.uid).catch(() => undefined) : undefined;
      const cs = await getAllCourses(ownerIds).catch(() => []);
      if (live) { setCourses(cs); setLoading(false); }
    })();
    if (user) getPlayedCourses(user.uid).then(setPlayed).catch(() => {});
    else setPlayed(new Map());
    return () => { live = false; };
  }, [user]);

  // When a map pin becomes the highlight, scroll its row into view in the floating panel.
  useEffect(() => {
    if (!highlightId) return;
    rowRefs.current[highlightId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightId]);

  const playedOf = (c: Course) => played.get(c.name.trim().toLowerCase());
  const yourCourses = useMemo(() => courses.filter((c) => played.has(c.name.trim().toLowerCase())).sort((a, b) => (played.get(b.name.trim().toLowerCase())?.lastDate ?? 0) - (played.get(a.name.trim().toLowerCase())?.lastDate ?? 0)).slice(0, 6), [courses, played]);

  const states = useMemo(() => [...new Set(courses.map((c) => c.state).filter(Boolean))].sort(), [courses]);
  const anyFilter = !!(search || stateFilter || holes !== "all" || freeOnly);

  // geo + fun stats — canonicalState dedupes "CA" vs "California" so this matches the coverage map.
  // DC is a federal district, not a state — exclude it so the count tops out at 50.
  const usStateCount = useMemo(() => new Set(courses.map((c) => canonicalState(c.state)).filter((s) => s && s !== "DISTRICT OF COLUMBIA")).size, [courses]);
  const countryCount = useMemo(() => new Set(courses.map((c) => countryOf(c)).filter((co) => co && co !== "International")).size, [courses]);
  const topStates = useMemo(() => {
    const m = new Map<string, number>();
    // Normalize to the 2-letter code so "Mississippi" displays as "MS" AND merges with any "MS" rows.
    courses.forEach((c) => { const code = stateAbbr(c.state); if (code) m.set(code, (m.get(code) || 0) + 1); });
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

  // In map view, the left list narrows to courses inside the current map viewport — zoom/pan to filter.
  const viewportFiltering = view === "map" && mapMode !== "coverage" && !!mapBounds;
  const visibleCourses = useMemo(() => {
    if (!viewportFiltering || !mapBounds) return filtered;
    return filtered.filter((c) => c.latitude != null && c.longitude != null &&
      c.latitude >= mapBounds.south && c.latitude <= mapBounds.north &&
      c.longitude >= mapBounds.west && c.longitude <= mapBounds.east);
  }, [filtered, viewportFiltering, mapBounds]);

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
  const mostPlayed = useMemo(() => [...courses].filter((c) => (c.communityScoreCount ?? 0) > 0).sort((a, b) => (b.communityScoreCount ?? 0) - (a.communityScoreCount ?? 0)).slice(0, 5), [courses]);
  // Truly top-rated: a Bayesian weighted score (IMDb-style) so a single 5-star
  // review can't outrank a heavily-reviewed course. Each course's rating is
  // pulled toward the global mean in proportion to how few reviews it has;
  // ties break on review count (more reviews = more trustworthy).
  const topRated = useMemo(() => {
    const rated = courses.filter((c) => (c.reviewCount ?? 0) > 0 && (c.rating ?? 0) > 0 && c.coverPhotoUrl);
    const C = rated.length ? rated.reduce((sum, c) => sum + (c.rating ?? 0), 0) / rated.length : 0;
    const M = 5; // reviews needed before a course's own average is trusted
    const weighted = (c: Course) => {
      const v = c.reviewCount ?? 0, R = c.rating ?? 0;
      return (v / (v + M)) * R + (M / (v + M)) * C;
    };
    return [...rated].sort((a, b) => weighted(b) - weighted(a) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0)).slice(0, 3);
  }, [courses]);
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

  // Title + stats, grouped on one baseline so the numbers relate to the headline.
  const heroHead = (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <div>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Find your next round</div>
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] text-[var(--cream)] md:text-5xl">Courses</h1>
      </div>
      <div className="flex items-end gap-6 pb-1.5">
        {[["courses", (totalCount || courses.length).toLocaleString()], ["US states", usStateCount], ["countries", countryCount]].map(([label, val]) => (
          <div key={label as string}>
            <div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none text-[var(--cream)]">{val}</div>
            <div className="mt-1 text-[11px] uppercase tracking-wide text-[rgba(245,237,225,0.55)]">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // One unified bar of dark-translucent controls, used on both the hero (list) and floating over the map.
  const controlBar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-[210px] flex-1 items-center gap-2.5 rounded-full border border-[var(--ctl-line)] bg-[var(--ctl)] px-4 py-2.5 backdrop-blur-md transition-colors focus-within:border-[var(--gold)] sm:max-w-xs">
        <svg className="h-4 w-4 shrink-0 text-[var(--c-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses, cities…" className="w-full bg-transparent text-sm text-[var(--c-ink)] placeholder-[var(--c-muted)] outline-none" />
      </div>
      <button onClick={nearMe} className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-xs font-bold backdrop-blur-md transition-colors ${userLoc ? "border-[var(--gold)] bg-[var(--gold-dim)] text-[var(--gold)]" : "border-[var(--ctl-line)] bg-[var(--ctl)] text-[var(--c-body)] hover:text-[var(--c-ink)]"}`}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
        {locating ? "Locating…" : userLoc ? "Near you" : "Near me"}
      </button>
      <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="rounded-full border border-[var(--ctl-line)] bg-[var(--ctl)] px-4 py-2.5 text-sm font-medium text-[var(--c-ink)] backdrop-blur-md outline-none [color-scheme:dark] focus:border-[var(--gold)]">
        <option value="">All states</option>
        {states.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="inline-flex rounded-full border border-[var(--ctl-line)] bg-[var(--ctl)] p-1 backdrop-blur-md">
        {(["all", "9", "18+"] as const).map((h) => (
          <button key={h} onClick={() => setHoles(h)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${holes === h ? "bg-[var(--gold)] text-[#141b16]" : "text-[var(--c-body)] hover:text-[var(--c-ink)]"}`}>{h === "all" ? "Any" : h === "9" ? "9" : "18+"}</button>
        ))}
      </div>
      <button onClick={() => setFreeOnly((v) => !v)} className={`rounded-full border px-4 py-2.5 text-xs font-semibold backdrop-blur-md transition-colors ${freeOnly ? "border-[var(--gold)] bg-[var(--gold)] text-[#141b16]" : "border-[var(--ctl-line)] bg-[var(--ctl)] text-[var(--c-body)] hover:text-[var(--c-ink)]"}`}>Free</button>
      <div className="ml-auto inline-flex rounded-full border border-[var(--ctl-line)] bg-[var(--ctl)] p-1 backdrop-blur-md">
        {(["list", "map"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} aria-label={v} className={`grid h-8 w-9 place-items-center rounded-full transition-colors ${view === v ? "bg-[var(--gold)] text-[#141b16]" : "text-[var(--c-body)] hover:text-[var(--c-ink)]"}`}>
            {v === "list" ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg> : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15" /></svg>}
          </button>
        ))}
      </div>
    </div>
  );

  // Minimal controls for the map panel — just search + the list/map toggle (filters live in list view).
  const mapControls = (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[var(--ctl-line)] bg-[var(--ctl)] px-4 py-2.5 transition-colors focus-within:border-[var(--gold)]">
        <svg className="h-4 w-4 shrink-0 text-[var(--c-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses, cities…" className="w-full bg-transparent text-sm text-[var(--c-ink)] placeholder-[var(--c-muted)] outline-none" />
      </div>
      <div className="inline-flex shrink-0 rounded-full border border-[var(--ctl-line)] bg-[var(--ctl)] p-1">
        {(["list", "map"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} aria-label={v} className={`grid h-8 w-9 place-items-center rounded-full transition-colors ${view === v ? "bg-[var(--gold)] text-[#141b16]" : "text-[var(--c-body)] hover:text-[var(--c-ink)]"}`}>
            {v === "list" ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg> : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15" /></svg>}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="courses-scope min-h-screen bg-[var(--c-bg)] text-[var(--c-ink)]">
      {view === "map" ? (
        /* ===== Map-first: the map is the foundation; header, controls & results float on it ===== */
        <div key="map" className="course-view-in relative h-[100svh] w-full overflow-hidden">
          <div className="absolute inset-0">
            {mapMode === "coverage" ? (
              <CoverageMap stateCounts={stateCounts} countryCounts={countryCounts} />
            ) : (
              <CourseMap courses={filtered} filterActive={anyFilter} highlightId={highlightId} flyTo={flyTo} userLoc={userLoc} onSelect={setHighlightId} onLocate={setUserLoc} onBoundsChange={setMapBounds} mode={mapMode} className="h-full w-full" />
            )}
          </div>
          {/* slim top scrim so the transparent nav stays legible over the map */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-[linear-gradient(to_bottom,rgba(12,18,15,0.85),transparent)]" />
          {/* floating results panel — carries the controls + list; the map itself stays clean */}
          <div className="absolute bottom-11 left-4 top-[84px] z-20 flex w-[372px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-[var(--r-panel)] bg-[var(--panel)] shadow-[var(--e-float)] backdrop-blur-xl sm:left-5">
            <div className="shrink-0 px-3 pt-3">{mapControls}</div>
            <div className="shrink-0 px-4 pb-2 pt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="font-[family-name:var(--font-heading)] text-base font-extrabold text-[var(--c-ink)]">{(viewportFiltering ? visibleCourses.length : (anyFilter ? filtered.length : (totalCount || filtered.length))).toLocaleString()}</span>
                <span className="text-sm text-[var(--c-muted)]">{(viewportFiltering ? visibleCourses.length : (anyFilter ? filtered.length : (totalCount || filtered.length))) === 1 ? "course" : "courses"}{viewportFiltering ? " in view" : stateFilter ? ` in ${stateFilter}` : userLoc ? " near you" : ""}</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="space-y-1.5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[78px] animate-pulse rounded-[var(--r-inset)] bg-[var(--c-raise)]" />)}</div>
              ) : (
                <div className="space-y-0.5">
                  {visibleCourses.map((c) => {
                    const d = distOf(c);
                    const active = highlightId === c.id;
                    return (
                      <Link key={c.id} ref={(el) => { rowRefs.current[c.id] = el; }} href={`/courses/${slugify(c.name, c.id)}`} onMouseEnter={() => setHighlightId(c.id)} onMouseLeave={() => setHighlightId(null)} className={`group flex items-center gap-3 rounded-[var(--r-inset)] px-2.5 py-2.5 transition-all ${active ? "bg-[var(--gold)]/[0.18]" : "hover:bg-white/[0.05]"}`}>
                        <div className="relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[var(--r-inset)] bg-[var(--bg-deep)] ring-1 ring-[var(--c-line)]">
                          {c.coverPhotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.coverPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" />
                          ) : (
                            <span className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.3),var(--bg-deep))] font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]/50">{c.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="truncate font-[family-name:var(--font-heading)] text-[14px] font-bold leading-tight text-[var(--c-ink)] group-hover:text-[var(--gold)]">{c.name}</h3>
                            {c.rating ? <span className="shrink-0 text-xs font-bold text-[var(--gold)]">★ {c.rating.toFixed(1)}</span> : null}
                          </div>
                          <div className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--c-muted)]">
                            <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
                            <span className="truncate">{[c.city, c.state].filter(Boolean).join(", ")}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2 text-xs">
                            <span className="font-semibold text-[var(--c-body)]">{c.holeCount} holes · Par {c.par}</span>
                            {playedOf(c) && <span className="rounded-md bg-[#5fcf80]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#5fcf80]">✓ PLAYED</span>}
                            {d != null && <span className="ml-auto rounded-full bg-[#8FBDE3]/12 px-2 py-0.5 text-[11px] font-bold text-[#8FBDE3]">{d < 10 ? d.toFixed(1) : Math.round(d)} mi</span>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                  {visibleCourses.length === 0 && <p className="p-8 text-center text-sm text-[var(--c-muted)]">{viewportFiltering ? "No courses in this area — zoom out to see more." : "No courses match."}</p>}
                </div>
              )}
            </div>
          </div>
          {/* Pins / Heatmap / Coverage — bottom-right, clear of the results panel */}
          <div className="absolute bottom-4 right-4 z-20 inline-flex rounded-full bg-[var(--panel)] p-1 shadow-[var(--e-float)] backdrop-blur-xl">
            {(["pins", "heat", "coverage"] as const).map((m) => (
              <button key={m} onClick={() => setMapMode(m)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${mapMode === m ? "bg-[var(--gold)] text-[#141b16]" : "text-[var(--c-body)] hover:text-[var(--c-ink)]"}`}>{m === "pins" ? "📍 Pins" : m === "heat" ? "🔥 Heatmap" : "🗺️ Coverage"}</button>
            ))}
          </div>
        </div>
      ) : (
        <div key="list" className="course-view-in">
          {/* ===== dissolving photo hero ===== */}
          <div className="relative isolate overflow-hidden">
            <Image src="/course/courses-hero.jpg" alt="" fill sizes="100vw" quality={88} className="-z-10 object-cover object-center" />
            <div className="absolute inset-0 -z-10 bg-[rgba(12,18,15,0.62)]" />
            {/* generous fade — the last ~10% is solid page-ground so the photo's edge is never a line */}
            <div className="absolute inset-x-0 bottom-0 -z-10 h-[340px] bg-[linear-gradient(to_top,var(--c-bg)_0%,var(--c-bg)_9%,rgba(12,18,15,0.55)_46%,transparent_100%)]" />
            <div className="relative mx-auto max-w-7xl px-6 pb-40 pt-[124px]">{heroHead}</div>
          </div>
          {/* unified controls — float in the hero's fade zone; no band, no borders. The pills carry
              their own translucent surface, so they stay readable pinned over content on scroll. */}
          <div className="sticky top-[58px] z-30 -mt-24">
            <div className="mx-auto max-w-7xl px-6 py-3">{controlBar}</div>
          </div>
          <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="lg:grid lg:grid-cols-[1fr_290px] lg:gap-8 lg:items-start">
            <div className="min-w-0">
              {!loading && !anyFilter && (
                <>
                  {courseOfDay && (
                    <Link href={`/courses/${slugify(courseOfDay.name, courseOfDay.id)}`} className="group mb-10 block overflow-hidden rounded-3xl border border-[var(--c-line)] shadow-sm">
                      <div className="relative aspect-[21/9] w-full overflow-hidden bg-[var(--bg-deep)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={courseOfDay.coverPhotoUrl} alt={courseOfDay.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute left-5 top-5 rounded-full bg-[var(--gold)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#141b16]">☀️ Course of the day</div>
                        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3 text-white">
                          <div>
                            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold drop-shadow md:text-3xl">{courseOfDay.name}</h2>
                            <div className="mt-1 text-sm text-white/90 drop-shadow">📍 {[courseOfDay.city, courseOfDay.state].filter(Boolean).join(", ")} · {courseOfDay.holeCount} holes · Par {courseOfDay.par}{courseOfDay.rating ? ` · ★ ${courseOfDay.rating.toFixed(1)}` : ""}</div>
                          </div>
                          <span className="rounded-full bg-white/95 px-5 py-2.5 text-sm font-bold text-[#141b16] transition-transform group-hover:-translate-y-0.5">Explore →</span>
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
                    <div className="grid gap-5 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-[var(--c-raise)]" />)}</div>
                  ) : filtered.length === 0 ? (
                    <p className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-card)] p-12 text-center text-sm text-[var(--c-muted)]">No courses match your filters.</p>
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
                  <Link href="/courses/mine" className="group relative block overflow-hidden rounded-2xl shadow-[0_12px_30px_-14px_rgba(15,24,19,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-14px_rgba(15,24,19,0.85)]">
                    <span className="pointer-events-none absolute -inset-x-12 inset-y-0 z-10 bg-[linear-gradient(110deg,transparent_32%,rgba(246,193,101,0.4),transparent_68%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    <div className="relative flex items-center gap-3.5 bg-[linear-gradient(135deg,rgba(232,181,96,0.14),var(--c-card)_58%)] p-4 ring-1 ring-[var(--gold)]/30 transition-colors group-hover:ring-[var(--gold)]/55">
                      <span className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff" }} />
                      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--gold-bright)] to-[var(--gold)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.45)]">
                        <span className="h-8 w-8 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url(/basket-icon.svg)" }} />
                      </span>
                      <div className="relative min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">Your builds</div>
                        <div className="font-[family-name:var(--font-heading)] text-base font-extrabold leading-tight tracking-tight text-[var(--cream)]">My courses &amp; layouts</div>
                        <div className="mt-0.5 text-xs text-[var(--sage)]">Manage everything you&apos;ve mapped</div>
                      </div>
                      <svg className="relative h-4 w-4 shrink-0 text-[var(--gold)] transition-transform duration-300 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                    </div>
                  </Link>
                )}
                <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-card)] p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">🏗️ Top builders</div>
                  <div className="space-y-3">
                    {builders.length === 0 && <p className="text-sm text-[var(--c-muted)]">—</p>}
                    {builders.map((b, i) => {
                      const legend = b.count >= 100; // 100+ courses built → "Legend" treatment
                      return (
                      <div key={b.name + i} className="flex items-center gap-3">
                        <span className="w-3 shrink-0 text-xs font-bold text-[var(--gold)]">{i + 1}</span>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold text-[var(--gold)] ${legend ? "bg-gradient-to-br from-[var(--gold-bright)] to-[var(--gold)] ring-2 ring-[var(--gold)]/40" : "bg-[var(--gold)]/15"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {b.id && builderRanks.get(b.id)?.photo ? <img src={builderRanks.get(b.id)!.photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : b.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="flex min-w-0 flex-1 items-center gap-1">
                          {legend && (
                            <svg className="h-3.5 w-3.5 shrink-0 text-[var(--gold-bright)]" viewBox="0 0 24 24" fill="currentColor" aria-label="Legend"><path d="M5 19h14l1.5-10-4.5 3.5L12 6l-4 6.5L3.5 9 5 19z" /></svg>
                          )}
                          <span className="flex min-w-0 flex-col">
                            <span className={`min-w-0 truncate text-sm leading-tight ${legend ? "bg-gradient-to-r from-[#f0c377] to-[#f7dca0] bg-clip-text font-extrabold text-transparent" : "font-semibold text-[var(--c-ink)]"}`} title={legend ? `${b.name} · Legend builder (${b.count} courses)` : b.name}>{b.name}</span>
                            {b.username && <span className="min-w-0 truncate text-[11px] leading-tight text-[var(--c-muted)]">@{b.username}</span>}
                          </span>
                        </span>
                        <span className={`shrink-0 text-xs font-bold ${legend ? "text-[var(--gold-bright)]" : "text-[var(--c-muted)]"}`}>{b.count}</span>
                      </div>
                      );
                    })}
                  </div>
                </div>

                {mostPlayed.length > 0 && (
                  <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-card)] p-4 shadow-sm">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">🔥 Most popular</div>
                    <div className="space-y-3">
                      {mostPlayed.map((c, i) => {
                        const top = i === 0; // #1 most-played gets the crown + gold treatment
                        return (
                          <Link key={c.id} href={`/courses/${slugify(c.name, c.id)}`} className="group flex items-center gap-3">
                            <span className="w-3 shrink-0 text-xs font-bold text-[var(--gold)]">{i + 1}</span>
                            <span className={`relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-deep)] ${top ? "ring-2 ring-[var(--gold)]/50" : "ring-1 ring-[var(--c-line)]"}`}>
                              {c.coverPhotoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={c.coverPhotoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                              ) : (
                                <span className="grid h-full w-full place-items-center font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--cream)]/55">{c.name.charAt(0)}</span>
                              )}
                            </span>
                            <span className="flex min-w-0 flex-1 items-center gap-1">
                              {top && <svg className="h-3.5 w-3.5 shrink-0 text-[var(--gold-bright)]" viewBox="0 0 24 24" fill="currentColor" aria-label="Most played"><path d="M5 19h14l1.5-10-4.5 3.5L12 6l-4 6.5L3.5 9 5 19z" /></svg>}
                              <span className="min-w-0">
                                <span className={`block truncate text-sm leading-tight ${top ? "bg-gradient-to-r from-[#f0c377] to-[#f7dca0] bg-clip-text font-extrabold text-transparent" : "font-semibold text-[var(--c-ink)] group-hover:text-[var(--gold)]"}`}>{c.name}</span>
                                <span className="block truncate text-[11px] text-[var(--c-muted)]">{[c.city, c.state].filter(Boolean).join(", ")}</span>
                              </span>
                            </span>
                            <span className={`shrink-0 text-xs font-bold ${top ? "text-[var(--gold-bright)]" : "text-[var(--c-muted)]"}`}>{(c.communityScoreCount ?? 0).toLocaleString()}</span>
                          </Link>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[10px] text-[var(--c-muted)]">By rounds logged on Radius</p>
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-card)] p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">🗺️ Top states</div>
                  <div className="space-y-2.5">
                    {topStates.map(([st, n]) => (
                      <Link key={st} href={`/courses/state/${st}`} className="flex items-center gap-2.5 text-sm group">
                        <span className="w-7 shrink-0 font-bold text-[var(--c-ink)] group-hover:text-[var(--gold)]">{st}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--c-raise)]"><div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.max(8, (n / maxStateCount) * 100)}%` }} /></div>
                        <span className="w-8 shrink-0 text-right text-xs font-semibold text-[var(--c-muted)]">{n}</span>
                      </Link>
                    ))}
                    {topStates.length === 0 && <p className="text-sm text-[var(--c-muted)]">—</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-card)] p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">🌍 Countries</div>
                  <div className="space-y-2">
                    {topCountries.map(([cn, n], i) => (
                      <div key={cn} className="flex items-center gap-2.5 text-sm">
                        <span className="w-3 shrink-0 text-xs font-bold text-[var(--gold)]">{i + 1}</span>
                        <span className="flex-1 truncate font-semibold text-[var(--c-ink)]">{FLAG[cn] ?? "📍"} {cn}</span>
                        <span className="shrink-0 text-xs font-semibold text-[var(--c-muted)]">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--c-line)] bg-[var(--c-card)] p-4 shadow-sm">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">📊 By the numbers</div>
                  <div className="space-y-2.5 text-sm">
                    <Num label="Holes mapped" value={totalHoles.toLocaleString()} />
                    <Num label="Avg holes / course" value={courses.length ? Math.round(totalHoles / courses.length) : 0} />
                    <Num label="US states" value={usStateCount} />
                    <Num label="Countries" value={countryCount} />
                    <Num label="Added this month" value={`+${addedThisMonth}`} />
                    {longest && <Num label="Longest course" value={fmtDist(longest.distanceFt, metric)} />}
                  </div>
                  {longest && <p className="mt-2 truncate text-xs text-[var(--c-muted)]">🏆 {longest.name}</p>}
                </div>
              </div>
            </aside>
          </div>
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
  return <div className="flex items-center justify-between"><span className="text-[var(--c-body)]">{label}</span><span className="font-bold text-[var(--c-ink)]">{value}</span></div>;
}

function Row({ title, subtitle, items, played }: { title: string; subtitle?: string; items: Course[]; played?: Map<string, PlayedStat> }) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--c-muted)]">{subtitle}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((c) => <CourseCard key={c.id} course={c} played={played?.get(c.name.trim().toLowerCase())} />)}</div>
    </section>
  );
}
