"use client";

import { rankForIQ } from "@/lib/rank";

// Tier emblem shapes (match the app's LevelBadge icons).
function TierGlyph({ icon, color, s }: { icon: string; color: string; s: number }) {
  const c = s / 2;
  const common = { fill: color } as const;
  switch (icon) {
    case "hexagon": return <polygon points={`${c},${s*0.14} ${s*0.82},${s*0.32} ${s*0.82},${s*0.68} ${c},${s*0.86} ${s*0.18},${s*0.68} ${s*0.18},${s*0.32}`} {...common} />;
    case "shield": return <path d={`M${c} ${s*0.14} L${s*0.82} ${s*0.28} L${s*0.82} ${s*0.55} Q${s*0.82} ${s*0.78} ${c} ${s*0.88} Q${s*0.18} ${s*0.78} ${s*0.18} ${s*0.55} L${s*0.18} ${s*0.28} Z`} {...common} />;
    case "star": { const pts: string[] = []; for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 === 0 ? s * 0.38 : s * 0.16; pts.push(`${c + rr * Math.cos(ang)},${c + rr * Math.sin(ang)}`); } return <polygon points={pts.join(" ")} {...common} />; }
    case "diamond": return <polygon points={`${c},${s*0.14} ${s*0.84},${c} ${c},${s*0.86} ${s*0.16},${c}`} {...common} />;
    case "crown": return <path d={`M${s*0.2} ${s*0.68} L${s*0.16} ${s*0.34} L${s*0.34} ${s*0.5} L${c} ${s*0.26} L${s*0.66} ${s*0.5} L${s*0.84} ${s*0.34} L${s*0.8} ${s*0.68} Z`} {...common} />;
    default: return <circle cx={c} cy={c} r={s * 0.3} {...common} />;
  }
}

export default function LevelBadge({ iq, size = 78 }: { iq: number; size?: number }) {
  const r = rankForIQ(iq);
  const pad = Math.round(size * 0.09);
  const inner = size - pad * 2;
  const pipR = Math.max(2, size * 0.032);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-[22%]" style={{ background: `linear-gradient(150deg, ${r.color}, ${r.secondary})`, boxShadow: `0 0 22px -6px ${r.color}` }} />
      <div className="absolute rounded-[20%] bg-[#12180F]" style={{ inset: pad }}>
        <svg viewBox={`0 0 ${inner} ${inner}`} width={inner} height={inner} className="opacity-90"><TierGlyph icon={r.icon} color={r.color} s={inner} /></svg>
      </div>
      {/* sublevel pips */}
      <div className="absolute inset-x-0 flex justify-center gap-[3px]" style={{ bottom: pad + 2 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className="rounded-full" style={{ width: pipR * 2, height: pipR * 2, background: n <= r.subLevel ? r.color : "rgba(255,255,255,0.22)" }} />
        ))}
      </div>
    </div>
  );
}
