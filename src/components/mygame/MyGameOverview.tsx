"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboard, type Dashboard } from "@/lib/account";
import { getDecodedRounds, computeCareerStats, type DecodedRound, type CareerStats } from "@/lib/rounds";
import { rankForIQ, rankLabel, rankProgress } from "@/lib/rank";
import { usePro } from "@/lib/usePro";
import ProGate from "@/components/ProGate";
import DualRing from "@/components/mygame/DualRing";
import Scorecard from "@/components/dashboard/Scorecard";

const fmtToPar = (n: number | null | undefined) => (n == null ? "—" : n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const fmtToParAvg = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}`);
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const scoreColor = (n: number | null) => (n == null ? "var(--cream)" : n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");

const HEAD = "font-[family-name:var(--font-heading)]";
const eyebrow = `${HEAD} text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sage-dim)]`;
const card = "rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6";

function Sparkline({ points, color = "var(--gold)" }: { points: number[]; color?: string }) {
  if (points.length < 2) return null;
  const w = 120, h = 34, min = Math.min(...points), max = Math.max(...points), span = max - min || 1;
  const d = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / span) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible">
      <polyline points={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((points[points.length - 1] - min) / span) * h} r="2.6" fill={color} />
    </svg>
  );
}

function EvidenceTile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className={`${eyebrow} text-[var(--gold)]`}>{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`${HEAD} text-3xl font-black leading-none text-[var(--cream)]`}>{value}</span>
        {unit && <span className="text-xs text-[var(--sage-dim)]">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-[var(--sage-dim)]">{sub}</div>}
    </div>
  );
}

export default function MyGameOverview({ uid }: { uid: string }) {
  const pro = usePro();
  const [dash, setDash] = useState<Dashboard | null | undefined>(undefined);
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [open, setOpen] = useState<DecodedRound | null>(null);

  useEffect(() => {
    let alive = true;
    getDashboard(uid).then((d) => alive && setDash(d)).catch(() => alive && setDash(null));
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    return () => { alive = false; };
  }, [uid]);

  const career: CareerStats | null = useMemo(() => (rounds ? computeCareerStats(rounds) : null), [rounds]);
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

  // "Where your strokes go" — every benchmarked skill, ranked worst-first.
  const skills = useMemo(() => {
    if (!career) return [];
    const raw = [
      career.c1.pct != null ? { label: "Putting", value: career.c1.pct, benchmark: 0.7, sub: `${career.c1.made}/${career.c1.att} inside 33 ft` } : null,
      career.fairwayPct != null ? { label: "Off the tee", value: career.fairwayPct, benchmark: 0.6, sub: "tees in play" } : null,
      career.obRate != null ? { label: "Avoiding OB", value: 1 - career.obRate, benchmark: 0.92, sub: `${Math.round(career.obRate * 100)}% OB rate` } : null,
      career.scramblePct != null ? { label: "Scrambling", value: career.scramblePct, benchmark: 0.4, sub: "saves after trouble" } : null,
    ].filter((s): s is { label: string; value: number; benchmark: number; sub: string } => s != null);
    return raw.map((s) => ({ ...s, gap: s.benchmark - s.value })).sort((a, b) => b.gap - a.gap);
  }, [career]);

  if (dash === undefined || rounds === null) {
    return <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }
  if (!dash) {
    return <div className="flex min-h-[40vh] flex-col items-center justify-center text-center text-[var(--cream)]"><h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold">No stats yet</h2><p className="mt-2 max-w-md text-[var(--text-body)]">Play a round in the Radius app and your Game IQ, scoring mix and trends show up here.</p></div>;
  }

  const hasRounds = career != null && career.rounds > 0;
  const mix = career ? { birdie: career.birdies, par: career.pars, bogey: career.bogeys + career.doublePlus } : { birdie: 0, par: 0, bogey: 0 };

  return (
    <div className="space-y-5">
      {/* Identity strip */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center gap-3.5">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-lg font-bold text-[var(--cream)] ring-2 ring-[var(--gold)]/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {dash.profile.profileImageUrl ? <img src={dash.profile.profileImageUrl} alt="" className="h-full w-full object-cover" /> : (dash.profile.name || "?").charAt(0).toUpperCase()}
          </span>
          <div>
            <div className={`${HEAD} text-lg font-extrabold text-[var(--cream)]`}>{dash.profile.name || "Player"}</div>
            <div className="text-[13px] font-bold" style={{ color: rank.color }}>GAME IQ • {iq} <span className="text-[var(--sage-dim)]">({rankLabel(rank)})</span></div>
          </div>
        </div>
        <div className="text-right">
          <div className={eyebrow}>Avg to par</div>
          <div className={`${HEAD} text-2xl font-black`} style={{ color: scoreColor(career?.avgToPar ?? null) }}>{fmtToParAvg(career?.avgToPar ?? null)}</div>
        </div>
      </div>

      {/* Dual ring hero */}
      <div className={`${card} flex flex-col items-center gap-6 sm:flex-row sm:items-center`}>
        <DualRing rankProgress={rankProgress(iq, rank)} tierColor={rank.color} mix={mix} centerTop="AVG TO PAR" centerBig={fmtToParAvg(career?.avgToPar ?? null)} centerSub={hasRounds ? `${career!.rounds} rounds` : undefined} />
        <div className="min-w-0 flex-1">
          <div className={eyebrow}>{rank.tier.toUpperCase()}{nextRank ? ` → ${nextRank.tier.toUpperCase()} PROGRESS` : " · TOP TIER"}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`${HEAD} text-4xl font-black text-[var(--cream)]`}>{iq}</span>
            <span className="rounded-full bg-[#5fb87a]/15 px-2 py-0.5 text-xs font-bold text-[#5fb87a]">Game IQ</span>
          </div>
          {nextRank && <div className="mt-1 text-sm text-[var(--text-body)]">{Math.round(rankProgress(iq, rank) * 100)}% to <span className="font-semibold" style={{ color: nextRank.color }}>{nextRank.tier}</span> · {Math.max(0, (rank.nextIQ ?? iq) - iq)} IQ to go</div>}
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#33c773]" /> Birdie {mix.birdie}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--gold)]" /> Par {mix.par}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e0873f]" /> Bogey+ {mix.bogey}</span>
          </div>
        </div>
      </div>

      {/* Coaching insight + evidence (Pro) */}
      {hasRounds && (
        <ProGate pro={pro} title="Unlock your evidence" blurb="See your putting, driving and miss patterns from every logged round with Radius Pro.">
          <div className={`${card} space-y-5`}>
            <div>
              <div className={`${eyebrow} text-[var(--gold)]`}>⚡ Personal coaching insight</div>
              {leak ? (
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--cream)]"><span className="font-bold">{leak.label}</span> is where you&apos;re losing the most — {leak.note(leak.value)}. Closing that gap is the fastest path to your next rank.</p>
              ) : (
                <p className="mt-2 text-[15px] text-[var(--text-body)]">Log a few shot-tracked rounds and your coaching insight builds itself.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <EvidenceTile label="C1 Putting" value={pct(career!.c1.pct)} sub={career!.c1.att ? `${career!.c1.made}/${career!.c1.att} makes` : "No data yet"} />
              <EvidenceTile label="Fairway Hit" value={pct(career!.fairwayPct)} sub="tees in play" />
              <EvidenceTile label="Avg Drive" value={career!.avgDriveFt ? `${Math.round(career!.avgDriveFt)}` : "—"} unit={career!.avgDriveFt ? "ft" : undefined} sub="off the tee" />
              <EvidenceTile label="Miss Pattern" value={career!.missLeft + career!.missRight === 0 ? "—" : career!.missLeft >= career!.missRight ? "Left" : "Right"} sub={career!.missLeft + career!.missRight ? `${career!.missLeft}L · ${career!.missRight}R` : "No data yet"} />
            </div>

            {skills.length > 0 && (
              <div>
                <div className={eyebrow}>Where your strokes go</div>
                <div className="mt-3 space-y-2.5">
                  {skills.map((s, i) => {
                    const worst = i === 0;
                    const color = worst ? "#e0733f" : "var(--cream)";
                    return (
                      <div key={s.label} className={`rounded-2xl border p-3.5 ${worst ? "border-[#e0733f]/30 bg-[#e0733f]/[0.06]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-2 text-sm font-bold text-[var(--cream)]">
                            {s.label}
                            {worst && <span className="rounded-full bg-[#e0733f]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#eb9166]">Biggest leak</span>}
                          </span>
                          <span className={`${HEAD} text-lg font-black`} style={{ color }}>{Math.round(s.value * 100)}%</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, s.value * 100)}%`, background: worst ? "#e0733f" : "var(--gold)" }} /></div>
                        <div className="mt-1 text-[11px] text-[var(--sage-dim)]">{s.sub}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ProGate>
      )}

      {/* Trajectory (free) */}
      {iqSeries.length >= 2 && (
        <div className={`${card} flex items-center justify-between gap-4`}>
          <div>
            <div className={eyebrow}>Your trajectory</div>
            <div className="mt-1 text-sm text-[var(--text-body)]">Game IQ over your last {iqSeries.length} updates</div>
          </div>
          <Sparkline points={iqSeries} />
        </div>
      )}

      {/* Recent rounds (free) */}
      <div className={card}>
        <div className={`${eyebrow} mb-3`}>Recent rounds</div>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--sage-dim)]">No rounds yet — play one in the Radius app and it&apos;ll appear here.</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {recent.map((r) => (
              <button key={r.roundId} onClick={() => setOpen(r)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:opacity-80">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--cream)]">{r.courseName}</div>
                  <div className="text-xs text-[var(--sage-dim)]">{new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {r.holesPlayed} holes</div>
                </div>
                <span className={`${HEAD} shrink-0 text-xl font-black`} style={{ color: scoreColor(r.relativeToPar) }}>{fmtToPar(r.relativeToPar)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {open && <Scorecard round={open} rounds={rounds ?? undefined} onClose={() => setOpen(null)} />}
    </div>
  );
}
