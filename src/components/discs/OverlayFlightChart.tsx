"use client";

import { useState } from "react";
import { type FlightDisc, type Cat, CAT_META, buildFlightPath } from "@/lib/bag";

const W = 300, H = 460, PAD = 26, CX = W / 2, BASE_Y = H - PAD;

export interface OverlayItem { id: string; disc: FlightDisc; color: string; label: string }

/** Overlays multiple flight paths, each in its OWN assigned color (with a matching legend). */
export default function OverlayFlightChart({ items, dark = false }: { items: OverlayItem[]; dark?: boolean }) {
  const [filter, setFilter] = useState<Cat | "ALL">("ALL");
  const [hover, setHover] = useState<string | null>(null);

  const flown = items.filter((x) => x.disc.speed != null && x.disc.turn != null && x.disc.fade != null);
  const cats = (["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"] as Cat[]).filter((c) => flown.some((x) => x.disc.category === c));
  const shown = filter === "ALL" ? flown : flown.filter((x) => x.disc.category === filter);
  const hovered = shown.find((x) => x.id === hover);

  const grid = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  const center = dark ? "var(--cream)" : "#16221b";
  const btnOn = "bg-[var(--gold)] text-[#16221b]";
  const btnOff = dark ? "bg-white/[0.06] text-[var(--text-body)] hover:bg-white/10" : "bg-black/[0.05] text-[#46554c] hover:bg-black/10";

  return (
    <div>
      {cats.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setFilter("ALL")} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filter === "ALL" ? btnOn : btnOff}`}>All</button>
          {cats.map((c) => <button key={c} onClick={() => setFilter(c)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filter === c ? btnOn : btnOff}`}>{CAT_META[c].short}</button>)}
        </div>
      )}

      <div className="relative mx-auto" style={{ maxWidth: W }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="ovFairway" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(95,184,122,0.10)" />
              <stop offset="100%" stopColor="rgba(95,184,122,0)" />
            </linearGradient>
          </defs>
          <rect x={CX - 42} y={PAD} width={84} height={H - PAD * 2} rx={42} fill="url(#ovFairway)" />
          <line x1={CX} y1={PAD} x2={CX} y2={BASE_Y} stroke={grid} strokeWidth="1" strokeDasharray="3 5" />

          {shown.map((x) => {
            const p = buildFlightPath(x.disc, W, H, PAD);
            const isHover = hover === x.id;
            const dim = hover && !isHover;
            return (
              <g key={x.id} onMouseEnter={() => setHover(x.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                <path d={p.d} fill="none" stroke={x.color} strokeWidth={isHover ? 4 : 2.4} strokeLinecap="round" opacity={dim ? 0.18 : isHover ? 1 : 0.85} />
                <circle cx={p.endX} cy={p.endY} r={isHover ? 5 : 3} fill={x.color} opacity={dim ? 0.18 : 1} />
              </g>
            );
          })}

          <circle cx={CX} cy={BASE_Y} r="5" fill={center} />
          <circle cx={CX} cy={BASE_Y} r="9" fill="none" stroke={center} strokeOpacity="0.3" strokeWidth="1.5" />
        </svg>

        {hovered && (
          <div className={`pointer-events-none absolute left-2 top-2 rounded-xl border px-3 py-2 backdrop-blur-sm ${dark ? "border-white/10 bg-[var(--bg-deep)]/90 text-[var(--cream)]" : "border-black/10 bg-white/95 text-[#16221b]"}`}>
            <div className="text-sm font-bold">{hovered.label}</div>
            <div className="mt-0.5 font-mono text-xs" style={{ color: hovered.color }}>{hovered.disc.speed} / {hovered.disc.glide} / {hovered.disc.turn} / {hovered.disc.fade}</div>
          </div>
        )}
      </div>

      <div className={`mt-3 flex flex-wrap items-center justify-center gap-4 text-xs ${dark ? "text-[var(--text-body)]" : "text-[#46554c]"}`}>
        {flown.map((x) => <span key={x.id} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />{x.label}</span>)}
      </div>
    </div>
  );
}
