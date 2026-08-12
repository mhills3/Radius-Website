"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getDashboard, type Dashboard } from "@/lib/account";
import { getDecodedRounds, computeCareerStats, computeStrokesGained, rankedCategories, type DecodedRound, type CareerStats } from "@/lib/rounds";
import { getAllCourses, type Course } from "@/lib/courses";
import { getPutterDiscNames } from "@/lib/bag";
import { rankForIQ, rankLabel, rankProgress } from "@/lib/rank";
import { usePro } from "@/lib/usePro";
import ProGate from "@/components/ProGate";
import DualRing from "@/components/mygame/DualRing";
import Scorecard from "@/components/dashboard/Scorecard";
import RoundPreviewCard from "@/components/scorecard/RoundPreviewCard";

const fmtToParAvg = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}`);
const scoreColor = (n: number | null) => (n == null ? "var(--cream)" : n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");

const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const eyebrow = `${HEAD} text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sage-dim)]`;
const card = "rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6";

// Gradient-filled area chart for the Game IQ trajectory (Whoop-style trend).
function AreaChart({ points, color = "var(--gold)", h = 72 }: { points: number[]; color?: string; h?: number }) {
  if (points.length < 2) return null;
  const w = 320, min = Math.min(...points), max = Math.max(...points), span = max - min || 1, padY = 8;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (p: number) => h - padY - ((p - min) / span) * (h - 2 * padY);
  const line = points.map((p, i) => `${x(i)},${y(p)}`).join(" ");
  const area = `M0,${y(points[0])} ${points.map((p, i) => `L${x(i)},${y(p)}`).join(" ")} L${w},${h} L0,${h} Z`;
  const gid = "iqfill";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={w} cy={y(points[points.length - 1])} r="3.4" fill={color} />
    </svg>
  );
}

// --- iconography (matches the iOS stat cards / strokes-go list) ---
const IcTarget = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></svg>;
const IcFlag = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 21V4M6 4h11l-2 3.5L17 11H6" /></svg>;
const IcArrow = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7 17L17 7M9 7h8v8" /></svg>;
const IcCrosshair = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" /><circle cx="12" cy="12" r="2.6" /></svg>;
const IcGreen = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}><path d="M4 15c4-6 12-6 16 0" /><circle cx="12" cy="16.5" r="1.3" fill="currentColor" stroke="none" /></svg>;
const IcChevron = ({ className }: { className?: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 6l6 6-6 6" /></svg>;
function catIcon(id: string, className: string) {
  if (id === "tee") return <IcFlag className={className} />;
  if (id === "approach") return <IcArrow className={className} />;
  if (id === "short") return <IcGreen className={className} />;
  return <IcTarget className={className} />;
}

// --- mini visualizations inside the stat cards ---
function MiniLine({ points, color = "var(--gold)" }: { points: number[]; color?: string }) {
  const w = 120, h = 26;
  if (points.length < 2) return <div style={{ height: h }} />;
  const min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const y = (p: number) => h - 3 - ((p - min) / span) * (h - 6);
  const pts = points.map((p, i) => `${(i / (points.length - 1)) * w},${y(p)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="block overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx="0" cy={y(points[0])} r="2.4" fill={color} /><circle cx={w} cy={y(points[points.length - 1])} r="2.4" fill={color} />
    </svg>
  );
}
function ProgBar({ frac, color = "var(--gold)" }: { frac: number; color?: string }) {
  return <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%`, background: color }} /></div>;
}
function RangeBar({ min, max, avg }: { min: number; max: number; avg: number }) {
  const lo = 140, hi = Math.max(420, max + 20), span = hi - lo || 1;
  const x = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
  return (
    <div className="relative h-1.5 rounded-full bg-white/[0.08]">
      <span className="absolute top-0 h-full rounded-full bg-[var(--gold)]/70" style={{ left: `${x(min)}%`, width: `${Math.max(2, x(max) - x(min))}%` }} />
      <span className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded bg-[var(--cream)]" style={{ left: `${x(avg)}%` }} />
    </div>
  );
}

// Miss-pattern L/R split bar (dominant side gold).
function LRBar({ left, right }: { left: number; right: number }) {
  const t = left + right || 1, l = (left / t) * 50, r = (right / t) * 50;
  const lc = left >= right ? "var(--gold)" : "rgba(255,255,255,0.25)", rc = right > left ? "var(--gold)" : "rgba(255,255,255,0.25)";
  return (
    <div className="relative h-1.5 rounded-full bg-white/[0.08]">
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/20" />
      <span className="absolute top-0 h-full rounded-l-full" style={{ left: `${50 - l}%`, width: `${l}%`, background: lc }} />
      <span className="absolute top-0 h-full rounded-r-full" style={{ left: "50%", width: `${r}%`, background: rc }} />
    </div>
  );
}

// One iOS-style stat card: icon + label, big value + unit, a mini-viz, then a caption.
function StatCard({ icon, label, accent = "var(--gold)", value, unit, viz, sub, locked, lockedText }: { icon: ReactNode; label: string; accent?: string; value?: string; unit?: string; viz?: ReactNode; sub?: string; locked?: boolean; lockedText?: string }) {
  const dim = locked ? "var(--sage-dim)" : accent;
  return (
    <div className={`flex flex-col rounded-[20px] p-4 ${locked ? "border border-dashed border-white/15 bg-white/[0.01]" : "border border-white/[0.07] bg-white/[0.03]"}`}>
      <div className="flex items-center gap-2" style={{ color: dim }}>
        <span className="[&>svg]:h-[15px] [&>svg]:w-[15px]">{icon}</span>
        <span className={eyebrow} style={{ color: dim }}>{label}</span>
      </div>
      {locked ? (
        <div className={`${HEAD} mt-2.5 text-[19px] font-bold leading-tight text-[var(--cream)]`}>{lockedText}</div>
      ) : (
        <div className="mt-2.5 flex items-baseline gap-1">
          <span className={`${HEAD} text-[32px] font-black leading-none text-[var(--cream)]`}>{value}</span>
          {unit && <span className="text-[13px] font-bold text-[var(--sage-dim)]">{unit}</span>}
        </div>
      )}
      {viz && <div className="mt-3.5">{viz}</div>}
      {sub && <div className="mt-2.5 text-[12px] text-[var(--sage-dim)]" style={MONO}>{sub}</div>}
    </div>
  );
}

export default function MyGameOverview({ uid }: { uid: string }) {
  const pro = usePro();
  const [dash, setDash] = useState<Dashboard | null | undefined>(undefined);
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState<DecodedRound | null>(null);
  const [putterNames, setPutterNames] = useState<Set<string>>(new Set());
  const coverOf = useMemo(() => { const m = new Map<string, string>(); courses.forEach((c) => { const k = c.name.trim().toLowerCase(); if (c.coverPhotoUrl && !m.has(k)) m.set(k, c.coverPhotoUrl); }); return m; }, [courses]);

  useEffect(() => {
    let alive = true;
    getDashboard(uid).then((d) => alive && setDash(d)).catch(() => alive && setDash(null));
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getAllCourses().then((c) => alive && setCourses(c)).catch(() => {});
    getPutterDiscNames().then((s) => alive && setPutterNames(s)).catch(() => {});
    return () => { alive = false; };
  }, [uid]);

  const career: CareerStats | null = useMemo(() => (rounds ? computeCareerStats(rounds, putterNames) : null), [rounds, putterNames]);
  const iq = dash?.iqCurrent ?? 0;
  const rank = rankForIQ(iq);
  const nextRank = rank.nextIQ != null ? rankForIQ(rank.nextIQ) : null;
  const iqSeries = (dash?.iqHistory ?? []).map((p) => p.iq);
  const recent = useMemo(() => (rounds ? [...rounds].filter((r) => r.isComplete).sort((a, b) => b.date - a.date).slice(0, 8) : []), [rounds]);

  // "Where your strokes go" — iOS strokes-gained ranking: four categories, biggest leak (lowest sg)
  // first among the eligible ones. Shown only once >= 2 categories have enough measured shots.
  const sg = useMemo(() => (rounds ? computeStrokesGained(rounds, putterNames) : null), [rounds, putterNames]);
  const leaks = useMemo(() => (sg ? rankedCategories(sg) : []), [sg]);
  const showLeaks = sg != null && sg.sgRounds > 0 && leaks.filter((c) => c.eligible).length >= 2;

  if (dash === undefined || rounds === null) {
    return <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }
  if (!dash) {
    return <div className="flex min-h-[40vh] flex-col items-center justify-center text-center text-[var(--cream)]"><h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold">No stats yet</h2><p className="mt-2 max-w-md text-[var(--text-body)]">Play a round in the Radius app and your Game IQ, scoring mix and trends show up here.</p></div>;
  }

  const hasRounds = career != null && career.rounds > 0;
  const mix = career ? { birdie: career.birdies, par: career.pars, bogey: career.bogeys + career.doublePlus } : { birdie: 0, par: 0, bogey: 0 };
  const progress = rankProgress(iq, rank);
  const eligibleLeaks = leaks.filter((c) => c.eligible);
  const insightLeak = eligibleLeaks[0];
  const iqDelta = iqSeries.length >= 2 ? iqSeries[iqSeries.length - 1] - iqSeries[0] : 0;
  const avgColor = scoreColor(career?.avgToPar ?? null);

  return (
    <div className="space-y-6">
      {/* ===== HERO — identity + ring ===== */}
      <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] p-6 sm:p-8" style={{ background: "radial-gradient(130% 130% at 12% 0%, rgba(246,193,101,0.10), transparent 46%), linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.012))" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-lg font-bold text-[var(--cream)] ring-2" style={{ boxShadow: `0 0 0 2px ${rank.color}66` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {dash.profile.profileImageUrl ? <img src={dash.profile.profileImageUrl} alt="" className="h-full w-full object-cover" /> : (dash.profile.name || "?").charAt(0).toUpperCase()}
            </span>
            <div>
              <div className={`${HEAD} text-xl font-extrabold text-[var(--cream)]`}>{dash.profile.name || "Player"}</div>
              <div className="mt-0.5 text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: rank.color }}>Game IQ {iq} <span className="text-[var(--sage-dim)]">· {rankLabel(rank)}</span></div>
            </div>
          </div>
          <div className="text-right">
            <div className={eyebrow}>Avg to par</div>
            <div className={`${HEAD} text-3xl font-black leading-none`} style={{ ...MONO, color: avgColor }}>{fmtToParAvg(career?.avgToPar ?? null)}</div>
          </div>
        </div>

        <div className="mt-7 flex flex-col items-center gap-7 sm:flex-row sm:gap-10">
          <div className="relative shrink-0">
            <div className="pointer-events-none absolute inset-3 rounded-full blur-2xl" style={{ background: rank.color, opacity: 0.22 }} />
            <div className="relative"><DualRing rankProgress={progress} tierColor={rank.color} mix={mix} centerTop="AVG TO PAR" centerBig={fmtToParAvg(career?.avgToPar ?? null)} centerSub={hasRounds ? `${career!.rounds} rounds` : undefined} /></div>
          </div>
          <div className="min-w-0 flex-1 self-stretch sm:py-1">
            <div className={eyebrow}>{rank.tier.toUpperCase()}{nextRank ? ` → ${nextRank.tier.toUpperCase()}` : " · TOP TIER"}</div>
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className={`${HEAD} text-5xl font-black leading-none text-[var(--cream)]`} style={MONO}>{iq}</span>
              <span className="rounded-full bg-[#5fb87a]/15 px-2.5 py-1 text-[11px] font-bold text-[#5fb87a]">Game IQ</span>
            </div>
            {nextRank && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, progress * 100)}%`, background: `linear-gradient(to right, ${rank.color}, ${nextRank.color})` }} /></div>
                <div className="mt-2 text-[12.5px] text-[var(--text-body)]">{Math.round(progress * 100)}% to <span className="font-semibold" style={{ color: nextRank.color }}>{nextRank.tier}</span> · <span style={MONO}>{Math.max(0, (rank.nextIQ ?? iq) - iq)}</span> IQ to go</div>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-[var(--sage)]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#33c773]" /> Birdie <b className="text-[var(--cream)]" style={MONO}>{mix.birdie}</b></span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--gold)]" /> Par <b className="text-[var(--cream)]" style={MONO}>{mix.par}</b></span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e0873f]" /> Bogey+ <b className="text-[var(--cream)]" style={MONO}>{mix.bogey}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Coaching + evidence + strokes (Pro) ===== */}
      {hasRounds && (
        <ProGate pro={pro} title="Unlock your evidence" blurb="See your putting, driving and miss patterns from every logged round with Radius Pro.">
          <div className="space-y-4">
            {/* coaching insight — accent card (uses the strokes-gained biggest leak) */}
            <div className="relative overflow-hidden rounded-[22px] border border-[var(--gold)]/20 p-5 sm:p-6" style={{ background: "linear-gradient(115deg, rgba(246,193,101,0.12), rgba(255,255,255,0.015) 46%)" }}>
              <div className={`${eyebrow} flex items-center gap-1.5 text-[var(--gold)]`}><span>⚡</span> Personal coaching insight</div>
              {insightLeak ? (
                <p className="mt-2.5 text-[16px] leading-relaxed text-[var(--cream)]"><span className="font-bold">{insightLeak.name}</span> is where you&apos;re losing the most — {insightLeak.evidence}. Closing that gap is the fastest path to your next rank.</p>
              ) : (
                <p className="mt-2.5 text-[15px] text-[var(--text-body)]">Log a few shot-tracked rounds and your coaching insight builds itself.</p>
              )}
            </div>

            {/* stat cards — 1:1 with the iOS Overview cards (icon + value + mini-viz + caption) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard icon={<IcTarget />} label="C1X Putting"
                value={career!.c1.att ? `${Math.round((career!.c1.pct ?? 0) * 100)}` : "—"} unit={career!.c1.att ? "%" : undefined}
                viz={sg && sg.c1xTrend.length >= 2 ? <MiniLine points={sg.c1xTrend} /> : undefined}
                sub={career!.c1.att ? `${career!.c1.made} of ${career!.c1.att}` : "No data yet"} />
              <StatCard icon={<IcFlag />} label="Fairway Hit"
                value={sg && sg.teeAttempts ? `${sg.teeFairwayPct}` : "—"} unit={sg && sg.teeAttempts ? "%" : undefined}
                viz={sg && sg.teeAttempts ? <ProgBar frac={sg.teeFairwayPct / 100} /> : undefined}
                sub={sg && sg.teeAttempts ? `${sg.teeObPct}% OB · ${sg.teeAttempts} tees` : "No data yet"} />
              <StatCard icon={<IcArrow />} label="Avg Drive"
                value={sg && sg.driveCount ? `${sg.driveAvg}` : "—"} unit={sg && sg.driveCount ? "ft" : undefined}
                viz={sg && sg.driveCount >= 2 ? <RangeBar min={sg.driveMin} max={sg.driveMax} avg={sg.driveAvg} /> : undefined}
                sub={sg && sg.driveCount >= 2 ? `${sg.driveMin} – ${sg.driveMax} ft range` : sg && sg.driveCount ? `${sg.driveCount} drive${sg.driveCount === 1 ? "" : "s"}` : "No data yet"} />
              {sg && sg.driveCount >= 8 ? (
                <StatCard icon={<IcCrosshair />} label="Miss Pattern"
                  value={career!.missLeft === career!.missRight ? "Even" : career!.missLeft > career!.missRight ? "Left" : "Right"}
                  viz={<LRBar left={career!.missLeft} right={career!.missRight} />}
                  sub={`${career!.missLeft}L · ${career!.missRight}R`} />
              ) : (
                <StatCard icon={<IcCrosshair />} label="Miss Pattern" locked lockedText="Unlocks after 8 measured drives"
                  viz={<ProgBar frac={(sg?.driveCount ?? 0) / 8} />} sub={`${sg?.driveCount ?? 0} of 8`} />
              )}
            </div>

            {/* where your strokes go — iOS icon-square list */}
            {showLeaks && (
              <div className={card}>
                <div className={eyebrow}>Where your strokes go</div>
                <div className="mt-4">
                  {leaks.map((c, i) => {
                    const worst = i === 0 && c.eligible;
                    return (
                      <div key={c.id}>
                        {i > 0 && <div className="ml-[62px] h-px bg-white/[0.06]" />}
                        <div className={`flex items-center gap-3.5 py-3 ${c.eligible ? "" : "opacity-50"}`}>
                          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl [&>svg]:h-[22px] [&>svg]:w-[22px] ${worst ? "bg-[var(--gold)]/15 text-[var(--gold)] ring-1 ring-[var(--gold)]/35" : c.eligible ? "border border-white/10 text-[var(--cream)]/80" : "border border-white/[0.07] text-white/25"}`}>{catIcon(c.id, "")}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                              <span className={`${HEAD} text-[18px] font-bold ${c.eligible ? "text-[var(--cream)]" : "text-white/45"}`}>{c.name}</span>
                              {worst && <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--gold)]">Biggest leak</span>}
                            </div>
                            <div className="mt-0.5 truncate text-[12.5px] text-[var(--sage-dim)]" style={MONO}>{c.eligible ? c.evidence : c.progress}</div>
                          </div>
                          <IcChevron className="h-4 w-4 shrink-0 text-white/25" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ProGate>
      )}

      {/* ===== Trajectory ===== */}
      {iqSeries.length >= 2 && (
        <div className={card}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={eyebrow}>Your trajectory</div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span className={`${HEAD} text-3xl font-black leading-none text-[var(--cream)]`} style={MONO}>{iqSeries[iqSeries.length - 1]}</span>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: iqDelta >= 0 ? "rgba(95,207,128,0.15)" : "rgba(224,115,63,0.15)", color: iqDelta >= 0 ? "#5fcf80" : "#eb9166" }}>{iqDelta >= 0 ? "+" : ""}{iqDelta} IQ</span>
              </div>
              <div className="mt-1 text-[12.5px] text-[var(--sage-dim)]">Game IQ over your last {iqSeries.length} updates</div>
            </div>
          </div>
          <div className="mt-4"><AreaChart points={iqSeries} color={rank.color} /></div>
        </div>
      )}

      {/* ===== Recent rounds ===== */}
      <div>
        <div className={`${eyebrow} mb-3`}>Recent rounds</div>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--sage-dim)]">No rounds yet — play one in the Radius app and it&apos;ll appear here.</p>
        ) : (
          <div className="space-y-4">
            {recent.map((r) => (
              <RoundPreviewCard key={r.roundId} round={r} cover={coverOf.get(r.courseName.trim().toLowerCase())} onClick={() => setOpen(r)} />
            ))}
          </div>
        )}
      </div>

      {open && <Scorecard round={open} rounds={rounds ?? undefined} onClose={() => setOpen(null)} />}
    </div>
  );
}
