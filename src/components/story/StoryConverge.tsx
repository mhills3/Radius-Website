// Signature illustration: the scattered pieces of disc golf radiating in toward one center — "Radius".
// Pure SVG + SMIL (no JS). On-brand: concentric rings + radius lines to a glowing hub.

const C = 230;
const NODES = [
  { x: 70, y: 84, label: "Community", sub: "Reddit · Facebook", color: "#6aa9ff" },
  { x: 392, y: 96, label: "Your stats", sub: "siloed apps", color: "#5fcf80" },
  { x: 58, y: 372, label: "Coaching", sub: "go find a coach", color: "#c08bff" },
  { x: 398, y: 360, label: "Learning", sub: "YouTube rabbit holes", color: "#f6c165" },
];

export default function StoryConverge() {
  return (
    <svg viewBox="0 0 460 460" className="h-full w-full" role="img" aria-label="Every piece of disc golf radiating in to one center: Radius">
      <defs>
        <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(246,193,101,0.45)" />
          <stop offset="55%" stopColor="rgba(246,193,101,0.12)" />
          <stop offset="100%" stopColor="rgba(246,193,101,0)" />
        </radialGradient>
        <linearGradient id="ray" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(246,193,101,0.05)" />
          <stop offset="100%" stopColor="rgba(246,193,101,0.5)" />
        </linearGradient>
      </defs>

      {/* hub glow */}
      <circle cx={C} cy={C} r="150" fill="url(#hubGlow)" />

      {/* concentric rings */}
      {[78, 132, 188].map((r) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="rgba(246,193,101,0.14)" strokeWidth="1" />
      ))}

      {/* slow-rotating dashed ring */}
      <circle cx={C} cy={C} r="160" fill="none" stroke="rgba(246,193,101,0.35)" strokeWidth="1.5" strokeDasharray="2 12">
        <animateTransform attributeName="transform" type="rotate" from={`0 ${C} ${C}`} to={`360 ${C} ${C}`} dur="48s" repeatCount="indefinite" />
      </circle>
      <circle cx={C} cy={C} r="110" fill="none" stroke="rgba(245,237,225,0.12)" strokeWidth="1" strokeDasharray="1 9">
        <animateTransform attributeName="transform" type="rotate" from={`360 ${C} ${C}`} to={`0 ${C} ${C}`} dur="64s" repeatCount="indefinite" />
      </circle>

      {/* radius lines + traveling pulses from each node toward (but stopping short of) the hub */}
      {NODES.map((n) => {
        const dx = C - n.x, dy = C - n.y, len = Math.hypot(dx, dy);
        const ex = C - (dx / len) * 78, ey = C - (dy / len) * 78; // stop well clear of the hub
        return (
          <g key={n.label}>
            <line x1={n.x} y1={n.y} x2={ex} y2={ey} stroke="rgba(246,193,101,0.18)" strokeWidth="1.5" strokeDasharray="3 5" />
            <circle r="3" fill={n.color}>
              <animateMotion dur="3.4s" repeatCount="indefinite" path={`M ${n.x} ${n.y} L ${ex} ${ey}`} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="3.4s" repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}

      {/* outer nodes — labels sit clear of the marker (above for top nodes, below for bottom) */}
      {NODES.map((n) => {
        const below = n.y > C;
        const labelY = below ? n.y + 28 : n.y - 30;
        const subY = below ? n.y + 44 : n.y - 14;
        return (
          <g key={`node-${n.label}`}>
            <circle cx={n.x} cy={n.y} r="9" fill="#16221b" stroke={n.color} strokeWidth="2.5" />
            <circle cx={n.x} cy={n.y} r="3.5" fill={n.color} />
            <text x={n.x} y={labelY} textAnchor="middle" fill="#F5EDE1" fontSize="15" fontWeight="700">{n.label}</text>
            <text x={n.x} y={subY} textAnchor="middle" fill="rgba(245,237,225,0.45)" fontSize="10.5">{n.sub}</text>
          </g>
        );
      })}

      {/* center hub */}
      <circle cx={C} cy={C} r="48" fill="#16221b" stroke="rgba(246,193,101,0.6)" strokeWidth="2" />
      <circle cx={C} cy={C} r="48" fill="none" stroke="rgba(246,193,101,0.22)" strokeWidth="7" />
      <text x={C} y={C - 2} textAnchor="middle" fill="#F6C165" fontSize="19" fontWeight="700" style={{ fontFamily: "var(--font-heading), sans-serif", letterSpacing: "-0.03em" }}>Radius</text>
      <text x={C} y={C + 11} textAnchor="middle" fill="rgba(245,237,225,0.55)" fontSize="8" letterSpacing="2.5" style={{ fontFamily: "var(--font-heading), sans-serif" }}>ALL IN ONE</text>
    </svg>
  );
}
