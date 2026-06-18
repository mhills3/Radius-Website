"use client";

import { useMemo, useState } from "react";
import type { GrowthData, GrowthPoint } from "@/lib/growth";

const GOLD = "#F6C165";
const BLUE = "#4d94fa";
const DAY = 86400000;

type Mode = "week" | "month" | "all";

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
const fmtMonth = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

export default function GrowthChart({ data }: { data: GrowthData }) {
  const [mode, setMode] = useState<Mode>("week");
  const [hover, setHover] = useState<number | null>(null);

  const pts = useMemo(() => downsample(data.points, mode), [data.points, mode]);
  const showUsers = data.usersUsable;

  if (pts.length < 2) {
    return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center text-sm text-[var(--sage-dim)]">Not enough history yet to chart.</div>;
  }

  const W = 920, H = 380;
  const padL = 48, padR = 24, padT = 24, padB = 40;
  const gw = W - padL - padR, gh = H - padT - padB;
  const x0 = pts[0].d, x1 = pts[pts.length - 1].d || x0 + DAY;
  const maxY = Math.max(...pts.map((p) => (showUsers ? Math.max(p.courses, p.users) : p.courses)), 1);
  const niceMax = Math.ceil(maxY / 100) * 100 || maxY;
  const sx = (d: number) => padL + ((d - x0) / (x1 - x0)) * gw;
  const sy = (v: number) => padT + gh - (v / niceMax) * gh;
  const path = (key: "courses" | "users") => pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.d).toFixed(1)},${sy(p[key]).toFixed(1)}`).join(" ");
  const area = (key: "courses" | "users") => `${path(key)} L${sx(pts[pts.length - 1].d).toFixed(1)},${(padT + gh).toFixed(1)} L${sx(pts[0].d).toFixed(1)},${(padT + gh).toFixed(1)} Z`;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((niceMax / yTicks) * i));
  const xLabelEvery = Math.max(1, Math.ceil(pts.length / 7));
  const ht = hover != null ? pts[hover] : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-sm">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: GOLD }} /><span className="text-[var(--text-body)]">Courses</span> <b className="text-[var(--cream)]">{data.coursesTotal.toLocaleString()}</b></span>
          {showUsers && <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BLUE }} /><span className="text-[var(--text-body)]">Users</span> <b className="text-[var(--cream)]">{data.usersTotal.toLocaleString()}</b></span>}
        </div>
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
          {(["week", "month", "all"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition-colors ${mode === m ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{m === "all" ? "All days" : m + "ly"}</button>
          ))}
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
          {pts.map((p, i) => i % xLabelEvery === 0 || i === pts.length - 1 ? (
            <text key={i} x={sx(p.d)} y={H - 14} fill="rgba(168,179,145,0.6)" fontSize={12} textAnchor="middle">{mode === "month" ? fmtMonth(p.d) : fmtDate(p.d)}</text>
          ) : null)}
          {showUsers && <path d={area("users")} fill="url(#g-users)" />}
          <path d={area("courses")} fill="url(#g-courses)" />
          {showUsers && <path d={path("users")} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
          <path d={path("courses")} fill="none" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* hover capture */}
          {pts.map((p, i) => (
            <rect key={i} x={sx(p.d) - (gw / pts.length) / 2} y={padT} width={gw / pts.length} height={gh} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
          {ht && (
            <g>
              <line x1={sx(ht.d)} y1={padT} x2={sx(ht.d)} y2={padT + gh} stroke="rgba(245,237,225,0.2)" strokeWidth={1} />
              <circle cx={sx(ht.d)} cy={sy(ht.courses)} r={4} fill={GOLD} stroke="#16221b" strokeWidth={1.5} />
              {showUsers && <circle cx={sx(ht.d)} cy={sy(ht.users)} r={4} fill={BLUE} stroke="#16221b" strokeWidth={1.5} />}
            </g>
          )}
        </svg>
        {ht && (
          <div className="pointer-events-none absolute top-2 rounded-xl border border-white/10 bg-black/85 px-3 py-2 text-xs backdrop-blur" style={{ left: `${(sx(ht.d) / W) * 100}%`, transform: "translateX(-50%)" }}>
            <div className="font-semibold text-[var(--cream)]">{new Date(ht.d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
            <div className="mt-0.5" style={{ color: GOLD }}>{ht.courses.toLocaleString()} courses</div>
            {showUsers && <div style={{ color: BLUE }}>{ht.users.toLocaleString()} users</div>}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--sage-dim)]">
        {showUsers ? (
          <>Cumulative totals, updated hourly. The users line plots {data.usersDated.toLocaleString()} accounts with a recorded signup date{data.usersTotal > data.usersDated ? <> (of {data.usersTotal.toLocaleString()} total)</> : null}.</>
        ) : (
          <>Cumulative courses built, updated hourly. <span className="text-[var(--text-body)]">A users line will appear automatically once accounts carry a real signup date</span> — today only {data.usersDated.toLocaleString()} of {data.usersTotal.toLocaleString()} do (and they&apos;re bunched in a backfill window), so plotting it would mislead. Have Android write <code className="text-[var(--text-body)]">createdAt</code> (ms epoch) once at signup and this turns on by itself.</>
        )}
      </p>
    </div>
  );
}
