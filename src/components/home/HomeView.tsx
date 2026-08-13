"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getDecodedRounds, computeStrokesGained, rankedCategories, computeRoundStats, type DecodedRound, type RoundStats } from "@/lib/rounds";
import { getDashboard, type Dashboard } from "@/lib/account";
import { getAllCourses, slugify, type Course } from "@/lib/courses";
import { getFeed, type FeedPost } from "@/lib/feed";
import { getPutterDiscNames } from "@/lib/bag";
import { flightMapImageUrl } from "@/lib/flightMap";
import Scorecard from "@/components/dashboard/Scorecard";

const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const card = "rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5";
const label = `${HEAD} text-[13px] font-bold text-[var(--cream)]`;
const eyebrow = `${HEAD} text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]`;
const GREEN = "#33c773", GOLD = "#E8B560", RED = "#e0603f";
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtRel = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const relColor = (n: number) => (n < 0 ? GREEN : n > 0 ? "#e0873f" : "var(--cream)");
function miBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180, la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
const timeAgo = (ms: number) => { const d = Math.floor((Date.now() - ms) / 86400000); return d <= 0 ? "today" : d === 1 ? "1d" : d < 7 ? `${d}d` : new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

// ---- performance pillar ring ----
function pillarStatus(kind: "putting" | "driving" | "fairway" | "scramble", v: number): { color: string; caption: string } {
  const good = { color: GREEN, caption: "Green/Good" }, warn = { color: GOLD, caption: "Gold/Warning" }, focus = { color: RED, caption: "Red/Focus" };
  if (kind === "putting") return v >= 80 ? good : v >= 65 ? warn : focus;
  if (kind === "driving") return v >= 270 ? good : v >= 220 ? warn : focus;
  if (kind === "fairway") return v >= 70 ? good : v >= 55 ? warn : focus;
  return v >= 55 ? good : v >= 48 ? warn : focus;
}
function Ring({ label: lbl, value, frac, color, caption }: { label: string; value: string; frac: number; color: string; caption: string }) {
  const size = 88, sw = 8, r = size / 2 - sw / 2 - 1, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, frac));
  return (
    <div className="flex flex-col items-center">
      <div className={`${eyebrow} mb-2.5`}>{lbl}</div>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`translate(${size / 2} ${size / 2}) rotate(-90)`}>
            <circle r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
            <circle r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${p * C} ${C}`} />
          </g>
        </svg>
        <span className={`${HEAD} absolute inset-0 grid place-items-center text-[19px] font-black text-[var(--cream)]`} style={MONO}>{value}</span>
      </div>
      <div className="mt-2.5 text-[10.5px]" style={{ color }}>{caption}</div>
    </div>
  );
}

function VolRow({ name, value, frac }: { name: string; value: string; frac: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-[var(--sage)]">{name}</span>
        <span className={`${HEAD} text-[14px] font-bold text-[var(--cream)]`} style={MONO}>{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(1, frac) * 100)}%`, background: GREEN }} /></div>
    </div>
  );
}

