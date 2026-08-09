"use client";

import { useEffect } from "react";
import ScorecardTable, { type ScorecardHole } from "@/components/scorecard/ScorecardTable";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const relColor = (n: number) => (n < 0 ? "#7fd39a" : n === 0 ? "var(--cream)" : "#eb9166");

/** Polished, event-final-quality scorecard for a single shared round, with the course cover as a
 *  branded header. Opened from the "View scorecard" action on a shared-round post. */
export default function RoundScorecardModal({
  courseName, cover, date, holeScores, holePars, onClose,
}: {
  courseName: string;
  cover?: string;
  date?: number | null;
  holeScores: number[];
  holePars: number[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const holes: ScorecardHole[] = holeScores
    .map((score, i) => ({ holeNumber: i + 1, par: holePars[i] ?? 0, score }))
    .filter((h) => h.score > 0 && h.par > 0);
  const total = holes.reduce((s, h) => s + h.score, 0);
  const par = holes.reduce((s, h) => s + h.par, 0);
  const rel = total - par;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-mid)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] animate-[fadeIn_0.24s_ease]">
        {/* Cover header */}
        <div className="relative h-36 w-full overflow-hidden bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.35),var(--bg-deep))]">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-mid)] via-black/40 to-black/20" />
          <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--gold)]">Scorecard</div>
              <h2 className="truncate font-[family-name:var(--font-heading)] text-2xl font-extrabold text-white drop-shadow">{courseName}</h2>
              <div className="text-xs text-white/85 drop-shadow">{date ? new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : ""}{holes.length ? ` · ${holes.length} holes` : ""}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-[family-name:var(--font-heading)] text-4xl font-black leading-none drop-shadow" style={{ color: relColor(rel) }}>{fmtScore(rel)}</div>
              <div className="text-xs text-white/85 drop-shadow">{total} / par {par}</div>
            </div>
          </div>
        </div>

        <div className="max-h-[calc(88vh-9rem)] overflow-y-auto p-6">
          <ScorecardTable holes={holes} />
        </div>
      </div>
    </div>
  );
}
