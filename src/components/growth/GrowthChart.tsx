"use client";

import { useMemo, useState } from "react";
import type { GrowthData, GrowthPoint } from "@/lib/growth";

const GOLD = "#F6C165";
const BLUE = "#4d94fa";
const DAY = 86400000;

type Mode = "week" | "month" | "all";
type Metric = "total" | "added";

function downsample(points: GrowthPoint[], mode: Mode): GrowthPoint[] {
  if (mode === "all" || points.length <= 2) return points;
  const keyOf = (d: number) => {
    if (mode === "week") return Math.floor(d / (7 * DAY));
    const dt = new Date(d);
    return dt.getUTCFullYear() * 12 + dt.getUTCMonth();
  };
  const lastByKey = new Map<number, GrowthPoint>();
  for (const p of points) lastByKey.set(keyOf(p.d), p); // last point in each period wins (cumulative)
  const out = [...lastByKey.values()].sort((a, b) => a.d - b.d);
  if (out[out.length - 1]?.d !== points[points.length - 1].d) out.push(points[points.length - 1]);
  return out;
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", year: "numeric" }); // "May 2026"
const fmtMonthLong = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "long", year: "numeric" }); // "April 2026"
const fmtFull = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function GrowthChart({ data }: { data: GrowthData }) {
  const [mode, setMode] = useState<Mode>("week");
  const [metric, setMetric] = useState<Metric>("total");
  const [hover, setHover] = useState<number | null>(null);

  const cum = useMemo(() => downsample(data.points, mode), [data.points, mode]);
  const showUsers = data.usersUsable;

  // For "added" mode, take the per-period delta of the cumulative series.
  const pts = useMemo(() => {
    if (metric === "total") return cum;
    return cum.map((p, i) => ({ d: p.d, courses: p.courses - (cum[i - 1]?.courses ?? 0), users: p.users - (cum[i - 1]?.users ?? 0) }));
  }, [cum, metric]);

  if (pts.length < 2) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center text-sm text-[var(--sage-dim)]">Not enough history yet to chart.</div>;
  }

  const W = 920, H = 380;
  const padL = 48, padR = 24, padT = 24, padB = 40;
  const gw = W - padL - padR, gh = H - padT - padB;
  const baseY = padT + gh;
  const x0 = pts[0].d, x1 = pts[pts.length - 1].d || x0 + DAY;
  const maxY = Math.max(...pts.map((p) => (showUsers ? Math.max(p.courses, p.users) : p.courses)), 1);
  const niceMax = metric === "total" ? (Math.ceil(maxY / 100) * 100 || maxY) : (Math.ceil(maxY / 5) * 5 || maxY);
  const sx = (d: number) => padL + ((d - x0) / (x1 - x0)) * gw;
  const sy = (v: number) => padT + gh - (v / niceMax) * gh;
  const bars = metric === "added";
  const path = (key: "courses" | "users") => pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.d).toFixed(1)},${sy(p[key]).toFixed(1)}`).join(" ");
  const area = (key: "courses" | "users") => `${path(key)} L${sx(pts[pts.length - 1].d).toFixed(1)},${baseY.toFixed(1)} L${sx(pts[0].d).toFixed(1)},${baseY.toFixed(1)} Z`;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((niceMax / yTicks) * i));
  const xLabelEvery = Math.max(1, Math.ceil(pts.length / 7));
  // Even x-axis ticks, plus the final point — but drop the tick before it if the forced last one would
  // crowd it (that's the "Aug 11 Aug 18" pile-up when the current partial period is tacked on).
  const labelIdxs = (() => {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i++) if (i % xLabelEvery === 0) out.push(i);
    const last = pts.length - 1;
    if (out[out.length - 1] !== last) {
      if (last - out[out.length - 1] < Math.max(1, Math.ceil(xLabelEvery / 2))) out.pop();
      out.push(last);
    }
    return out;
  })();
  const ht = hover != null ? pts[hover] : null;
  const slot = gw / pts.length;
  // Bars use band positioning (centered in each slot) so they stay inside the grid at the edges
  // and can be much wider. Two bars fill ~76% of the band; a single bar ~64%.
  const band = slot;
  const bucketX = (i: number) => padL + band * (i + 0.5);
  const barGap = band * 0.05;
  const barW = showUsers ? Math.min(band * 0.36, 90) : Math.min(band * 0.64, 150);
  const cxOf = (i: number) => (bars ? bucketX(i) : sx(pts[i].d));
  const hx = hover != null ? cxOf(hover) : 0;

  const Toggle = <T extends string>({ value, set, opts }: { value: T; set: (v: T) => void; opts: { v: T; label: string }[] }) => (
    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
      {opts.map((o) => (
        <button key={o.v} onClick={() => set(o.v)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${value === o.v ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{o.label}</button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} /><span className="text-[var(--text-body)]">Courses</span> <b className="text-[var(--cream)]">{data.coursesTotal.toLocaleString()}</b></span>
          {showUsers && <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BLUE }} /><span className="text-[var(--text-body)]">Users</span> <b className="text-[var(--cream)]">{data.usersTotal.toLocaleString()}</b></span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle value={metric} set={setMetric} opts={[{ v: "total", label: "Total" }, { v: "added", label: "Added" }]} />
          <Toggle value={mode} set={setMode} opts={[{ v: "week", label: "Weekly" }, { v: "month", label: "Monthly" }, { v: "all", label: "All days" }]} />
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="g-courses" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity="0.22" /><stop offset="100%" stopColor={GOLD} stopOpacity="0" /></linearGradient>
            <linearGradient id="g-users" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity="0.18" /><stop offset="100%" stopColor={BLUE} stopOpacity="0" /></linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={sy(t)} x2={W - padR} y2={sy(t)} stroke="rgba(245,237,225,0.07)" strokeWidth={1} />
              <text x={padL - 8} y={sy(t) + 4} fill="rgba(168,179,145,0.6)" fontSize={12} textAnchor="end">{t.toLocaleString()}</text>
            </g>
          ))}
          {labelIdxs.map((i) => (
            <text key={i} x={bars ? bucketX(i) : sx(pts[i].d)} y={H - 14} fill="rgba(168,179,145,0.6)" fontSize={12} textAnchor="middle">{mode === "month" ? fmtMonth(pts[i].d) : fmtDate(pts[i].d)}</text>
          ))}

          {bars ? (
            // per-period "added" bars
            pts.map((p, i) => {
              const cx = bucketX(i);
              const cBar = { x: showUsers ? cx - barGap / 2 - barW : cx - barW / 2, h: Math.max(0, baseY - sy(p.courses)) };
              const uBar = { x: cx + barGap / 2, h: Math.max(0, baseY - sy(p.users)) };
              const on = hover === i;
              return (
                <g key={i} opacity={hover != null && !on ? 0.55 : 1}>
                  <rect x={cBar.x} y={baseY - cBar.h} width={barW} height={cBar.h} rx={2} fill={GOLD} />
                  {showUsers && <rect x={uBar.x} y={baseY - uBar.h} width={barW} height={uBar.h} rx={2} fill={BLUE} />}
                </g>
              );
            })
          ) : (
            <>
              {showUsers && <path d={area("users")} fill="url(#g-users)" />}
              <path d={area("courses")} fill="url(#g-courses)" />
              {showUsers && <path d={path("users")} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
              <path d={path("courses")} fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {ht && (
                <g>
                  <line x1={sx(ht.d)} y1={padT} x2={sx(ht.d)} y2={baseY} stroke="rgba(245,237,225,0.2)" strokeWidth={1} />
                  <circle cx={sx(ht.d)} cy={sy(ht.courses)} r={4} fill={GOLD} stroke="#16221b" strokeWidth={1.5} />
                  {showUsers && <circle cx={sx(ht.d)} cy={sy(ht.users)} r={4} fill={BLUE} stroke="#16221b" strokeWidth={1.5} />}
                </g>
              )}
            </>
          )}

          {/* hover capture */}
          {pts.map((p, i) => (
            <rect key={`h${i}`} x={bars ? padL + band * i : sx(p.d) - slot / 2} y={padT} width={slot} height={gh} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {ht && (
          <div className="pointer-events-none absolute top-2 rounded-xl border border-white/10 bg-black/85 px-3 py-2 text-xs backdrop-blur" style={{ left: `${(hx / W) * 100}%`, transform: "translateX(-50%)" }}>
            <div className="font-semibold text-[var(--cream)]">{mode === "month" ? fmtMonthLong(ht.d) : fmtFull(ht.d)}</div>
            <div className="mt-0.5" style={{ color: GOLD }}>{ht.courses.toLocaleString()} courses{metric === "added" ? " added" : ""}</div>
            {showUsers && <div style={{ color: BLUE }}>{ht.users.toLocaleString()} users{metric === "added" ? " joined" : ""}</div>}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--sage-dim)]">
        {metric === "total" ? "Cumulative" : `New per ${mode === "all" ? "day" : mode}`} · updated hourly.{" "}
        {showUsers ? (
          <>Users reflects {data.usersDated.toLocaleString()} accounts with a recorded signup date{data.usersTotal > data.usersDated ? <> (of {data.usersTotal.toLocaleString()} total)</> : null}.</>
        ) : (
          <><span className="text-[var(--text-body)]">A users line will appear automatically once accounts carry a real signup date</span> — today only {data.usersDated.toLocaleString()} of {data.usersTotal.toLocaleString()} do (bunched in a backfill window), so plotting it would mislead. Once <code className="text-[var(--text-body)]">createdAt</code> (real signup time) is set, this turns on by itself.</>
        )}
      </p>
    </div>
  );
}
