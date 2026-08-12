"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { type DecodedRound, computeRoundStats, type RoundStats } from "@/lib/rounds";
import { useAuth } from "@/components/AuthProvider";
import { usePro } from "@/lib/usePro";
import ProGate from "@/components/ProGate";
import ScorecardTable from "@/components/scorecard/ScorecardTable";
import RoundInsights from "@/components/scorecard/RoundInsights";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "");
// Best/Worst hole label, matching iOS: positive gets a "+", zero/negative print bare ("H7 (0)", "H8 (-1)").
const fmtHoleRel = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// iOS AppTheme palette (Theme 2.swift) for the Stats rings.
const RING = { green: "#389A6B", red: "#CC5750", sage: "#A8B391", gold: "#F6C165", ink: "#F0EDE3" };

// PercentRing (Theme 2.swift): faint full track + a value-length arc from 12 o'clock clockwise, big
// truncated % centered with a small superscript, label below. 0% still draws a round-cap sliver.
function Gauge({ value, label, tint }: { value: number | null; label: string; tint: string }) {
  const size = 112, sw = 8, r = (size - sw) / 2 - 1, C = 2 * Math.PI * r;
  const has = value != null;
  const frac = has ? Math.max(0.0001, Math.min(value, 1)) : 0;
  const shown = has ? Math.floor(value * 100) : null; // iOS Int() truncation
  return (
    <div className="flex flex-col items-center gap-2.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <g transform={`translate(${size / 2} ${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke={`rgba(255,255,255,${has ? 0.12 : 0.07})`} strokeWidth={sw} />
          {has && <circle r={r} fill="none" stroke={tint} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${frac * C} ${C}`} />}
        </g>
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central">
          {shown == null
            ? <tspan style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-heading)", fill: "rgba(255,255,255,0.35)" }}>––</tspan>
            : <>
                <tspan style={{ fontSize: 31, fontWeight: 800, fontFamily: "var(--font-heading)", fill: RING.ink }}>{shown}</tspan>
                <tspan dx="1" dy="-9" style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-heading)", fill: "rgba(255,255,255,0.5)" }}>%</tspan>
              </>}
        </text>
      </svg>
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</div>
    </div>
  );
}

function SectionRule({ children }: { children: string }) {
  return (
    <div className="mb-5 mt-8 flex items-center gap-3 first:mt-0">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">{children}</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function RingGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className="flex items-start justify-center gap-3 sm:gap-2">{children}</div>
    </div>
  );
}

function ScoreCard({ big, label, color }: { big: string; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-2 py-4 text-center">
      <div className="font-[family-name:var(--font-heading)] text-[20px] font-black leading-none" style={{ color }}>{big}</div>
      <div className="mt-1.5 text-[12.5px] text-[var(--sage)]">{label}</div>
    </div>
  );
}

type Tab = "scorecard" | "stats" | "insights";

export default function Scorecard({ round, onClose, rounds }: { round: DecodedRound; onClose: () => void; rounds?: DecodedRound[] }) {
  const [tab, setTab] = useState<Tab>("scorecard");
  const pro = usePro();
  const { profile } = useAuth();
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

        {tab === "scorecard" && <ScorecardTable holes={scHoles} player={{ name: profile?.name ?? "You", photo: profile?.profileImageUrl, username: profile?.username }} />}

        {tab === "stats" && (
          <div>
            <SectionRule>Performance</SectionRule>
            <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-5">
              <div className="min-w-0">
                <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/45">Throw Quality</div>
                <div className="mt-1.5 text-[13.5px] text-[var(--sage)]">Composite shot grade this round</div>
              </div>
              <div className="flex shrink-0 items-baseline gap-1">
                <span className="font-[family-name:var(--font-heading)] text-[46px] font-black leading-none" style={{ color: RING.ink }}>{stats.throwQuality == null ? "––" : Math.floor(stats.throwQuality)}</span>
                <span className="text-[15px] font-bold text-white/45">/100</span>
              </div>
            </div>

            {/* Ring groups laid out horizontally for desktop */}
            <div className="mt-9 grid grid-cols-1 gap-8 sm:grid-cols-3">
              <RingGroup label="Driving">
                <Gauge value={stats.fairwayPct} label="Fairway" tint={RING.green} />
                <Gauge value={stats.obRate} label="OB Rate" tint={(stats.obRate ?? 1) <= 0 ? RING.green : RING.red} />
              </RingGroup>
              <RingGroup label="Approach">
                <Gauge value={stats.greenHitPct} label="Green Hit" tint={RING.sage} />
                <Gauge value={stats.scramblePct} label="Scramble" tint={RING.gold} />
              </RingGroup>
              <RingGroup label="Putting">
                <Gauge value={stats.c1Pct} label="C1 Putt" tint={RING.green} />
                <Gauge value={stats.c2Pct} label="C2 Putt" tint={RING.sage} />
              </RingGroup>
            </div>

            <SectionRule>Scoring</SectionRule>
            <div className="grid grid-cols-3 gap-2.5">
              <ScoreCard big={`${stats.throws}`} label="Throws" color={RING.ink} />
              <ScoreCard big={stats.bestHole ? `H${stats.bestHole.holeNumber} (${fmtHoleRel(stats.bestHole.rel)})` : "—"} label="Best Hole" color="#5fb87a" />
              <ScoreCard big={stats.worstHole ? `H${stats.worstHole.holeNumber} (${fmtHoleRel(stats.worstHole.rel)})` : "—"} label="Worst Hole" color={RING.red} />
            </div>
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
