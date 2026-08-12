"use client";

import { useEffect, useMemo, useState } from "react";
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
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
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

function EvidenceTile({ label, value, unit, sub, accent = "var(--gold)" }: { label: string; value: string; unit?: string; sub?: string; accent?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-4">
      <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${accent}66, transparent)` }} />
      <div className={eyebrow} style={{ color: accent }}>{label}</div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span className={`${HEAD} text-[30px] font-black leading-none text-[var(--cream)]`} style={MONO}>{value}</span>
        {unit && <span className="text-xs text-[var(--sage-dim)]" style={MONO}>{unit}</span>}
      </div>
      {sub && <div className="mt-2 text-[11px] text-[var(--sage-dim)]">{sub}</div>}
    </div>
  );
}

// Arccos-style diverging strokes-gained bar: green = gaining vs the field, red (left) = losing.
function SGBar({ sg, maxAbs }: { sg: number; maxAbs: number }) {
  const frac = maxAbs > 0 ? Math.max(-1, Math.min(1, sg / maxAbs)) : 0;
  const neg = frac < 0;
  const w = Math.abs(frac) * 50;
  return (
    <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/20" />
      <span className="absolute top-0 h-full rounded-full" style={{ left: neg ? `${50 - w}%` : "50%", width: `${w}%`, background: neg ? "#e0733f" : "#5fcf80" }} />
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

  // Biggest leak — the weakest of a few benchmarked skills (career %). Honest: skips missing data.
  const leak = useMemo(() => {
    if (!career) return null;
    type Cand = { label: string; value: number; benchmark: number; note: (v: number) => string };
    const raw: { label: string; value: number | null; benchmark: number; note: (v: number) => string }[] = [
      { label: "Putting", value: career.c1.pct, benchmark: 0.7, note: (v: number) => `${Math.round(v * 100)}% on C1 putts (≤33 ft)` },
      { label: "Off the tee", value: career.fairwayPct, benchmark: 0.6, note: (v: number) => `${Math.round(v * 100)}% of tees in play` },
      { label: "Staying in bounds", value: career.obRate == null ? null : 1 - career.obRate, benchmark: 0.92, note: (v: number) => `${Math.round((1 - v) * 100)}% OB rate` },
    ];
    const cands = raw.filter((c): c is Cand => c.value != null);
    if (!cands.length) return null;
    return cands.map((c) => ({ ...c, gap: c.benchmark - c.value })).sort((a, b) => b.gap - a.gap)[0];
  }, [career]);

  // "Where the strokes go" — iOS strokes-gained ranking: four categories, biggest leak (lowest sg)
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
  const sgMaxAbs = eligibleLeaks.length ? Math.max(...eligibleLeaks.map((c) => Math.abs(c.sg)), 0.01) : 0.01;
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
            {/* coaching insight — accent card */}
            <div className="relative overflow-hidden rounded-[22px] border border-[var(--gold)]/20 p-5 sm:p-6" style={{ background: "linear-gradient(115deg, rgba(246,193,101,0.12), rgba(255,255,255,0.015) 46%)" }}>
              <div className={`${eyebrow} flex items-center gap-1.5 text-[var(--gold)]`}><span>⚡</span> Personal coaching insight</div>
              {leak ? (
                <p className="mt-2.5 text-[16px] leading-relaxed text-[var(--cream)]"><span className="font-bold">{leak.label}</span> is where you&apos;re losing the most — {leak.note(leak.value)}. Closing that gap is the fastest path to your next rank.</p>
              ) : (
                <p className="mt-2.5 text-[15px] text-[var(--text-body)]">Log a few shot-tracked rounds and your coaching insight builds itself.</p>
              )}
            </div>

            {/* evidence grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <EvidenceTile label="C1 Putting" value={pct(career!.c1.pct)} sub={career!.c1.att ? `${career!.c1.made}/${career!.c1.att} makes` : "No data yet"} accent="#5fcf80" />
              <EvidenceTile label="Fairway Hit" value={pct(career!.fairwayPct)} sub="tees in play" accent="#5fcf80" />
              <EvidenceTile label="Avg Drive" value={career!.avgDriveFt ? `${Math.round(career!.avgDriveFt)}` : "—"} unit={career!.avgDriveFt ? "ft" : undefined} sub="off the tee" accent="var(--gold)" />
              <EvidenceTile label="Miss Pattern" value={career!.missLeft + career!.missRight === 0 ? "—" : career!.missLeft >= career!.missRight ? "Left" : "Right"} sub={career!.missLeft + career!.missRight ? `${career!.missLeft}L · ${career!.missRight}R` : "No data yet"} accent="#e0873f" />
            </div>

            {/* where the strokes go — Arccos-style diverging SG bars */}
            {showLeaks && (
              <div className={card}>
                <div className={eyebrow}>Where the strokes go</div>
                <p className="mt-1 text-[12px] text-[var(--sage-dim)]">Ranked from your biggest leak down — the order is the point.</p>
                <div className="mt-4 space-y-1.5">
                  {leaks.map((c, i) => {
                    const worst = i === 0 && c.eligible;
                    return (
                      <div key={c.id} className={`rounded-2xl p-3.5 transition-colors ${worst ? "bg-[#e0733f]/[0.07] ring-1 ring-[#e0733f]/25" : c.eligible ? "bg-white/[0.02]" : "opacity-45"}`}>
                        <div className="flex items-center gap-3.5">
                          <span className={`${HEAD} w-5 shrink-0 text-center text-[16px] font-black`} style={{ ...MONO, color: worst ? "#eb9166" : "rgba(255,255,255,0.3)" }}>{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-bold text-[var(--cream)]">{c.name}</span>
                              {worst && <span className="rounded-full bg-[#e0733f]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#eb9166]">Biggest leak</span>}
                            </div>
                            <div className="mt-0.5 truncate text-[11.5px] text-[var(--sage-dim)]">{c.eligible ? c.evidence : c.progress}</div>
                            {c.eligible && <SGBar sg={c.sg} maxAbs={sgMaxAbs} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4 text-[10px] text-[var(--sage-dim)]">
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-[#e0733f]" /> losing strokes</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-[#5fcf80]" /> gaining strokes</span>
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
