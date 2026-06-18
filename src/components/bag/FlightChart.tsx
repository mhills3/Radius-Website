"use client";

import { useState } from "react";
import { type FlightDisc, type Cat, CAT_META, TIER_META, buildFlightPath } from "@/lib/bag";

const W = 300;
const H = 460;
const PAD = 26;
const CX = W / 2;
const BASE_Y = H - PAD;

// Effective flight = custom wear override ?? factory (what the disc actually flies — matches the
// disc detail + stability map). The chart must draw these, not the raw factory numbers.
function effOf(d: FlightDisc): { speed?: number; glide?: number; turn?: number; fade?: number; tier: "US" | "ST" | "OS" } {
  const speed = d.customSpeed ?? d.speed;
  const glide = d.customGlide ?? d.glide;
  const turn = d.customTurn ?? d.turn;
  const fade = d.customFade ?? d.fade;
  const stab = (typeof turn === "number" ? turn : 0) + (typeof fade === "number" ? fade : 0);
  return { speed, glide, turn, fade, tier: stab < -0.5 ? "US" : stab <= 1.5 ? "ST" : "OS" };
}

export default function FlightChart({ discs }: { discs: FlightDisc[] }) {
  const flown = discs.filter((d) => d.speed != null && d.turn != null && d.fade != null);
  const cats = (["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"] as Cat[]).filter((c) => flown.some((d) => d.category === c));
  const [filter, setFilter] = useState<Cat | "ALL">("ALL");
  const [hover, setHover] = useState<string | null>(null);

  const shown = filter === "ALL" ? flown : flown.filter((d) => d.category === filter);
  const hovered = shown.find((d) => d.id === hover);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter("ALL")} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filter === "ALL" ? "bg-[var(--gold)] text-[#16221b]" : "bg-white/[0.06] text-[var(--text-body)] hover:bg-white/10"}`}>
          All
        </button>
        {cats.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filter === c ? "bg-[var(--gold)] text-[#16221b]" : "bg-white/[0.06] text-[var(--text-body)] hover:bg-white/10"}`}>
            {CAT_META[c].short}
          </button>
        ))}
      </div>

      <div className="relative mx-auto" style={{ maxWidth: W }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="fairway" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(95,184,122,0.08)" />
              <stop offset="100%" stopColor="rgba(95,184,122,0)" />
            </linearGradient>
          </defs>
          <rect x={CX - 42} y={PAD} width={84} height={H - PAD * 2} rx={42} fill="url(#fairway)" />
          <line x1={CX} y1={PAD} x2={CX} y2={BASE_Y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 5" />

          {shown.map((disc) => {
            const e = effOf(disc);
            const p = buildFlightPath({ speed: e.speed, turn: e.turn, fade: e.fade }, W, H, PAD);
            const color = TIER_META[e.tier].color;
            const isHover = hover === disc.id;
            const dim = hover && !isHover;
            return (
              <g key={disc.id} onMouseEnter={() => setHover(disc.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                <path d={p.d} fill="none" stroke={color} strokeWidth={isHover ? 3.5 : 2} strokeLinecap="round" opacity={dim ? 0.16 : isHover ? 1 : 0.72} />
                <circle cx={p.endX} cy={p.endY} r={isHover ? 4.5 : 3} fill={color} opacity={dim ? 0.16 : 1} />
              </g>
            );
          })}

          <circle cx={CX} cy={BASE_Y} r="5" fill="var(--cream)" />
          <circle cx={CX} cy={BASE_Y} r="9" fill="none" stroke="var(--cream)" strokeOpacity="0.3" strokeWidth="1.5" />
        </svg>

        {hovered && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-xl border border-white/10 bg-[var(--bg-deep)]/90 px-3 py-2 backdrop-blur-sm">
            <div className="text-sm font-bold text-[var(--cream)]">{hovered.nickname || hovered.name}</div>
            <div className="mt-0.5 font-mono text-xs text-[var(--gold)]">{(() => { const e = effOf(hovered); return `${e.speed ?? "—"} / ${e.glide ?? "—"} / ${e.turn ?? "—"} / ${e.fade ?? "—"}`; })()}</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--text-body)]">
        {(["US", "ST", "OS"] as const).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_META[t].color }} />
            {TIER_META[t].label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-[var(--sage-dim)]">RHBH · hover a disc</p>
    </div>
  );
}
