"use client";

import { useEffect, useMemo, useState } from "react";
import { type DecodedRound, computeRoundStats, type RoundStats } from "@/lib/rounds";
import { rankForIQ, rankLabel } from "@/lib/rank";
import { usePro } from "@/lib/usePro";
import ProGate from "@/components/ProGate";
import ScorecardTable from "@/components/scorecard/ScorecardTable";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "");
const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{label}</div>
      <div className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

type Tab = "scorecard" | "stats" | "insights";

export default function Scorecard({ round, onClose }: { round: DecodedRound; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("scorecard");
  const pro = usePro();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scHoles = round.holes.filter((h) => h.played).map((h) => ({ holeNumber: h.holeNumber, par: h.par, score: h.score }));
  const rel = round.relativeToPar;
  const relColor = rel < 0 ? "#5fb87a" : rel === 0 ? "var(--cream)" : "#e0473f";

  const stats: RoundStats = useMemo(() => computeRoundStats(round), [round]);
  const hasIQ = typeof round.iqBefore === "number" && typeof round.iqAfter === "number";
  const weatherBits = [round.temperatureSummary, round.windSummary, round.weatherSummary].filter(Boolean) as string[];

  const TABS: { key: Tab; label: string }[] = [
    { key: "scorecard", label: "Scorecard" },
    { key: "stats", label: "Stats" },
    { key: "insights", label: "Insights" },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[var(--bg-mid)] p-7 animate-[fadeIn_0.25s_ease]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--sage-dim)]">Round detail</div>
            <h2 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight text-[var(--cream)]">{round.courseName}</h2>
            <div className="text-sm text-[var(--text-body)]">{fmtDate(round.date)}{round.holesPlayed ? ` · ${round.holesPlayed} holes` : ""}{round.isComplete ? "" : " · in progress"}</div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--sage)] transition-colors hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="my-6 flex items-end gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--sage-dim)]">Score</div>
            <div className="font-[family-name:var(--font-heading)] text-5xl font-extrabold leading-none" style={{ color: relColor }}>{fmtScore(rel)}</div>
          </div>
          <div className="pb-1">
            <div className="text-xs uppercase tracking-wide text-[var(--sage-dim)]">Total</div>
            <div className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--cream)]">{round.total} <span className="text-base font-normal text-[var(--sage-dim)]">/ par {round.totalPar}</span></div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${tab === t.key ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}
            >
              {t.label}
              {t.key === "insights" && !pro && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 opacity-80"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              )}
            </button>
          ))}
        </div>

        {tab === "scorecard" && <ScorecardTable holes={scHoles} />}

        {tab === "stats" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Metric label="Throw Quality" value={stats.throwQuality == null ? "—" : `${Math.round(stats.throwQuality)}`} color="var(--gold)" />
              <Metric label="Fairway %" value={pct(stats.fairwayPct)} color="#33c773" />
              <Metric label="OB Rate" value={pct(stats.obRate)} color="#e0473f" />
              <Metric label="Green Hit" value={pct(stats.greenHitPct)} color="#5fb87a" />
              <Metric label="Scramble" value={pct(stats.scramblePct)} color="var(--gold)" />
              <Metric label="Total Throws" value={`${stats.throws}`} color="var(--cream)" />
              <Metric label="C1 Putting" value={pct(stats.c1Pct)} color="#33c773" />
              <Metric label="C2 Putting" value={pct(stats.c2Pct)} color="#4d94fa" />
              <Metric label="Best Hole" value={stats.bestHole ? `H${stats.bestHole.holeNumber} (${fmtScore(stats.bestHole.rel)})` : "—"} color="#5fb87a" />
            </div>
            {stats.worstHole && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <Metric label="Worst Hole" value={`H${stats.worstHole.holeNumber} (${fmtScore(stats.worstHole.rel)})`} color="#e0473f" />
              </div>
            )}
            <p className="text-xs text-[var(--sage-dim)]">Putting splits need throw-distance data — older or imported rounds may show “—”.</p>
          </div>
        )}

        {tab === "insights" && (
          <ProGate pro={pro} title="Game IQ insights" blurb="See your Game IQ change, score distribution and discs thrown with Pro.">
          <div className="space-y-5">
            {hasIQ ? (
              (() => {
                const before = round.iqBefore as number;
                const after = round.iqAfter as number;
                const rb = rankForIQ(before);
                const ra = rankForIQ(after);
                const delta = after - before;
                const up = delta > 0;
                const promoted = ra.level !== rb.level;
                return (
                  <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-transparent p-5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">Game IQ</div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold text-[var(--cream)]">{before}</span>
                      <svg className="h-5 w-5 text-[var(--sage)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold" style={{ color: up ? "#5fb87a" : delta < 0 ? "#e0473f" : "var(--cream)" }}>{after}</span>
                      {delta !== 0 && (
                        <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: up ? "#5fb87a22" : "#e0473f22", color: up ? "#5fb87a" : "#e0473f" }}>{up ? "+" : ""}{delta}</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-body)]">
                      {promoted ? (
                        <>Rank up — <span className="font-semibold" style={{ color: ra.color }}>{rankLabel(ra)}</span></>
                      ) : (
                        <span style={{ color: ra.color }} className="font-semibold">{rankLabel(ra)}</span>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm text-[var(--sage-dim)]">Game IQ change isn’t recorded for this round.</div>
            )}

            {/* Score distribution */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">Score distribution</div>
              <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/[0.05]">
                {[
                  { n: stats.birdies, c: "#33c773" },
                  { n: stats.pars, c: "#9fb0a4" },
                  { n: stats.bogeys, c: "#e0a23f" },
                  { n: stats.doublePlus, c: "#e0473f" },
                ].map((s, i) => (s.n > 0 ? <div key={i} style={{ flex: s.n, background: s.c }} /> : null))}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Birdie+", n: stats.birdies, c: "#33c773" },
                  { label: "Par", n: stats.pars, c: "#cdd8cf" },
                  { label: "Bogey", n: stats.bogeys, c: "#e0a23f" },
                  { label: "Double+", n: stats.doublePlus, c: "#e0473f" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="font-[family-name:var(--font-heading)] text-xl font-extrabold" style={{ color: s.c }}>{s.n}</div>
                    <div className="text-[10px] uppercase tracking-wide text-[var(--sage-dim)]">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {weatherBits.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">Conditions</div>
                <div className="mt-2 text-sm font-semibold text-[var(--cream)]">{weatherBits.join(" · ")}</div>
              </div>
            )}

            {stats.discs.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">Discs thrown</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stats.discs.map((d) => (
                    <span key={d.name} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[var(--cream)]">
                      {d.name}
                      <span className="text-[var(--sage-dim)]">×{d.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          </ProGate>
        )}
      </div>
    </div>
  );
}
