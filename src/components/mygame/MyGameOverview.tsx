"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboard, type Dashboard } from "@/lib/account";
import { getDecodedRounds, computeCareerStats, computeStrokesGained, rankedCategories, type DecodedRound, type CareerStats, type StrokesGained } from "@/lib/rounds";
import { getAllCourses, type Course } from "@/lib/courses";
import { getPutterDiscNames, getDiscCatalog, getBag, type DbDisc } from "@/lib/bag";
import type { BagDisc } from "@/components/scorecard/RoundPreviewCard";
import { getPracticeSessions, type RangeSession } from "@/lib/sessions";
import { rankForIQ, rankLabel } from "@/lib/rank";
import Scorecard from "@/components/dashboard/Scorecard";
import RoundPreviewCard from "@/components/scorecard/RoundPreviewCard";
import GameVisuals from "@/components/mygame/GameVisuals";

const HEAD = "font-[family-name:var(--font-heading)]";
const eyebrow = `${HEAD} text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sage-dim)]`;
const fmtToParAvg = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`);

export default function MyGameOverview({ uid }: { uid: string }) {
  const [dash, setDash] = useState<Dashboard | null | undefined>(undefined);
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [range, setRange] = useState<RangeSession[]>([]);
  const [catalog, setCatalog] = useState<DbDisc[]>([]);
  const [putterNames, setPutterNames] = useState<Set<string>>(new Set());
  const [discMap, setDiscMap] = useState<Map<string, BagDisc>>(new Map());
  const [open, setOpen] = useState<DecodedRound | null>(null);

  useEffect(() => {
    let alive = true;
    getDashboard(uid).then((d) => alive && setDash(d)).catch(() => alive && setDash(null));
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getAllCourses().then((c) => alive && setCourses(c)).catch(() => {});
    getPutterDiscNames().then((s) => alive && setPutterNames(s)).catch(() => {});
    getBag(uid).then((b) => alive && setDiscMap(new Map(b.discs.map((d) => [d.name.trim().toLowerCase(), { photoUrl: d.photoUrl, color: d.color, speed: d.speed }])))).catch(() => {});
    getDiscCatalog().then((c) => alive && setCatalog(c)).catch(() => {});
    getPracticeSessions(uid).then((s) => alive && setRange(s.range)).catch(() => {});
    return () => { alive = false; };
  }, [uid]);

  const career: CareerStats | null = useMemo(() => (rounds ? computeCareerStats(rounds, putterNames) : null), [rounds, putterNames]);
  const sg: StrokesGained | null = useMemo(() => (rounds ? computeStrokesGained(rounds, putterNames) : null), [rounds, putterNames]);
  const coverOf = useMemo(() => { const m = new Map<string, string>(); courses.forEach((c) => { const k = c.name.trim().toLowerCase(); if (c.coverPhotoUrl && !m.has(k)) m.set(k, c.coverPhotoUrl); }); return m; }, [courses]);
  const recent = useMemo(() => (rounds ? [...rounds].filter((r) => r.isComplete).sort((a, b) => b.date - a.date).slice(0, 8) : []), [rounds]);

  if (dash === undefined || rounds === null) {
    return <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }
  if (!dash || !career || career.rounds === 0 || !sg) {
    return <div className="flex min-h-[40vh] flex-col items-center justify-center text-center text-[var(--cream)]"><h2 className={`${HEAD} text-2xl font-extrabold`}>No stats yet</h2><p className="mt-2 max-w-md text-[var(--text-body)]">Play a round in the Radius app and your Game IQ, drives, hole map and strokes-gained show up here.</p></div>;
  }

  const iq = dash.iqCurrent ?? 0;
  const rank = rankForIQ(iq);
  const leak = rankedCategories(sg).filter((c) => c.eligible)[0];
  const rankText = rankLabel(rank);
  const meta = `${career.rounds} round${career.rounds === 1 ? "" : "s"} · ${fmtToParAvg(career.avgToPar)} avg`;
  const insight = `You hit ${sg.teeFairwayPct}% of fairways and make ${sg.c1xPct}% inside the circle.${leak ? ` The strokes leak from your ${leak.name.toLowerCase()} — that's where the round is decided.` : ""}`;

  return (
    <div className="space-y-8">
      <GameVisuals iq={iq} rankText={rankText} meta={meta} insight={insight} rounds={rounds} range={range} catalog={catalog} putterNames={putterNames} />

      <div className="border-t border-white/[0.06] pt-8">
        <div className={`${eyebrow} mb-3`}>Recent rounds</div>
        {recent.length === 0 ? (
          <p className="text-sm text-[var(--sage-dim)]">No rounds yet — play one in the Radius app and it&apos;ll appear here.</p>
        ) : (
          <div className="space-y-4">
            {recent.map((r) => <RoundPreviewCard key={r.roundId} round={r} cover={coverOf.get(r.courseName.trim().toLowerCase())} onClick={() => setOpen(r)} discMap={discMap} />)}
          </div>
        )}
      </div>

      {open && <Scorecard round={open} rounds={rounds ?? undefined} onClose={() => setOpen(null)} />}
    </div>
  );
}
