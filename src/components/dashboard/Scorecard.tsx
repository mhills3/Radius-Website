"use client";

import { useEffect } from "react";
import { type DecodedRound } from "@/lib/rounds";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "");

// Color a hole by score relative to par.
function holeColor(diff: number): string {
  if (diff <= -2) return "#33c773"; // eagle+
  if (diff === -1) return "#5fb87a"; // birdie
  if (diff === 0) return "var(--cream)"; // par
  if (diff === 1) return "#e0a23f"; // bogey
  return "#e0473f"; // double+
}

function HoleCell({ n, par, score }: { n: number; par: number; score: number }) {
  const diff = score - par;
  const color = holeColor(diff);
  const ring = diff < 0; // circle for under par
  const square = diff > 0; // square for over par
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1">
      <div className="text-[10px] font-semibold text-[var(--sage-dim)]">{n}</div>
      <div className="text-[10px] text-[var(--sage-dim)]">par {par}</div>
      <div
        className={`grid h-9 w-9 place-items-center font-[family-name:var(--font-heading)] text-base font-bold ${ring ? "rounded-full border-2" : square ? "border-2" : ""}`}
        style={{ color, borderColor: diff !== 0 ? color : "transparent" }}
      >
        {score}
      </div>
    </div>
  );
}

export default function Scorecard({ round, onClose }: { round: DecodedRound; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const holes = round.holes.filter((h) => h.played);
  const front = holes.filter((h) => h.holeNumber <= 9);
  const back = holes.filter((h) => h.holeNumber > 9);
  const sumPar = (hs: typeof holes) => hs.reduce((s, h) => s + h.par, 0);
  const sumScore = (hs: typeof holes) => hs.reduce((s, h) => s + h.score, 0);
  const rel = round.relativeToPar;
  const relColor = rel < 0 ? "#5fb87a" : rel === 0 ? "var(--cream)" : "#e0473f";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[var(--bg-mid)] p-7 animate-[fadeIn_0.25s_ease]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--sage-dim)]">Scorecard</div>
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

        {[{ label: "Front", hs: front.length ? front : holes }, ...(back.length ? [{ label: "Back", hs: back }] : [])].map((seg) => (
          <div key={seg.label} className="mb-4">
            {back.length > 0 && <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--sage-dim)]">{seg.label} nine</div>}
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {seg.hs.map((h) => (
                <HoleCell key={h.holeNumber} n={h.holeNumber} par={h.par} score={h.score} />
              ))}
              <div className="ml-2 flex w-14 shrink-0 flex-col items-center gap-1 border-l border-white/10 pl-3">
                <div className="text-[10px] font-semibold text-[var(--sage-dim)]">TOT</div>
                <div className="text-[10px] text-[var(--sage-dim)]">par {sumPar(seg.hs)}</div>
                <div className="grid h-9 place-items-center font-[family-name:var(--font-heading)] text-base font-bold text-[var(--cream)]">{sumScore(seg.hs)}</div>
              </div>
            </div>
          </div>
        ))}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/[0.06] pt-4 text-xs text-[var(--text-body)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2" style={{ borderColor: "#5fb87a" }} /> Under par</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3" style={{ color: "var(--cream)" }}>—</span> Par</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 border-2" style={{ borderColor: "#e0473f" }} /> Over par</span>
        </div>
      </div>
    </div>
  );
}
