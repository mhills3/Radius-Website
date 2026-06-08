"use client";

import { type TierIcon } from "@/lib/rank";

type BadgeRank = { color: string; secondary: string; icon: TierIcon; subLevel?: number };

// SVG ports of the app's tier icons (LevelBadge.kt drawTierIcon).
function hexPath(cx: number, cy: number, r: number) {
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + "Z";
}
function starPath(cx: number, cy: number, r: number) {
  const inner = r * 0.4;
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 180) * ((i * 360) / 10 - 90);
    const rr = i % 2 === 0 ? r : inner;
    const x = cx + rr * Math.cos(a);
    const y = cy + rr * Math.sin(a);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + "Z";
}
function shieldPath(cx: number, cy: number, r: number) {
  const w = r;
  const h = r * 1.2;
  return `M${cx - w},${cy - h * 0.5} L${cx - w},${cy + h * 0.1} Q${cx},${cy + h * 0.7} ${cx},${cy + h * 0.7} Q${cx},${cy + h * 0.7} ${cx + w},${cy + h * 0.1} L${cx + w},${cy - h * 0.5} Q${cx},${cy - h * 0.7} ${cx - w},${cy - h * 0.5} Z`;
}
function diamondPath(cx: number, cy: number, r: number) {
  return `M${cx},${cy - r} L${cx + r * 0.7},${cy} L${cx},${cy + r} L${cx - r * 0.7},${cy} Z`;
}
function crownPath(cx: number, cy: number, r: number) {
  const w = r;
  const h = r * 0.8;
  return `M${cx - w},${cy + h * 0.4} L${cx + w},${cy + h * 0.4} L${cx + w * 0.85},${cy - h * 0.5} L${cx + w * 0.45},${cy - h * 0.1} L${cx},${cy - h * 0.65} L${cx - w * 0.45},${cy - h * 0.1} L${cx - w * 0.85},${cy - h * 0.5} Z`;
}

function Icon({ icon, cx, cy, R, color }: { icon: TierIcon; cx: number; cy: number; R: number; color: string }) {
  switch (icon) {
    case "circle": return <circle cx={cx} cy={cy} r={R * 0.5} fill={color} />;
    case "hexagon": return <path d={hexPath(cx, cy, R * 0.55)} fill={color} />;
    case "shield": return <path d={shieldPath(cx, cy, R * 0.55)} fill={color} />;
    case "star": return <path d={starPath(cx, cy, R * 0.6)} fill={color} />;
    case "diamond": return <path d={diamondPath(cx, cy, R * 0.55)} fill={color} />;
    case "crown": return <path d={crownPath(cx, cy, R * 0.55)} fill={color} />;
  }
}

export default function LevelBadge({ rank, size = 72, showPips = true }: { rank: BadgeRank; size?: number; showPips?: boolean }) {
  const S = 64;
  const gid = `lb-${rank.icon}`;
  const subLevel = rank.subLevel ?? 0;
  const cx = S / 2;
  const iconCy = 27;
  const R = 17;
  // 5 sub-level pips
  const pipR = 2.3;
  const gap = 4.2;
  const totalW = 5 * pipR * 2 + 4 * (gap - pipR * 2);
  const startX = cx - totalW / 2 + pipR;
  const pipY = 53;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${S} ${S}`} aria-label={`${rank.icon} ${rank.subLevel ?? 0}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={rank.color} />
          <stop offset="100%" stopColor={rank.secondary} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={S} height={S} rx="16" fill={`url(#${gid})`} />
      <rect x="3.5" y="3.5" width={S - 7} height={S - 7} rx="13" fill="#0f1813" />
      <rect x="3.5" y="3.5" width={S - 7} height={S - 7} rx="13" fill={rank.color} opacity="0.08" />
      <Icon icon={rank.icon} cx={cx} cy={showPips ? iconCy : 32} R={R} color={rank.color} />
      {showPips &&
        [0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={startX + i * gap} cy={pipY} r={pipR} fill={i < subLevel ? rank.color : "rgba(255,255,255,0.14)"} />
        ))}
    </svg>
  );
}
