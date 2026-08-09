"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCourseScores, type Course, type CourseScore } from "@/lib/courses";

const fmtPar = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const parColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "#c9c3b4" : n <= 5 ? "#ea8b3a" : "#f08c8c");

const BUCKETS: { label: string; test: (n: number) => boolean }[] = [
  { label: "Under par", test: (n) => n < 0 },
  { label: "Even – +5", test: (n) => n >= 0 && n <= 5 },
  { label: "+6 – +10", test: (n) => n >= 6 && n <= 10 },
  { label: "+11 – +20", test: (n) => n >= 11 && n <= 20 },
  { label: "+21 – +30", test: (n) => n >= 21 && n <= 30 },
  { label: "+30 plus", test: (n) => n > 30 },
];

export default function CourseAnalytics({ course }: { course: Course }) {
  const [scores, setScores] = useState<CourseScore[] | null>(null);

  useEffect(() => {
    let alive = true;
    getCourseScores(course.id, 500).then((s) => { if (alive) setScores(s); }).catch(() => { if (alive) setScores([]); });
    return () => { alive = false; };
  }, [course.id]);

  if (scores === null) return <div className="h-40 animate-pulse rounded-xl bg-[var(--c-raise)]" />;

  const players = scores.length;
  const avg = players ? Math.round(scores.reduce((s, x) => s + x.relativeToPar, 0) / players) : 0;
  const best = players ? scores[0] : null;
  const dist = BUCKETS.map((b) => ({ label: b.label, n: scores.filter((s) => b.test(s.relativeToPar)).length }));
  const maxBucket = Math.max(1, ...dist.map((d) => d.n));

  if (players === 0) {
    return <p className="text-sm text-[var(--c-muted)]">No rounds logged here yet. Once players post scores, you&apos;ll see distribution and leaders.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Players", value: players },
          { label: "Avg score", value: fmtPar(avg) },
          { label: "Course record", value: best ? fmtPar(best.relativeToPar) : "—" },
          { label: "Rating", value: course.rating ? `★ ${course.rating.toFixed(1)}` : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--c-line)] bg-[var(--c-card)] p-3 text-center">
            <div className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[var(--c-ink)]">{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--c-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--c-muted)]">Score distribution</div>
        <div className="space-y-1.5">
          {dist.map((d) => (
            <div key={d.label} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-right text-[var(--c-body)]">{d.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-[var(--c-raise)]"><div className="h-full rounded bg-[var(--gold)]" style={{ width: `${(d.n / maxBucket) * 100}%` }} /></div>
              <span className="w-6 shrink-0 font-semibold text-[var(--c-body)]">{d.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--c-muted)]">Top players</div>
        <div className="divide-y divide-black/[0.06] rounded-xl border border-[var(--c-line)] bg-[var(--c-card)]">
          {scores.slice(0, 10).map((s, i) => (
            <div key={s.playerUid || s.playerName || i} className="flex items-center gap-3 px-3 py-2">
              <span className="w-5 shrink-0 text-center text-sm font-bold text-[var(--gold)]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                {s.playerHandle ? <Link href={`/u/${s.playerHandle}`} className="truncate text-sm font-semibold text-[var(--c-ink)] hover:text-[var(--gold)]">{s.playerName || `@${s.playerHandle}`}</Link> : <span className="truncate text-sm font-semibold text-[var(--c-ink)]">{s.playerName || "Player"}</span>}
                <span className="ml-2 text-xs text-[var(--c-muted)]">{s.holesPlayed ? `${s.holesPlayed} holes` : ""}</span>
              </div>
              <span className="shrink-0 font-[family-name:var(--font-heading)] text-base font-extrabold" style={{ color: parColor(s.relativeToPar) }}>{fmtPar(s.relativeToPar)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
