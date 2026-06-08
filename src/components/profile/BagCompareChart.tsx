"use client";

import { useState } from "react";
import { type FlightDisc, type Cat, CAT_META, buildFlightPath } from "@/lib/bag";

const W = 300, H = 460, PAD = 26, CX = W / 2, BASE_Y = H - PAD;
const COLOR = { them: "#F6C165", you: "#4d94fa" } as const;

export default function BagCompareChart({ theirs, yours, theirName, yourName = "You" }: { theirs: FlightDisc[]; yours: FlightDisc[]; theirName: string; yourName?: string }) {
  const [filter, setFilter] = useState<Cat | "ALL">("ALL");
  const [hover, setHover] = useState<string | null>(null);

  const tagged = [
    ...theirs.map((d) => ({ d, owner: "them" as const })),
    ...yours.map((d) => ({ d, owner: "you" as const })),
  ].filter((x) => x.d.speed != null && x.d.turn != null && x.d.fade != null);

  const cats = (["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"] as Cat[]).filter((c) => tagged.some((x) => x.d.category === c));
  const shown = filter === "ALL" ? tagged : tagged.filter((x) => x.d.category === filter);
  const hovered = shown.find((x) => `${x.owner}-${x.d.id}` === hover);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setFilter("ALL")} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filter === "ALL" ? "bg-[var(--gold)] text-[#16221b]" : "bg-white/[0.06] text-[var(--text-body)] hover:bg-white/10"}`}>All</button>
        {cats.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${filter === c ? "bg-[var(--gold)] text-[#16221b]" : "bg-white/[0.06] text-[var(--text-body)] hover:bg-white/10"}`}>{CAT_META[c].short}</button>
        ))}
      </div>

      <div className="relative mx-auto" style={{ maxWidth: W }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          <defs>
            <linearGradient id="cmpFairway" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(95,184,122,0.08)" />
              <stop offset="100%" stopColor="rgba(95,184,122,0)" />
            </linearGradient>
          </defs>
          <rect x={CX - 42} y={PAD} width={84} height={H - PAD * 2} rx={42} fill="url(#cmpFairway)" />
          <line x1={CX} y1={PAD} x2={CX} y2={BASE_Y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 5" />

          {/* draw "yours" first, then "theirs" on top */}
          {[...shown].sort((a) => (a.owner === "them" ? 1 : -1)).map(({ d, owner }) => {
            const p = buildFlightPath(d, W, H, PAD);
            const key = `${owner}-${d.id}`;
            const isHover = hover === key;
            const dim = hover && !isHover;
            return (
              <g key={key} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                <path d={p.d} fill="none" stroke={COLOR[owner]} strokeWidth={isHover ? 3.5 : 2} strokeLinecap="round" opacity={dim ? 0.12 : isHover ? 1 : 0.55} />
                <circle cx={p.endX} cy={p.endY} r={isHover ? 4.5 : 2.5} fill={COLOR[owner]} opacity={dim ? 0.12 : 1} />
              </g>
            );
          })}

          <circle cx={CX} cy={BASE_Y} r="5" fill="var(--cream)" />
          <circle cx={CX} cy={BASE_Y} r="9" fill="none" stroke="var(--cream)" strokeOpacity="0.3" strokeWidth="1.5" />
        </svg>

        {hovered && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-xl border border-white/10 bg-[var(--bg-deep)]/90 px-3 py-2 backdrop-blur-sm">
            <div className="text-sm font-bold text-[var(--cream)]">{hovered.d.name}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: COLOR[hovered.owner] }} /><span style={{ color: COLOR[hovered.owner] }}>{hovered.owner === "them" ? theirName : yourName}</span><span className="font-mono text-[var(--sage-dim)]">· {hovered.d.speed}/{hovered.d.glide}/{hovered.d.turn}/{hovered.d.fade}</span></div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-5 text-xs text-[var(--text-body)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.them }} />{theirName}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR.you }} />{yourName}</span>
      </div>
      <p className="mt-1.5 text-center text-xs text-[var(--sage-dim)]">RHBH flight paths · hover a disc</p>
    </div>
  );
}
