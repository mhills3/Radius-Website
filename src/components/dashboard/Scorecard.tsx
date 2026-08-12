"use client";

import { useEffect, useMemo, useState } from "react";
import { type DecodedRound, computeRoundStats, type RoundStats } from "@/lib/rounds";
import { usePro } from "@/lib/usePro";
import ProGate from "@/components/ProGate";
import ScorecardTable from "@/components/scorecard/ScorecardTable";
import RoundInsights from "@/components/scorecard/RoundInsights";

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

export default function Scorecard({ round, onClose, rounds }: { round: DecodedRound; onClose: () => void; rounds?: DecodedRound[] }) {
  const [tab, setTab] = useState<Tab>("scorecard");
  const pro = usePro();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scHoles = round.holes.filter((h) => h.played).map((h) => ({ holeNumber: h.holeNumber, par: h.par, score: h.score, distance: h.distance || undefined }));
  const rel = round.relativeToPar;
  const relColor = rel < 0 ? "#5fb87a" : rel === 0 ? "var(--cream)" : "#e0473f";

  const stats: RoundStats = useMemo(() => computeRoundStats(round), [round]);

  const TABS: { key: Tab; label: string }[] = [
    { key: "scorecard", label: "Scorecard" },
    { key: "stats", label: "Stats" },
    { key: "insights", label: "Insights" },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[var(--bg-mid)] p-7 animate-[fadeIn_0.25s_ease]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--gold)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
              Round · {round.isComplete ? "Final" : "In progress"} <span className="font-bold" style={{ color: relColor }}>· {fmtScore(rel)}</span>
            </div>
            <h2 className="mt-1.5 truncate font-[family-name:var(--font-heading)] text-[26px] font-black tracking-[-0.01em] text-[var(--cream)]">{round.courseName}</h2>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--sage-dim)]">Par {round.totalPar} · {round.holesPlayed} holes · {fmtDate(round.date)}</div>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-[var(--sage)] transition-colors hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Tabs — iOS pill (white active) */}
        <div className="mb-6 mt-5 inline-flex rounded-full bg-white/[0.06] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-bold transition-colors ${tab === t.key ? "bg-[#F4F1E8] text-[#141b16]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}
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
          <ProGate pro={pro} title="Game IQ insights" blurb="See your Game IQ change, flight map, putting misses and how the round went with Pro.">
            <RoundInsights round={round} history={rounds} />
          </ProGate>
        )}
      </div>
    </div>
  );
}
