"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCourseByShortId, getCourseScores, idFromSlug, slugify, isPrivateCourse, type Course, type CourseScore } from "@/lib/courses";
import { getOwnedIds } from "@/lib/account";
import { getRanksFor, type RankInfo } from "@/lib/community";
import CourseHoleMap, { holesWithGeo } from "@/components/courses/CourseHoleMap";
import CourseCommunity from "@/components/courses/CourseCommunity";
import CourseReviews from "@/components/courses/CourseReviews";
import { getCourseRoundsForUser, type DecodedRound } from "@/lib/rounds";
import { getCourseRecords, type CourseRecords as CourseRecordsData } from "@/lib/courseRecords";
import CourseRecords from "@/components/courses/CourseRecords";
import { useAuth } from "@/components/AuthProvider";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoibWlrZXkzIiwiYSI6ImNtb3Fra25hZzB6dnIycHB6ZHMxcjIwNHYifQ.tyyS7i-aoR54_l11rW0Khg";
const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number) => (n < 0 ? "#15803d" : n === 0 ? "#16221b" : "#dc2626");
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const MEDALS = ["🥇", "🥈", "🥉"];
function shotColor(result: string): string {
  const r = (result || "").toLowerCase();
  if (r.includes("ob") || r.includes("penalty")) return "#e0473f";
  if (r.includes("miss")) return "#ffa600";
  if (r.includes("circle 2") || r.includes("c2")) return "#d9b300";
  if (r.includes("basket") || r.includes("circle 1") || r.includes("c1")) return "#1ab859";
  return "#4d94fa";
}

