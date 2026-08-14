"use client";

import { useEffect } from "react";
import { TIER_LIST } from "@/lib/rank";
import { TierEmblem } from "@/components/scorecard/LevelBadge";

const HEAD = "font-[family-name:var(--font-heading)]";
const BODY = "font-[family-name:var(--font-body)]";
const MONO = { fontFamily: "var(--font-heading)" } as const;

/** The full 6-tier rank ladder, opened from the Game IQ emblem. Highlights the viewer's tier. */
export default function RankTiersModal({ iq, onClose }: { iq: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const first = TIER_LIST[0].display, last = TIER_LIST[TIER_LIST.length - 1].display;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/65 p-4 py-10 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[var(--hair-strong)] bg-[var(--bg-mid)] p-6 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className={`${HEAD} text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--sage-dim)]`}>Rank Tiers</div>
            <h2 className={`${HEAD} mt-1.5 text-[26px] font-extrabold leading-tight text-[var(--cream)]`}>From {first} to {last}</h2>
            <p className={`${BODY} mt-1.5 text-[14px] text-[var(--sage)]`}>Your Game IQ earns a rank across 6 tiers — 30 ranks in all.</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--sage)] transition-colors hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3">
          {TIER_LIST.map((t) => {
            const you = iq >= t.iqMin && iq <= t.iqMax;
            return (
              <div key={t.display} className="rounded-xl border p-4 transition-colors" style={{ borderColor: you ? t.color : "var(--hair)", background: you ? `${t.color}12` : "transparent" }}>
                <div className="flex items-start gap-3.5">
                  <TierEmblem icon={t.icon} color={t.color} secondary={t.secondary} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`${HEAD} text-[17px] font-bold`} style={{ color: t.color }}>{t.display}</span>
                        {you && <span className={`${HEAD} rounded-full px-2 py-[2px] text-[9px] font-bold uppercase tracking-wide`} style={{ background: `${t.color}26`, color: t.color }}>You</span>}
                      </div>
                      <span className="shrink-0 text-[12px] text-[var(--sage-dim)]" style={MONO}>{t.iqMin}–{t.iqMax} IQ</span>
                    </div>
                    <p className={`${BODY} mt-1.5 text-[13.5px] leading-snug text-[var(--sage)]`}>{t.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
