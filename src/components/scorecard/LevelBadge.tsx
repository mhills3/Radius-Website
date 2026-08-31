"use client";

import { rankForIQ, rankForRating } from "@/lib/rank";

// Tier emblem shapes (match the app's LevelBadge icons). Drawn on a viewBox of side `s`, centered.
export function TierGlyph({ icon, color, s }: { icon: string; color: string; s: number }) {
  const c = s / 2;
  const common = { fill: color } as const;
  switch (icon) {
    case "hexagon": return <polygon points={`${c},${s*0.10} ${s*0.86},${s*0.30} ${s*0.86},${s*0.70} ${c},${s*0.90} ${s*0.14},${s*0.70} ${s*0.14},${s*0.30}`} {...common} />;
    case "shield": return <path d={`M${c} ${s*0.10} L${s*0.85} ${s*0.24} L${s*0.85} ${s*0.54} Q${s*0.85} ${s*0.80} ${c} ${s*0.92} Q${s*0.15} ${s*0.80} ${s*0.15} ${s*0.54} L${s*0.15} ${s*0.24} Z`} {...common} />;
    case "star": { const pts: string[] = []; const ro = s * 0.44, ri = ro * 0.46; for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 === 0 ? ro : ri; pts.push(`${(c + rr * Math.cos(ang)).toFixed(2)},${(c + rr * Math.sin(ang)).toFixed(2)}`); } return <polygon points={pts.join(" ")} {...common} />; }
    case "diamond": return <polygon points={`${c},${s*0.10} ${s*0.88},${c} ${c},${s*0.90} ${s*0.12},${c}`} {...common} />;
    case "crown": return <path d={`M${s*0.18} ${s*0.70} L${s*0.13} ${s*0.30} L${s*0.35} ${s*0.50} L${c} ${s*0.22} L${s*0.65} ${s*0.50} L${s*0.87} ${s*0.30} L${s*0.82} ${s*0.70} Z`} {...common} />;
    default: return <circle cx={c} cy={c} r={s * 0.28} {...common} />;
  }
}

/** A tier emblem — rounded-squircle plate with the glyph, in the tier color. No sublevel pips. */
export function TierEmblem({ icon, color, secondary, size = 44 }: { icon: string; color: string; secondary: string; size?: number }) {
  const g = size * 0.5;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0" style={{ borderRadius: size * 0.3, background: `linear-gradient(150deg, ${color}, ${secondary})`, boxShadow: `0 0 18px -8px ${color}` }} />
      <div className="absolute bg-[#12180F]" style={{ inset: Math.round(size * 0.085), borderRadius: size * 0.25 }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width={g} height={g} viewBox={`0 0 ${g} ${g}`}><TierGlyph icon={icon} color={color} s={g} /></svg>
      </div>
    </div>
  );
}

// Pass `rating` for the Radius Rating scale, or `iq` for the Game IQ fallback.
export default function LevelBadge({ iq, rating, size = 78 }: { iq?: number; rating?: number; size?: number }) {
  const r = typeof rating === "number" ? rankForRating(rating) : rankForIQ(iq ?? 0);
  const g = size * 0.46;                       // glyph box, lifted to clear the pip row
  const pipR = Math.max(1.5, size * 0.028);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0" style={{ borderRadius: size * 0.3, background: `linear-gradient(150deg, ${r.color}, ${r.secondary})`, boxShadow: `0 0 22px -8px ${r.color}` }} />
      <div className="absolute bg-[#12180F]" style={{ inset: Math.round(size * 0.085), borderRadius: size * 0.25 }} />
      {/* glyph, nudged up so the pip row has clean space beneath it */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: size * 0.15 }}>
        <svg width={g} height={g} viewBox={`0 0 ${g} ${g}`} className="opacity-95"><TierGlyph icon={r.icon} color={r.color} s={g} /></svg>
      </div>
      {/* sublevel pips */}
      <div className="absolute inset-x-0 flex justify-center" style={{ bottom: Math.round(size * 0.135), gap: pipR }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="rounded-full" style={{ width: pipR * 2, height: pipR * 2, background: n <= r.subLevel ? r.color : "rgba(255,255,255,0.2)" }} />
        ))}
      </div>
    </div>
  );
}