export default function CourseDetailClient({ slug }: { slug: string }) {
  const { user, profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [scores, setScores] = useState<CourseScore[]>([]);
  const [ranks, setRanks] = useState<Map<string, RankInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeHole, setActiveHole] = useState<number | null>(null);
  const [myRounds, setMyRounds] = useState<DecodedRound[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [records, setRecords] = useState<CourseRecordsData>({ aces: [], drives: [], loaded: false });
  const [layoutId, setLayoutId] = useState("default");
  const [activeSection, setActiveSection] = useState("overview");
  // Private courses are viewable ONLY by their creator. null = n/a (public course), true/false = checked.
  const [ownerOfPrivate, setOwnerOfPrivate] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const shortId = idFromSlug(slug);
      if (!shortId) { setNotFound(true); setLoading(false); return; }
      const c = await getCourseByShortId(shortId);
      if (!c) { setNotFound(true); setLoading(false); return; }
      setCourse(c);
      setLoading(false);
      getCourseScores(c.id, 100).then((sc) => {
        setScores(sc);
        getRanksFor(sc.map((s) => s.playerUid).filter(Boolean) as string[]).then(setRanks).catch(() => {});
      }).catch(() => setScores([]));
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (user && course) getCourseRoundsForUser(user.uid, course.name).then((r) => { setMyRounds(r); setRoundIdx(0); }).catch(() => {});
    else setMyRounds([]);
  }, [user, course]);

  // Gate private courses: only the creator (across their linked ids) may view one.
  useEffect(() => {
    if (!course || !isPrivateCourse(course)) { setOwnerOfPrivate(null); return; }
    let live = true;
    (async () => {
      if (!user) { if (live) setOwnerOfPrivate(false); return; }
      const owned = await getOwnedIds(user.uid).catch(() => null);
      if (live) setOwnerOfPrivate(!!owned && !!course.createdById && owned.has(course.createdById));
    })();
    return () => { live = false; };
  }, [course, user]);

  // Records (aces + long drives) are derived from leaderboard players' submitted rounds.
  useEffect(() => {
    if (course && scores.length) getCourseRecords(course.name, scores).then(setRecords).catch(() => {});
  }, [course, scores]);

  // Scroll-spy: highlight the active section in the sticky nav.
  useEffect(() => {
    if (!course) return;
    const ids = ["overview", "layout", "holes", "records", "leaderboard", "photos", "reviews", "community"];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActiveSection(vis[0].target.id);
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: [0, 0.2, 0.5, 1] }
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [course]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-[#faf8f3] text-[#6b7a70]">
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        Loading course…
      </div>
    );
  }
  if (notFound || !course) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#faf8f3] text-[#16221b]">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">Course not found</h1>
        <Link href="/courses" className="text-sm font-bold text-[#9a7a3a] hover:underline">← Back to all courses</Link>
      </div>
    );
  }
  // Private course: anyone who isn't the creator (incl. signed-out visitors) is blocked.
  if (isPrivateCourse(course) && ownerOfPrivate !== true) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#faf8f3] px-6 text-center text-[#16221b]">
        <div className="text-3xl">🔒</div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.02em]">This course is private</h1>
        <p className="mx-auto max-w-sm text-sm text-[#46554c]">Only the player who built it can view this course.</p>
        <Link href="/courses" className="mt-4 rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-[#16221b]">Browse public courses</Link>
      </div>
    );
  }

  const sortedHoles = [...(course.holes || [])].sort((a, b) => a.holeNumber - b.holeNumber);
  const hasGeo = typeof course.latitude === "number" && typeof course.longitude === "number";
  const totalPar = sortedHoles.reduce((s, h) => s + h.par, 0) || course.par;
  const totalDist = sortedHoles.reduce((s, h) => s + (h.distance || 0), 0) || course.distanceFt;

  // Layouts — most courses have multiple. "Main layout" = the course default holes.
  const layoutOptions = [
    { id: "default", name: "Main layout", holes: sortedHoles, par: totalPar, distanceFt: totalDist },
    ...(course.layouts || []).filter((l) => l.holes.length > 0).map((l) => ({ id: l.id || l.name, name: l.name, holes: l.holes, par: l.par, distanceFt: l.distanceFt })),
  ];
  const activeLayout = layoutOptions.find((l) => l.id === layoutId) || layoutOptions[0];
  const activeHoles = activeLayout.holes;
  const hasLayouts = layoutOptions.length > 1;
  const layoutNames = new Set((course.layouts || []).map((l) => l.name));
  const scopedScores = !hasLayouts ? scores : activeLayout.id === "default" ? scores.filter((s) => !s.layoutName || !layoutNames.has(s.layoutName)) : scores.filter((s) => s.layoutName === activeLayout.name);
  const layoutAvg = course.layoutAverages?.[activeLayout.name];

  const myScore = user ? scopedScores.find((s) => s.playerUid === user.uid) : undefined;
  const geoHoles = holesWithGeo(sortedHoles);
  const selectedRound = myRounds[roundIdx];
  const activeRoundHole = activeHole != null ? selectedRound?.holes.find((h) => h.holeNumber === activeHole) : undefined;
  const flightThrows = activeRoundHole?.throws.filter((t) => (t.distance ?? 0) > 0);
  const isOwner = !!profile && profile.canonicalId === course.createdById;
  const record = scopedScores[0];
  const players = scopedScores.length;
  const avgToPar = players ? Math.round(scopedScores.reduce((s, x) => s + x.relativeToPar, 0) / players) : null;
  const distBuckets = players
    ? [
        { l: "Under par", n: scopedScores.filter((s) => s.relativeToPar < 0).length },
        { l: "E – +5", n: scopedScores.filter((s) => s.relativeToPar >= 0 && s.relativeToPar <= 5).length },
        { l: "+6 – +10", n: scopedScores.filter((s) => s.relativeToPar >= 6 && s.relativeToPar <= 10).length },
        { l: "+11 – +20", n: scopedScores.filter((s) => s.relativeToPar >= 11 && s.relativeToPar <= 20).length },
        { l: "+21 plus", n: scopedScores.filter((s) => s.relativeToPar > 20).length },
      ]
    : [];
  const maxBucket = Math.max(1, ...distBuckets.map((b) => b.n));

  // records data
  const best = scopedScores.filter((s) => s.playerUid).slice(0, 5).map((s) => ({ uid: s.playerUid as string, name: s.playerName, username: s.username || s.playerHandle, value: s.relativeToPar }));
  const recordPhotos = new Map<string, string>();
  ranks.forEach((r, uid) => { if (r.photo) recordPhotos.set(uid, r.photo); });

  // derived insights (real data only)
  const par3 = sortedHoles.filter((h) => h.par === 3).length;
  const par4 = sortedHoles.filter((h) => h.par === 4).length;
  const par5 = sortedHoles.filter((h) => h.par >= 5).length;
  const withDist = sortedHoles.filter((h) => (h.distance || 0) > 0);
  const longest = withDist.length ? withDist.reduce((m, h) => ((h.distance || 0) > (m.distance || 0) ? h : m)) : null;
  const shortest = withDist.length ? withDist.reduce((m, h) => ((h.distance || 0) < (m.distance || 0) ? h : m)) : null;
  const avgHole = withDist.length ? Math.round(withDist.reduce((s, h) => s + (h.distance || 0), 0) / withDist.length) : 0;
  const amenities = (course.amenities || []).filter(Boolean);
  const feeLabel = course.isFree ? "Free" : course.courseFeeAmount ? `$${course.courseFeeAmount}` : "Paid";

  const SECTIONS = [
    { id: "overview", label: "Overview", show: true },
    { id: "layout", label: "Layout", show: geoHoles.length > 0 },
    { id: "holes", label: "Holes", show: sortedHoles.length > 0 },
    { id: "records", label: "Records", show: true },
    { id: "leaderboard", label: "Leaderboard", show: true },
    { id: "photos", label: "Photos", show: !!course.galleryPhotoUrls?.some((u) => /^https?:\/\//.test(u)) },
    { id: "reviews", label: "Reviews", show: true },
    { id: "community", label: "Community", show: true },
  ].filter((s) => s.show);

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      {/* ===== HERO — cinematic aerial of the actual course ===== */}
      <div className="relative isolate flex h-[64vh] min-h-[460px] w-full flex-col overflow-hidden bg-[var(--bg-deep)]">
        {hasGeo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${course.longitude},${course.latitude},13.6,0/1280x720@2x?access_token=${MAPBOX_TOKEN}`} alt="" referrerPolicy="origin" className="absolute inset-0 -z-10 h-full w-full animate-[kenburns_26s_ease-in-out_infinite_alternate] object-cover" aria-hidden />
        ) : (
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_30%,rgba(246,193,101,0.3),var(--bg-deep))]" aria-hidden />
        )}
        {/* topo grain */}
        <div className="pointer-events-none absolute inset-0 -z-10" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.05 }} aria-hidden />
        {/* cinematic vignette + bottom-anchored fade for legibility */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(130%_90%_at_50%_-15%,transparent_55%,rgba(15,24,19,0.55))]" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(15,24,19,0.97),rgba(15,24,19,0.2)_52%,rgba(15,24,19,0.62))]" aria-hidden />

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-between px-6 pb-6 pt-24">
          <div className="flex items-center justify-between">
            <Link href="/courses" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-4 py-2 text-sm font-medium text-[var(--cream)] backdrop-blur transition-colors hover:border-white/50">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 12L4 7l5-5" /></svg>All courses
            </Link>
            <div className="flex items-center gap-2">
              {isOwner && <Link href={`/courses/${slugify(course.name, course.id)}/edit`} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-4 py-2 text-sm font-semibold text-[var(--cream)] backdrop-blur hover:border-white/50"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>Edit</Link>}
              {hasGeo && <a href={`https://www.google.com/maps/dir/?api=1&destination=${course.latitude},${course.longitude}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-4 py-2 text-sm font-semibold text-[var(--cream)] backdrop-blur hover:border-white/50"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>Directions</a>}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {course.isFeatured && <span className="rounded-full bg-[var(--gold)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#16221b]">★ Featured</span>}
              <span className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">{feeLabel}</span>
              {course.courseType && <span className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">{course.courseType}</span>}
            </div>
            <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-extrabold leading-[1.02] tracking-[-0.03em] text-white md:text-6xl">{course.name}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-lg text-[rgba(245,237,225,0.9)]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
              {course.city}{course.state ? `, ${course.state}` : ""}
            </p>

            {/* glass stat bar */}
            <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 rounded-2xl border border-white/15 bg-black/30 px-5 py-3.5 backdrop-blur-md sm:inline-flex">
              <HeroStat label="Holes" value={course.holeCount} />
              <HeroStat label="Par" value={totalPar} />
              <HeroStat label="Length" value={totalDist ? `${totalDist.toLocaleString()} ft` : "—"} />
              {course.rating ? <HeroStat label="Rating" value={`★ ${course.rating.toFixed(1)}`} /> : null}
              {avgToPar != null ? <HeroStat label="Avg score" value={fmt(avgToPar)} /> : (course.manualDifficulty ? <HeroStat label="Difficulty" value={course.manualDifficulty} /> : null)}
            </div>
          </div>
        </div>
      </div>

      {/* ===== sticky section nav ===== */}
      <div className="sticky top-16 z-30 border-b border-black/[0.07] bg-[#faf8f3]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
          {SECTIONS.map((s) => {
            const active = activeSection === s.id;
            return (
              <a key={s.id} href={`#${s.id}`} className={`relative whitespace-nowrap px-3.5 py-3.5 text-sm font-semibold transition-colors ${active ? "text-[#16221b]" : "text-[#46554c] hover:text-[#16221b]"}`}>
                {s.label}
                {active && <span className="absolute inset-x-2.5 bottom-0 h-[3px] rounded-full bg-[var(--gold)]" />}
              </a>
            );
          })}
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="mx-auto grid max-w-6xl items-start gap-8 px-6 py-8 lg:grid-cols-[1fr_336px]">
        <main className="min-w-0 space-y-10">
          {/* OVERVIEW */}
          <section id="overview" className="scroll-mt-32">
            {course.description && <p className="leading-relaxed text-[#46554c]">{course.description}</p>}

            {/* at-a-glance chips — Type & Fee already live in the hero, so only the extras here */}
            {(course.terrain || course.manualDifficulty || amenities.length > 0) && (
              <div className="mt-5 flex flex-wrap gap-2">
                {[["Terrain", course.terrain], ["Difficulty", course.manualDifficulty]].filter(([, v]) => v).map(([k, v]) => (
                  <span key={k} className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-sm shadow-sm"><span className="text-[#8a968d]">{k}:</span> <span className="font-semibold text-[#16221b] capitalize">{v}</span></span>
                ))}
                {amenities.map((a) => <span key={a} className="rounded-full bg-black/[0.05] px-3 py-1.5 text-sm font-medium text-[#46554c]">{a}</span>)}
              </div>
            )}

            {/* record + beat-this */}
            {record && (() => {
              const rk = record.playerUid ? ranks.get(record.playerUid) : undefined;
              const mineRecord = user && record.playerUid === user.uid;
              return (
                <div className="mt-5 flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-gradient-to-r from-[#16221b] to-[#243528] p-5 text-[var(--cream)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">🏆</span>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--gold)]">Course record</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold" style={{ color: record.relativeToPar < 0 ? "#5fcf80" : record.relativeToPar === 0 ? "var(--cream)" : "#f08c8c" }}>{fmt(record.relativeToPar)}</span>
                        <span className="text-sm text-[rgba(245,237,225,0.85)]">by <span className="font-bold text-[var(--cream)]">{record.playerName}</span></span>
                        {rk && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${rk.color}30`, color: rk.color }}>{rk.tier}</span>}
                      </div>
                    </div>
                  </div>
                  {mineRecord ? <span className="rounded-full bg-[var(--gold)]/15 px-4 py-2 text-sm font-bold text-[var(--gold)]">👑 You hold the record</span> : <Link href="/login" className="shrink-0 rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[#16221b] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">Beat this score →</Link>}
                </div>
              );
            })()}
          </section>

          {/* LAYOUT */}
          {geoHoles.length > 0 && (
            <section id="layout" className="scroll-mt-32">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Course layout</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {myRounds.length > 0 && (
                    <label className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#9a7a3a]">My round:</span>
                      <select value={roundIdx} onChange={(e) => setRoundIdx(Number(e.target.value))} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#16221b] shadow-sm outline-none focus:border-[var(--gold)]">
                        {myRounds.map((r, i) => <option key={r.roundId} value={i}>{fmtDate(r.date)} · {fmt(r.relativeToPar)}</option>)}
                      </select>
                    </label>
                  )}
                  <span className="text-[#8a968d]">{geoHoles.length} holes mapped</span>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-black/8 shadow-sm">
                <CourseHoleMap holes={sortedHoles} highlightHole={activeHole} flight={flightThrows} onHole={setActiveHole} className="h-[460px] w-full" />
              </div>
              {activeRoundHole && activeRoundHole.throws.length > 0 ? (
                <div className="mt-3 rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-bold text-[#16221b]">Hole {activeHole} · your shots</span>
                    <span className="text-sm text-[#8a968d]">{activeRoundHole.score} on par {activeRoundHole.par} <span className="font-bold" style={{ color: scoreColor(activeRoundHole.score - activeRoundHole.par) }}>({fmt(activeRoundHole.score - activeRoundHole.par)})</span></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeRoundHole.throws.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2">
                          <span className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: shotColor(t.result) }}>{i + 1}</span>
                          <div className="leading-tight"><div className="text-xs font-bold text-[#16221b]">{t.discName && t.discName !== "Score" ? t.discName : t.result}</div><div className="text-[11px] text-[#8a968d]">{t.distance ? `${t.distance} ft · ` : ""}{t.result}</div></div>
                        </div>
                        {i < activeRoundHole.throws.length - 1 && <span className="text-[#cbd2cc]">→</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#8a968d]">Each line is a hole, tee → basket. Tap a hole {myRounds.length > 0 ? "to replay your shots (projected from real throw distances)" : "on the map or scorecard to highlight it"}.</p>
              )}
            </section>
          )}

          {/* HOLES */}
          {activeHoles.length > 0 && (
            <section id="holes" className="scroll-mt-32">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Hole-by-hole</h2>
                {hasLayouts && (
                  <div className="inline-flex flex-wrap gap-1 rounded-full border border-black/10 bg-white p-1 shadow-sm">
                    {layoutOptions.map((l) => (
                      <button key={l.id} onClick={() => setLayoutId(l.id)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${activeLayout.id === l.id ? "bg-[var(--gold)] text-[#16221b]" : "text-[#46554c] hover:text-[#16221b]"}`}>{l.name}</button>
                    ))}
                  </div>
                )}
              </div>
              {hasLayouts && (
                <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#6b7a70]">
                  <span><span className="font-bold text-[#16221b]">{activeHoles.length}</span> holes</span>
                  <span>Par <span className="font-bold text-[#16221b]">{activeLayout.par}</span></span>
                  <span><span className="font-bold text-[#16221b]">{activeLayout.distanceFt.toLocaleString()}</span> ft</span>
                  {layoutAvg != null && <span>Community avg <span className="font-bold" style={{ color: layoutAvg < 0 ? "#3a9d57" : "#46554c" }}>{fmt(Math.round(layoutAvg))}</span></span>}
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
                {(() => { const maxD = Math.max(1, ...activeHoles.map((h) => h.distance || 0)); return activeHoles.map((h) => {
                  const pct = Math.max(8, ((h.distance || 0) / maxD) * 100);
                  return (
                    <div key={h.holeNumber} onMouseEnter={() => setActiveHole(h.holeNumber)} onMouseLeave={() => setActiveHole(null)} className={`flex items-center gap-3 border-b border-black/5 px-4 py-2.5 transition-colors last:border-0 ${activeHole === h.holeNumber ? "bg-[var(--gold)]/[0.12]" : "hover:bg-black/[0.02]"}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${activeHole === h.holeNumber ? "bg-[var(--gold)] text-[#16221b]" : "bg-[#16221b] text-[var(--cream)]"}`}>{h.holeNumber}</span>
                      <span className="w-12 shrink-0 text-sm font-bold">Par {h.par}</span>
                      <div className="hidden min-w-0 flex-1 sm:block"><div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-[var(--gold)]/70" style={{ width: `${pct}%` }} /></div></div>
                      <span className="w-16 shrink-0 text-right text-sm text-[#46554c]">{h.distance > 0 ? `${h.distance} ft` : "—"}</span>
                      <span className="hidden w-28 shrink-0 truncate text-right text-xs text-[#8a968d] md:block">{[h.fairwayShape, h.elevation].filter((x) => x && x !== "Flat").join(" · ") || h.holeType || ""}</span>
                    </div>
                  );
                }); })()}
                <div className="flex items-center gap-3 bg-black/[0.03] px-4 py-3 text-sm font-bold">
                  <span className="grid h-7 w-7 shrink-0 place-items-center">Σ</span>
                  <span className="w-12 shrink-0">Par {activeLayout.par}</span>
                  <div className="hidden flex-1 sm:block" />
                  <span className="w-16 shrink-0 text-right">{activeLayout.distanceFt.toLocaleString()} ft</span>
                  <span className="hidden w-28 md:block" />
                </div>
              </div>
            </section>
          )}

          {/* RECORDS */}
          <section id="records" className="scroll-mt-32">
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Course records</h2>
            <CourseRecords best={best} aces={records.aces} drives={records.drives} photos={recordPhotos} loaded={records.loaded} />
          </section>

          {/* LEADERBOARD */}
          <section id="leaderboard" className="scroll-mt-32">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Leaderboard</h2>
              <div className="flex items-center gap-3">
                {hasLayouts && (
                  <div className="inline-flex flex-wrap gap-1 rounded-full border border-black/10 bg-white p-1 shadow-sm">
                    {layoutOptions.map((l) => (
                      <button key={l.id} onClick={() => setLayoutId(l.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activeLayout.id === l.id ? "bg-[var(--gold)] text-[#16221b]" : "text-[#46554c] hover:text-[#16221b]"}`}>{l.name}</button>
                    ))}
                  </div>
                )}
                {players > 0 && <span className="text-sm text-[#8a968d]">{players} player{players === 1 ? "" : "s"}</span>}
              </div>
            </div>
            {scopedScores.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center text-sm text-[#6b7a70]">No scores logged on this layout yet — <Link href="/login" className="font-bold text-[#9a7a3a] hover:underline">be the first</Link>.</div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
                {scopedScores.slice(0, 25).map((s, i) => {
                  const rk = s.playerUid ? ranks.get(s.playerUid) : undefined;
                  const mine = user && s.playerUid === user.uid;
                  return (
                    <div key={`${s.playerId}-${s.date}-${i}`} className={`flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-0 ${mine ? "bg-[var(--gold)]/[0.08]" : ""}`}>
                      <span className="w-6 shrink-0 text-center text-sm font-bold text-[#9a7a3a]">{i < 3 ? MEDALS[i] : i + 1}</span>
                      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {rk?.photo ? <img src={rk.photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : (s.playerName || "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {s.playerHandle ? <Link href={`/u/${s.playerHandle}`} className="truncate text-sm font-bold text-[#16221b] hover:text-[#9a7a3a]">{s.playerName}</Link> : <span className="truncate text-sm font-bold text-[#16221b]">{s.playerName}</span>}
                          {rk && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${rk.color}22`, color: rk.color }}>{rk.tier}</span>}
                        </div>
                        <div className="truncate text-xs text-[#8a968d]">{(s.username || s.playerHandle) ? `@${s.username || s.playerHandle} · ` : ""}{s.holesPlayed} holes{s.date ? ` · ${fmtDate(s.date)}` : ""}</div>
                      </div>
                      <span className="font-[family-name:var(--font-heading)] text-lg font-extrabold" style={{ color: scoreColor(s.relativeToPar) }}>{fmt(s.relativeToPar)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* PHOTOS */}
          {course.galleryPhotoUrls && course.galleryPhotoUrls.filter((u) => /^https?:\/\//.test(u)).length > 0 && (
            <section id="photos" className="scroll-mt-32">
              <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Photos</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {course.galleryPhotoUrls.filter((u) => /^https?:\/\//.test(u)).slice(0, 12).map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener" className={`group relative overflow-hidden rounded-2xl bg-black/5 ring-1 ring-inset ring-black/5 ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* REVIEWS — live from courses/{id}/reviews subcollection (cross-platform with the apps) */}
          <CourseReviews courseId={course.id} />

          {/* COMMUNITY */}
          <section id="community" className="scroll-mt-32"><CourseCommunity courseId={course.id} courseName={course.name} /></section>
        </main>

        {/* ===== STICKY SIDEBAR ===== */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          {/* your status */}
          <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">Your status</div>
            {myScore ? (
              <>
                <div className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-extrabold" style={{ color: scoreColor(myScore.relativeToPar) }}>{fmt(myScore.relativeToPar)}</div>
                <div className="text-sm text-[#8a968d]">your best{myScore.holesPlayed ? ` · ${myScore.holesPlayed} holes` : ""}</div>
              </>
            ) : (
              <p className="mt-1 text-sm text-[#46554c]">{user ? "You haven't logged a round here yet." : "Sign in to track your scores & climb the leaderboard."}</p>
            )}
            <Link href="/login" className="mt-3 block rounded-full bg-[#16221b] px-5 py-2.5 text-center text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a]">{myScore ? "Log another round" : "Play & track on Radius"}</Link>
          </div>

          {/* quick records */}
          <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">Course stats</div>
            <dl className="space-y-2.5 text-sm">
              <Row k="Players" v={players || "—"} />
              {course.communityScoreCount != null && <Row k="Rounds logged" v={course.communityScoreCount} />}
              {course.communityAverage != null && <Row k="Community avg" v={fmt(Math.round(course.communityAverage))} c={scoreColor(Math.round(course.communityAverage))} />}
              <Row k="Par mix" v={`${par3} · ${par4} · ${par5}`} />
              {longest && <Row k="Longest hole" v={`${longest.distance} ft`} />}
              {shortest && <Row k="Shortest hole" v={`${shortest.distance} ft`} />}
              {avgHole > 0 && <Row k="Avg hole" v={`${avgHole} ft`} />}
            </dl>
          </div>

          {/* score distribution */}
          {players > 0 && (
            <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">Score distribution</div>
              <div className="space-y-1.5">
                {distBuckets.map((b) => (
                  <div key={b.l} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-right text-[#46554c]">{b.l}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-black/[0.05]"><div className="h-full rounded bg-[var(--gold)]" style={{ width: `${(b.n / maxBucket) * 100}%` }} /></div>
                    <span className="w-5 shrink-0 font-semibold text-[#46554c]">{b.n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* directions */}
          {hasGeo && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${course.latitude},${course.longitude}`} target="_blank" rel="noopener" className="flex items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white p-4 shadow-sm transition-colors hover:border-[var(--gold)]">
              <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#16221b] text-[var(--gold)]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg></span><div><div className="text-sm font-bold text-[#16221b]">Get directions</div><div className="text-xs text-[#8a968d]">{course.city}{course.state ? `, ${course.state}` : ""}</div></div></div>
              <svg className="h-4 w-4 shrink-0 text-[#9a7a3a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </a>
          )}
        </aside>
      </div>

    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none text-white">{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[rgba(245,237,225,0.7)]">{label}</div></div>;
}
function Row({ k, v, c }: { k: string; v: string | number; c?: string }) {
  return <div className="flex items-center justify-between"><dt className="text-[#8a968d]">{k}</dt><dd className="font-bold" style={c ? { color: c } : undefined}>{v}</dd></div>;
}
