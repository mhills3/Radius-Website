"use client";

import { useEffect, useState } from "react";

/** Animated count-up number. */
export function CountUp({ value, duration = 1000, className }: { value: number; duration?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{n}</span>;
}

/** Circular rating gauge: progress = 0..1 within the current rank. Colored by tier. */
export function IqRing({ iq, progress, label, caption = "Game IQ", color = "#f8cf80", color2 = "#d4a04a" }: { iq: number; progress: number; label: string; caption?: string; color?: string; color2?: string }) {
  const size = 196;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [off, setOff] = useState(c);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOff(c * (1 - Math.max(0.02, progress))));
    return () => cancelAnimationFrame(id);
  }, [c, progress]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="iqgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color2} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#iqgrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--sage-dim)]">{caption}</span>
        <CountUp value={iq} className="font-[family-name:var(--font-heading)] text-6xl font-extrabold leading-none tracking-tight text-[var(--cream)]" />
        <span className="mt-1.5 rounded-full px-3 py-0.5 text-xs font-bold" style={{ background: `${color}22`, color }}>{label}</span>
      </div>
    </div>
  );
}

/** Smooth area+line chart. values in chronological order. */
export function AreaChart({ values, height = 96, stroke = "var(--gold)" }: { values: number[]; height?: number; stroke?: string }) {
  if (values.length < 2) {
    return <div className="flex h-24 items-center text-sm text-[var(--sage-dim)]">Not enough data yet.</div>;
  }
  const W = 300;
  const H = height;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (W - pad * 2) + pad;
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-24 w-full">
      <defs>
        <linearGradient id="areagrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areagrad)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (i === values.length - 1 ? <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={stroke} /> : null))}
    </svg>
  );
}

/** Horizontal bars (CSS scaleX draw-in — always reaches full width). */
export function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-sm text-[var(--text-body)]">{it.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full origin-left rounded-full bg-gradient-to-r from-[#d4a04a] to-[#f8cf80] animate-[growX_0.9s_cubic-bezier(0.22,1,0.36,1)_both]"
              style={{ width: `${Math.max(4, (it.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-bold text-[var(--cream)]">{it.value}</span>
        </div>
      ))}
    </div>
  );
}
