"use client";

import { useEffect } from "react";
import { TIER_LIST, TIER_LIST_RATING } from "@/lib/rank";
import LevelBadge from "@/components/rank/LevelBadge";

export default function RankLibrary({ currentTier, isRating = false, onClose }: { currentTier?: string; isRating?: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[var(--bg-mid)] p-7 animate-[fadeIn_0.25s_ease]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--sage-dim)]">Rank tiers</div>
            <h2 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight text-[var(--cream)]">From Rookie to Champion</h2>
            <p className="mt-1 text-sm text-[var(--text-body)]">Your {isRating ? "Radius Rating" : "Game IQ"} earns a rank across 6 tiers — 30 ranks in all.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--sage)] transition-colors hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {(isRating ? TIER_LIST_RATING : TIER_LIST).map((t) => {
            const active = t.display === currentTier;
            const range = isRating && t.iqMax >= 9999 ? `${t.iqMin}+` : `${t.iqMin}–${t.iqMax}${isRating ? "" : " IQ"}`;
            return (
              <div
                key={t.display}
                className={`flex items-center gap-4 rounded-2xl border p-4 ${active ? "bg-white/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}
                style={active ? { borderColor: t.color } : undefined}
              >
                <LevelBadge rank={{ color: t.color, secondary: t.secondary, icon: t.icon }} size={52} showPips={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-heading)] text-lg font-bold" style={{ color: t.color }}>{t.display}</span>
                    {active && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${t.color}22`, color: t.color }}>You</span>}
                    <span className="ml-auto shrink-0 text-xs font-semibold text-[var(--sage-dim)]">{range}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--text-body)]">{t.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
