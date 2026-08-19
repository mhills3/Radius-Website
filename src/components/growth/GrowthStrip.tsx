"use client";

import { useState } from "react";
import type { GrowthData, GrowthPoint } from "@/lib/growth";

const GOLD = "#F6C165";
const BLUE = "#4d94fa";
const DAY = 86400000;
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const; // Inter numerals

type Mode = "week" | "month";

// cumulative daily points → per-period ADDED (cumulative always rises, so the delta is the signal).
function addedSeries(points: GrowthPoint[], mode: Mode) {
  if (points.length === 0) return [] as { d: number; courses: number; users: number }[];
  const keyOf = (d: number) => (mode === "week" ? Math.floor(d / (7 * DAY)) : new Date(d).getUTCFullYear() * 12 + new Date(d).getUTCMonth());
  const lastByKey = new Map<number, GrowthPoint>();
  for (const p of points) lastByKey.set(keyOf(p.d), p);
  const cum = [...lastByKey.values()].sort((a, b) => a.d - b.d);
  return cum.map((p, i) => ({ d: p.d, courses: Math.max(0, p.courses - (cum[i - 1]?.courses ?? 0)), users: Math.max(0, p.users - (cum[i - 1]?.users ?? 0)) }));
}
const fmtTick = (d: number, mode: Mode) => new Date(d).toLocaleDateString("en-US", mode === "month" ? { month: "short" } : { month: "short", day: "numeric" });
const fmtFull = (d: number, mode: Mode) => new Date(d).toLocaleDateString("en-US", mode === "month" ? { month: "long", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });

export default function GrowthStrip({ data }: { data: GrowthData }) {
  const [mode, setMode] = useState<Mode>("month");
  const [hover, setHover] = useState<number | null>(null);
  const pts = data.points;
  const latest = pts[pts.length - 1];
  const showUsers = data.usersUsable;

  const now = new Date();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  let beforeCourses = 0;
  for (const p of pts) { if (p.d < monthStart) beforeCourses = p.courses; else break; }
  const coursesThisMonth = latest ? latest.courses - beforeCourses : 0;

  const series = addedSeries(pts, mode).slice(mode === "month" ? -12 : -16);
  const maxV = Math.max(1, ...series.map((s) => (showUsers ? Math.max(s.courses, s.users) : s.courses)));

  const W = 720, H = 184, padT = 12, padB = 26, padL = 40;
  const gw = W - padL;
  const gh = H - padT - padB;
  const baseY = padT + gh;
  const n = series.length || 1;
  const slot = gw / n;
  // thicker bars, less dead space — especially with few periods (e.g. 5 months)
  const bw = showUsers ? Math.min(slot * 0.4, 46) : Math.min(slot * 0.64, 72);
  const pairGap = showUsers ? Math.max(2, bw * 0.12) : 0;
  // y-axis: a few nice ticks from 0 to the top
  const niceMax = (() => { const p = Math.pow(10, Math.floor(Math.log10(maxV || 1))); return Math.ceil(maxV / p) * p || 1; })();
  const yTicks = [0, niceMax / 2, niceMax];
  const yFor = (v: number) => baseY - (v / niceMax) * gh;
  const every = Math.max(1, Math.ceil(n / 8));
  const ht = hover != null ? series[hover] : null;

  const stat = (label: string, value: number) => (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--sage-dim)]">{label}</span>
      <b style={NUM} className="text-[19px] font-bold text-[var(--cream)]">{value.toLocaleString()}</b>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-7 gap-y-1.5">
          {stat("Courses", data.coursesTotal)}
          {stat("Users", data.usersTotal)}
          <div className="flex items-baseline gap-1.5 rounded-full bg-[var(--gold)]/10 px-3 py-1">
            <span className="text-[15px] font-bold text-[var(--gold)]">+</span>
            <b style={NUM} className="text-[17px] font-black text-[var(--gold)]">{coursesThisMonth.toLocaleString()}</b>
            <span className="text-[12px] font-semibold text-[var(--gold)]/80">courses this month</span>
          </div>
        </div>
        <div className="inline-flex rounded-full bg-white/[0.05] p-1">
          {(["week", "month"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${mode === m ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{m === "week" ? "Weekly" : "Monthly"}</button>
          ))}
        </div>
      </div>

      <div className="relative mt-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" onMouseLeave={() => setHover(null)}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={padL} y1={yFor(v)} x2={W} y2={yFor(v)} stroke="rgba(245,237,225,0.07)" strokeDasharray={v === 0 ? undefined : "2 5"} />
              <text x={padL - 8} y={yFor(v) + 4} textAnchor="end" fontSize={11} fill="rgba(168,179,145,0.55)">{Math.round(v).toLocaleString()}</text>
            </g>
          ))}
          {series.map((s, i) => {
            const cx = padL + slot * (i + 0.5);
            const dim = hover != null && hover !== i;
            const ch = (s.courses / niceMax) * gh;
            if (showUsers) {
              const uh = (s.users / niceMax) * gh;
              return (
                <g key={i} opacity={dim ? 0.35 : 1} style={{ transition: "opacity .15s" }}>
                  <rect x={cx - bw - pairGap / 2} y={baseY - ch} width={bw} height={ch} rx={2.5} fill={GOLD} />
                  <rect x={cx + pairGap / 2} y={baseY - uh} width={bw} height={uh} rx={2.5} fill={BLUE} />
                </g>
              );
            }
            return <rect key={i} x={cx - bw / 2} y={baseY - ch} width={bw} height={ch} rx={2} fill={GOLD} opacity={dim ? 0.35 : 1} style={{ transition: "opacity .15s" }} />;
          })}
          {series.map((s, i) => (i % every === 0 || i === n - 1 ? (
            <text key={`t${i}`} x={padL + slot * (i + 0.5)} y={H - 8} textAnchor="middle" fontSize={12} fill="rgba(168,179,145,0.55)">{fmtTick(s.d, mode)}</text>
          ) : null))}
          {series.map((s, i) => (
            <rect key={`h${i}`} x={padL + slot * i} y={0} width={slot} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        {ht && hover != null && (
          <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-black/85 px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7)] backdrop-blur" style={{ left: `${((padL + slot * (hover + 0.5)) / W) * 100}%` }}>
            <div className="font-semibold text-[var(--cream)]">{fmtFull(ht.d, mode)}</div>
            <div className="mt-0.5" style={{ color: GOLD }}>+{ht.courses.toLocaleString()} courses</div>
            {showUsers && <div style={{ color: BLUE }}>+{ht.users.toLocaleString()} users</div>}
          </div>
        )}
      </div>
    </div>
  );
}
