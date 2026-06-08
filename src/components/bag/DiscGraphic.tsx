"use client";

/** A top-down disc: bright plastic rim with sheen + recessed flight plate + embossed speed. */
export default function DiscGraphic({ color, speed, size = 88 }: { color: string; speed?: number; size?: number }) {
  const gid = `dg-${color.replace("#", "")}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="block">
      <defs>
        <radialGradient id={gid} cx="36%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="40%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.92" />
        </radialGradient>
      </defs>
      {/* rim */}
      <circle cx="50" cy="50" r="47" fill={`url(#${gid})`} stroke="rgba(0,0,0,0.28)" strokeWidth="1.2" />
      {/* recessed flight plate */}
      <circle cx="50" cy="50" r="36" fill="rgba(0,0,0,0.30)" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <circle cx="50" cy="50" r="29" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
      {/* embossed speed */}
      {speed != null && (
        <text x="50" y="51" textAnchor="middle" dominantBaseline="central" fontFamily="Sora, sans-serif" fontWeight="800" fontSize="30" fill="#ffffff">
          {speed}
        </text>
      )}
    </svg>
  );
}
