"use client";

// The signature My Game visual: a dual concentric ring.
//  • Outer thin ring = progress toward the next rank (tier-colored).
//  • Inner thick ring = your scoring-mix donut (birdie green / par gold / bogey+ orange).
//  • Center = average to par.

const BIRDIE = "#33c773";
const PAR = "var(--gold)";
const BOGEY = "#e0873f";

function Donut({ segments, r, width, gap = 0.012 }: { segments: { frac: number; color: string }[]; r: number; width: number; gap?: number }) {
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.frac, 0) || 1;
  const fracs = segments.map((s) => s.frac / total);
  const starts = fracs.map((_, i) => fracs.slice(0, i).reduce((a, b) => a + b, 0)); // cumulative start, no mutated let
  return (
    <>
      <circle cx="0" cy="0" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={width} />
      {segments.map((s, i) => {
        if (fracs[i] <= 0) return null;
        const len = Math.max(0, (fracs[i] - gap) * C);
        return <circle key={i} cx="0" cy="0" r={r} fill="none" stroke={s.color} strokeWidth={width} strokeLinecap="butt" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-starts[i] * C} transform="rotate(-90)" />;
      })}
    </>
  );
}

export default function DualRing({
  size = 188, rankProgress, tierColor, mix, centerTop, centerBig, centerSub,
}: {
  size?: number;
  rankProgress: number; // 0..1
  tierColor: string;
  mix: { birdie: number; par: number; bogey: number };
  centerTop: string;
  centerBig: string;
  centerSub?: string;
}) {
  const half = size / 2;
  const outerR = half - 6;
  const innerR = half - 26;
  const total = mix.birdie + mix.par + mix.bogey;
  const segs = total > 0
    ? [{ frac: mix.birdie, color: BIRDIE }, { frac: mix.par, color: PAR }, { frac: mix.bogey, color: BOGEY }]
    : [{ frac: 1, color: "rgba(255,255,255,0.08)" }];
  const C = 2 * Math.PI * outerR;
  const prog = Math.max(0, Math.min(1, rankProgress));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <g transform={`translate(${half} ${half})`}>
        {/* outer rank-progress ring */}
        <circle cx="0" cy="0" r={outerR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <circle cx="0" cy="0" r={outerR} fill="none" stroke={tierColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${prog * C} ${C}`} transform="rotate(-90)" />
        {/* inner scoring-mix donut */}
        <Donut segments={segs} r={innerR} width={17} />
        {/* center */}
        <text x="0" y={-innerR * 0.38} textAnchor="middle" className="fill-[var(--sage-dim)]" style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", fontFamily: "var(--font-heading)" }}>{centerTop}</text>
        <text x="0" y={innerR * 0.16} textAnchor="middle" className="fill-[var(--cream)]" style={{ fontSize: 34, fontWeight: 900, fontFamily: "var(--font-heading)" }}>{centerBig}</text>
        {centerSub && <text x="0" y={innerR * 0.55} textAnchor="middle" className="fill-[var(--sage-dim)]" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", fontFamily: "var(--font-heading)" }}>{centerSub}</text>}
      </g>
    </svg>
  );
}
