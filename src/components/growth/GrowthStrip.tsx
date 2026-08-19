"use client";

import { useState } from "react";
import type { GrowthData, GrowthPoint } from "@/lib/growth";

const GOLD = "#F6C165";
const BLUE = "#4d94fa";
const DAY = 86400000;
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const; // Inter numerals

type Mode = "week" | "month";

// cumulative daily points → per-period ADDED (the only interesting figure; cumulative always rises).
function addedSeries(points: GrowthPoint[], mode: Mode) {
  if (points.length === 0) return [] as { d: number; courses: number; users: number }[];
  const keyOf = (d: number) => (mode === "week" ? Math.floor(d / (7 * DAY)) : new Date(d).getUTCFullYear() * 12 + new Date(d).getUTCMonth());
  const lastByKey = new Map<number, GrowthPoint>();
  for (const p of points) lastByKey.set(keyOf(p.d), p);
  const cum = [...lastByKey.values()].sort((a, b) => a.d - b.d);
  return cum.map((p, i) => ({ d: p.d, courses: Math.max(0, p.courses - (cum[i - 1]?.courses ?? 0)), users: Math.max(0, p.users - (cum[i - 1]?.users ?? 0)) }));
}

export default function GrowthStrip({ data }: { data: GrowthData }) {
  const [mode, setMode] = useState<Mode>("month");
  const pts = data.points;
  const latest = pts[pts.length - 1];
  const showUsers = data.usersUsable;

  // "added this month" — courses are reliable; users only once the users line is usable.
  const now = new Date();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  let beforeCourses = 0;
  for (const p of pts) { if (p.d < monthStart) beforeCourses = p.courses; else break; }
  const coursesThisMonth = latest ? latest.courses - beforeCourses : 0;

  const series = addedSeries(pts, mode).slice(-12);
  const maxV = Math.max(1, ...series.map((s) => (showUsers ? Math.max(s.courses, s.users) : s.courses)));

  const W = 640, H = 92;
  const n = series.length || 1;
  const slot = W / n;
  const bw = showUsers ? Math.min(slot * 0.34, 16) : Math.min(slot * 0.5, 24);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px] text-[var(--text-body)]">
          <span>Courses <b style={NUM} className="text-[var(--cream)]">{data.coursesTotal.toLocaleString()}</b></span>
          <span>Users <b style={NUM} className="text-[var(--cream)]">{data.usersTotal.toLocaleString()}</b></span>
          <span className="font-semibold text-[var(--gold)]">+<b style={NUM}>{coursesThisMonth.toLocaleString()}</b> courses this month</span>
        </div>
        <div className="inline-flex rounded-full bg-white/[0.05] p-1">
          {(["week", "month"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 text-[12px] font-bold transition-colors ${mode === m ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{m === "week" ? "Weekly" : "Monthly"}</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full">
        {series.map((s, i) => {
          const cx = slot * (i + 0.5);
          const ch = (s.courses / maxV) * H;
          const newest = i === series.length - 1;
          if (showUsers) {
            const uh = (s.users / maxV) * H;
            return (
              <g key={i} opacity={newest ? 1 : 0.9}>
                <rect x={cx - bw - 1} y={H - ch} width={bw} height={ch} rx={1.5} fill={GOLD} />
                <rect x={cx + 1} y={H - uh} width={bw} height={uh} rx={1.5} fill={BLUE} />
              </g>
            );
          }
          return <rect key={i} x={cx - bw / 2} y={H - ch} width={bw} height={ch} rx={1.5} fill={GOLD} opacity={newest ? 1 : 0.82} />;
        })}
      </svg>
    </div>
  );
}