// ---- recent round card ----
function DashRoundCard({ round, cover, featured, onClick, putterNames }: { round: DecodedRound; cover?: string; featured?: boolean; onClick: () => void; putterNames: Set<string> }) {
  const s: RoundStats = useMemo(() => computeRoundStats(round, putterNames), [round, putterNames]);
  const rel = round.relativeToPar;
  const flight = flightMapImageUrl(round, 760, 300);
  const stat = (v: string, l: string, color?: string) => (
    <div className="text-center"><div className={`${HEAD} text-[18px] font-black`} style={{ ...MONO, color: color ?? "var(--cream)" }}>{v}</div><div className="mt-0.5 text-[10px] text-[var(--sage-dim)]">{l}</div></div>
  );
  return (
    <button onClick={onClick} className="group block w-full overflow-hidden rounded-xl border border-white/[0.06] bg-[#12171410] text-left transition-colors hover:border-white/[0.12]">
      <div className="px-4 pt-3.5">
        <span className={`${HEAD} text-[15px] font-bold text-[var(--cream)]`}>{round.courseName}</span>
        <span className="ml-1.5 text-[12px] text-[var(--sage-dim)]" style={MONO}>{fmtDate(round.date)} · {round.holesPlayed} holes</span>
      </div>
      <div className={`relative mt-2.5 w-full overflow-hidden ${featured ? "h-[150px]" : "h-[110px]"} bg-[radial-gradient(circle_at_35%_30%,#2E4034,#16211B)]`}>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(15,23,18,0.7) 0%, transparent 45%)" }} />
        <span className={`${HEAD} absolute bottom-3 left-4 text-[34px] font-black leading-none drop-shadow`} style={{ ...MONO, color: relColor(rel) }}>{fmtRel(rel)}</span>
        <span className={`${HEAD} absolute bottom-3 right-4 text-[30px] font-black leading-none text-white drop-shadow`} style={MONO}>{round.total}</span>
      </div>
      {featured && flight && (
        <div className="relative h-[150px] w-full overflow-hidden border-t border-white/[0.05]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flight} alt="" loading="lazy" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="grid grid-cols-4 gap-2 px-4 py-3.5">
        {stat(fmtRel(rel), "Score", relColor(rel))}
        {stat(`${s.birdies}`, "Birdies")}
        {stat(s.fairwayPct == null ? "—" : `${Math.round(s.fairwayPct * 100)}%`, "Fairways")}
        {stat(s.c2Pct == null ? "—" : `${Math.round(s.c2Pct * 100)}%`, "C2 Putts")}
      </div>
    </button>
  );
}

export default function HomeView({ uid }: { uid: string }) {
  const { profile } = useAuth();
  const [dash, setDash] = useState<Dashboard | null | undefined>(undefined);
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [putterNames, setPutterNames] = useState<Set<string>>(new Set());
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [open, setOpen] = useState<DecodedRound | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => alive && setNow(Date.now()), 0);
    getDashboard(uid).then((d) => alive && setDash(d)).catch(() => alive && setDash(null));
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getAllCourses().then((c) => alive && setCourses(c)).catch(() => {});
    getFeed(12).then((f) => alive && setFeed(f)).catch(() => {});
    getPutterDiscNames().then((s) => alive && setPutterNames(s)).catch(() => {});
    if (typeof navigator !== "undefined" && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => alive && setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 });
    return () => { alive = false; clearTimeout(t); };
  }, [uid]);

  const complete = useMemo(() => (rounds ? [...rounds].filter((r) => r.isComplete).sort((a, b) => b.date - a.date) : []), [rounds]);
  const sg = useMemo(() => (rounds ? computeStrokesGained(rounds, putterNames) : null), [rounds, putterNames]);
  const byName = useMemo(() => { const m = new Map<string, Course>(); courses.forEach((c) => { const k = c.name.trim().toLowerCase(); if (!m.has(k)) m.set(k, c); }); return m; }, [courses]);
  const coverOf = (name: string) => byName.get(name.trim().toLowerCase())?.coverPhotoUrl;
  const firstName = (profile?.name || dash?.profile.name || "Player").split(" ")[0];

  const iq = dash?.iqCurrent ?? 0;
  const iqDelta = useMemo(() => {
    const h = dash?.iqHistory ?? []; if (h.length < 2 || !now) return 0;
    const cutoff = now - 30 * 86400000;
    const past = [...h].reverse().find((p) => p.t <= cutoff) ?? h[0];
    return iq - past.iq;
  }, [dash, iq, now]);

  const focus = useMemo(() => {
    if (!sg) return null;
    const leak = rankedCategories(sg).filter((c) => c.eligible)[0];
    if (!leak) return null;
    const val = leak.id === "putting" ? sg.sgPutting : leak.id === "tee" ? sg.sgDriving : leak.id === "approach" ? sg.sgApproach : sg.sgShort;
    return { name: leak.name, val };
  }, [sg]);

  const weekly = useMemo(() => {
    if (!now) return { rounds: 0, holes: 0, throws: 0, birdies: 0 };
    const cutoff = now - 6 * 86400000;
    const wk = complete.filter((r) => r.date >= cutoff);
    let holes = 0, throws = 0, birdies = 0;
    for (const r of wk) { holes += r.holesPlayed; throws += r.total; for (const h of r.holes) if (h.played && h.score - h.par < 0) birdies++; }
    return { rounds: wk.length, holes, throws, birdies };
  }, [complete, now]);

  const nearCourses = useMemo(() => {
    if (!loc) return [...courses].filter((c) => (c.reviewCount ?? 0) > 0).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3).map((c) => ({ c, mi: null as number | null }));
    return courses.map((c) => (c.latitude != null && c.longitude != null ? { c, mi: miBetween(loc, { lat: c.latitude, lng: c.longitude }) } : null)).filter((x): x is { c: Course; mi: number } => !!x && x.mi >= 0.1).sort((a, b) => a.mi - b.mi).slice(0, 3);
  }, [courses, loc]);
  const scene = useMemo(() => feed.slice(0, 3), [feed]);

  if (dash === undefined || rounds === null) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)] text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }

  const pillars = sg ? [
    { kind: "putting" as const, lbl: "PUTTING", value: `${sg.c1xPct}%`, frac: sg.c1xPct / 100, val: sg.c1xPct },
    { kind: "driving" as const, lbl: "DRIVING DIST", value: `${sg.driveAvg} ft`, frac: sg.driveAvg / 400, val: sg.driveAvg },
    { kind: "fairway" as const, lbl: "FAIRWAY HIT %", value: `${sg.teeFairwayPct}%`, frac: sg.teeFairwayPct / 100, val: sg.teeFairwayPct },
    { kind: "scramble" as const, lbl: "SCRAMBLING %", value: `${sg.scramblePct}%`, frac: sg.scramblePct / 100, val: sg.scramblePct },
  ] : [];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        <div className="mb-5 text-[13px] text-[var(--sage)]">{greeting()}, <span className="font-semibold text-[var(--cream)]">{firstName}</span></div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ===== MAIN ===== */}
          <div className="space-y-5">
            {/* top row: rating + pillars */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              {/* radius rating */}
              <div className={card}>
                <div className={eyebrow}>Radius Rating</div>
                <div className="mt-3 flex items-end gap-2.5">
                  <span className={`${HEAD} text-[52px] font-black leading-[0.85]`} style={MONO}>{iq}</span>
                  {iqDelta !== 0 && <span className="mb-1.5 inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: iqDelta > 0 ? GREEN : RED }}><span>{iqDelta > 0 ? "▲" : "▼"}</span>{iqDelta > 0 ? "+" : ""}{iqDelta} this month</span>}
                </div>
                <div className="mt-1 text-[11px] text-[var(--sage-dim)]">Game IQ</div>
                <div className="my-4 h-px bg-white/[0.07]" />
                {focus ? (
                  <>
                    <div className={`${label} text-[15px]`}>Focus Area: {focus.name} <span className="font-normal text-[var(--sage)]">({focus.val > 0 ? "+" : ""}{focus.val.toFixed(1)} Strokes Gained)</span></div>
                    <Link href="/bag?tab=improve" className={`${HEAD} mt-3.5 block rounded-lg bg-[#F4F1E8] py-2.5 text-center text-[13.5px] font-bold text-[#141B16] transition-colors hover:bg-white`}>Open {focus.name} Insights</Link>
                  </>
                ) : (
                  <div className="text-[13px] text-[var(--sage-dim)]">Shot-track a few rounds and your focus area appears here.</div>
                )}
              </div>

              {/* performance pillars */}
              <div className={card}>
                <div className={label}>Performance Pillars</div>
                {pillars.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-y-0">
                    {pillars.map((p) => { const st = pillarStatus(p.kind, p.val); return <Ring key={p.kind} label={p.lbl} value={p.value} frac={p.frac} color={st.color} caption={st.caption} />; })}
                  </div>
                ) : <div className="mt-4 text-[13px] text-[var(--sage-dim)]">Play shot-tracked rounds to fill your pillars.</div>}
              </div>
            </div>

            {/* recent rounds */}
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <span className={label}>Recent Rounds</span>
                <Link href="/bag" className="text-[12px] text-[var(--sage)] hover:text-[var(--cream)]">View all</Link>
              </div>
              {complete.length === 0 ? (
                <p className="text-[13px] text-[var(--sage-dim)]">No rounds yet — play one in the Radius app.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {complete.slice(0, 7).map((r, i) => (
                    <div key={r.roundId} className={i === 0 ? "sm:row-span-2" : ""}>
                      <DashRoundCard round={r} cover={coverOf(r.courseName)} featured={i === 0} onClick={() => setOpen(r)} putterNames={putterNames} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ===== SIDEBAR ===== */}
          <div className="space-y-5">
            {/* weekly volume */}
            <div className={card}>
              <div className={`${label} mb-4`}>Weekly Volume</div>
              <div className="space-y-3.5">
                <VolRow name="Rounds" value={`${weekly.rounds}`} frac={weekly.rounds / 5} />
                <VolRow name="Holes" value={`${weekly.holes}`} frac={weekly.holes / 90} />
                <VolRow name="Throws" value={`${weekly.throws}`} frac={weekly.throws / 400} />
                <VolRow name="Birdies" value={`${weekly.birdies}`} frac={weekly.birdies / 25} />
              </div>
            </div>

            {/* nearby courses */}
            <div className={card}>
              <div className={`${label} mb-3.5`}>Nearby / Top-Rated Courses</div>
              <div className="space-y-3">
                {nearCourses.map(({ c, mi }) => (
                  <Link key={c.id} href={`/courses/${slugify(c.name, c.id)}`} className="flex items-center gap-3">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#22302A]">{c.coverPhotoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
                    )}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--cream)]">{c.name}</span>
                      <span className="mt-0.5 block truncate text-[10.5px] text-[var(--sage-dim)]" style={MONO}>{[c.city, mi != null ? `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi away` : null].filter(Boolean).join(" · ")}</span>
                    </span>
                    {c.rating != null && c.rating > 0 && <span className="shrink-0 rounded-md bg-[var(--gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--gold)]" style={MONO}>{c.rating.toFixed(1)}</span>}
                  </Link>
                ))}
                {nearCourses.length === 0 && <p className="text-[12px] text-[var(--sage-dim)]">No nearby courses found.</p>}
              </div>
              <Link href="/courses" className="mt-4 block text-[12px] font-semibold text-[var(--gold)]">See more Community →</Link>
            </div>

            {/* social stream */}
            {scene.length > 0 && (
              <div className={card}>
                <div className={`${label} mb-3.5`}>Social Stream</div>
                <div className="space-y-3.5">
                  {scene.map((p) => (
                    <Link key={p.id} href="/community" className="block">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#22302A] text-[12px] font-semibold text-[var(--sage)]">{p.authorPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.authorPhotoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (p.authorName || "?").charAt(0)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[var(--cream)]">{p.authorName}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-[var(--sage-dim)]">{p.text || p.linkedCourseName || "posted an update"}</span>
                        </span>
                        <span className="shrink-0 text-[10px] text-[var(--sage-dim)]" style={MONO}>{timeAgo(p.createdAt)}</span>
                      </div>
                      {p.imageUrl && (
                        <div className="mt-2 h-24 overflow-hidden rounded-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {open && <Scorecard round={open} rounds={complete} onClose={() => setOpen(null)} />}
    </div>
  );
}
