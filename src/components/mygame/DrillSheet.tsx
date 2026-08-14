"use client";

import { useEffect } from "react";
import type { PlanDrill } from "@/lib/drills";

const HEAD = "font-[family-name:var(--font-heading)]";
const BODY = "font-[family-name:var(--font-body)]";
const MONO = { fontFamily: "var(--font-heading)" } as const;
const GOLD = "#E8B560", INK = "#F4F1E8", SAGE = "#8FA08A", DIM = "#3E4B3F", EB = "#4A5A48";

/** A single prescribed drill — the goal, time, level, and a personal "mark done" for the week. */
export default function DrillSheet({ drill, skillName, done, onToggle, onClose }: {
  drill: PlanDrill; skillName: string; done: boolean; onToggle: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/65 p-4 py-10 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--hair-strong)] bg-[var(--bg-mid)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className={`${HEAD} text-[10px] font-black uppercase tracking-[0.22em]`} style={{ color: EB }}>{skillName} drill</div>
            <h2 className={`${HEAD} mt-2 text-[24px] font-extrabold leading-tight`} style={{ color: INK }}>{drill.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-[11px]" style={MONO}>
              <span style={{ color: GOLD }}>{drill.minutes} min</span>
              <span style={{ color: DIM }}>·</span>
              <span className="rounded-full px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide" style={{ background: "rgba(232,181,96,0.14)", color: GOLD }}>{drill.level}</span>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--sage)] transition-colors hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="rounded-xl border border-[var(--hair)] p-4">
          <div className={`${HEAD} text-[9px] font-black uppercase tracking-[0.22em]`} style={{ color: EB }}>The goal</div>
          <p className={`${BODY} mt-2 text-[16px] leading-snug`} style={{ color: INK }}>{drill.goal}</p>
        </div>

        <p className={`${BODY} mt-4 text-[12.5px] leading-relaxed`} style={{ color: SAGE }}>
          Run it in the Radius app&apos;s {skillName === "Putting" ? "putting trainer" : skillName === "Driving" ? "driving range" : "practice"} and your session syncs back here — the &ldquo;is it working&rdquo; check compares it to your rounds.
        </p>

        <button onClick={onToggle} className={`${HEAD} mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-bold transition-colors`}
          style={done ? { background: "rgba(143,191,154,0.14)", color: "#8FBF9A" } : { background: GOLD, color: "#141B16" }}>
          {done ? <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 6L9 17l-5-5" /></svg>
            Done this week
          </> : "Mark done this week"}
        </button>
      </div>
    </div>
  );
}
