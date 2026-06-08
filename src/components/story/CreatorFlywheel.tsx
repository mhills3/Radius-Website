// Signature illustration for /creators: the value flywheel — you create, your audience discovers
// Radius, you get paid & they save — round and round. Pure SVG + SMIL.

const C = 210;
const R = 132;
const STAGES = [
  { a: -90, label: "You create", sub: "content they trust", color: "#f6c165" },
  { a: 30, label: "They discover", sub: "Radius, via your code", color: "#6aa9ff" },
  { a: 150, label: "You earn", sub: "cash + 25% · they save", color: "#5fcf80" },
];
const pt = (a: number, r = R) => [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)] as const;

export default function CreatorFlywheel() {
  return (
    <svg viewBox="0 0 420 420" className="h-full w-full" role="img" aria-label="The creator value flywheel">
      <defs>
        <radialGradient id="flyGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(246,193,101,0.4)" />
          <stop offset="60%" stopColor="rgba(246,193,101,0.1)" />
          <stop offset="100%" stopColor="rgba(246,193,101,0)" />
        </radialGradient>
        <marker id="fhead" markerWidth="9" markerHeight="9" refX="5" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="rgba(246,193,101,0.8)" /></marker>
      </defs>

      <circle cx={C} cy={C} r="120" fill="url(#flyGlow)" />
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(246,193,101,0.16)" strokeWidth="1.5" />
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(246,193,101,0.4)" strokeWidth="2" strokeDasharray="3 14">
        <animateTransform attributeName="transform" type="rotate" from={`0 ${C} ${C}`} to={`360 ${C} ${C}`} dur="40s" repeatCount="indefinite" />
      </circle>

      {/* flow arcs between stages (clockwise) */}
      {STAGES.map((s, i) => {
        const from = STAGES[i];
        const to = STAGES[(i + 1) % STAGES.length];
        const [x1, y1] = pt(from.a + 22);
        const [x2, y2] = pt(to.a - 22);
        return <path key={i} d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`} fill="none" stroke="rgba(246,193,101,0.35)" strokeWidth="2" markerEnd="url(#fhead)" />;
      })}

      {/* traveling pulse around the wheel */}
      <circle r="4" fill="#f6c165">
        <animateMotion dur="6s" repeatCount="indefinite" path={`M ${pt(-90)[0]} ${pt(-90)[1]} A ${R} ${R} 0 1 1 ${pt(-90.001)[0]} ${pt(-90.001)[1]}`} />
      </circle>

      {/* stage nodes — labels sit clear of the marker */}
      {STAGES.map((s) => {
        const [x, y] = pt(s.a);
        const above = s.a === -90;
        const labelY = above ? y - 32 : y + 30;
        const subY = above ? y - 16 : y + 46;
        return (
          <g key={s.label}>
            <circle cx={x} cy={y} r="11" fill="#16221b" stroke={s.color} strokeWidth="3" />
            <circle cx={x} cy={y} r="4" fill={s.color} />
            <text x={x} y={labelY} textAnchor="middle" fill="#F5EDE1" fontSize="15" fontWeight="700">{s.label}</text>
            <text x={x} y={subY} textAnchor="middle" fill="rgba(245,237,225,0.5)" fontSize="10.5">{s.sub}</text>
          </g>
        );
      })}

      {/* center hub */}
      <circle cx={C} cy={C} r="50" fill="#16221b" stroke="rgba(246,193,101,0.55)" strokeWidth="2" />
      <text x={C} y={C - 2} textAnchor="middle" fill="#F6C165" fontSize="18" fontWeight="700" style={{ fontFamily: "var(--font-heading), sans-serif", letterSpacing: "-0.03em" }}>Radius</text>
      <text x={C} y={C + 12} textAnchor="middle" fill="rgba(245,237,225,0.6)" fontSize="8" letterSpacing="2.5" style={{ fontFamily: "var(--font-heading), sans-serif" }}>PARTNER</text>
    </svg>
  );
}
