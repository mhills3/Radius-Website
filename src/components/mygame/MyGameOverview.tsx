"use client";

import { useEffect, useMemo, useState } from "react";
import { getDashboard, type Dashboard } from "@/lib/account";
import { getDecodedRounds, computeCareerStats, computeStrokesGained, rankedCategories, type DecodedRound, type CareerStats, type StrokesGained } from "@/lib/rounds";
import { getPutterDiscNames, getDiscCatalog, type DbDisc } from "@/lib/bag";
import { getPracticeSessions, type RangeSession } from "@/lib/sessions";
import { rankLabel, resolveRating } from "@/lib/rank";
import GameVisuals from "@/components/mygame/GameVisuals";
import { usePro } from "@/lib/usePro";

const HEAD = "font-[family-name:var(--font-heading)]";
const fmtToParAvg = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`);

export default function MyGameOverview({ uid }: { uid: string }) {
  const pro = usePro();
  const [dash, setDash] = useState<Dashboard | null | undefined>(undefined);
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [range, setRange] = useState<RangeSession[]>([]);
  const [catalog, setCatalog] = useState<DbDisc[]>([]);
  const [putterNames, setPutterNames] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    getDashboard(uid).then((d) => alive && setDash(d)).catch(() => alive && setDash(null));
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getPutterDiscNames().then((s) => alive && setPutterNames(s)).catch(() => {});
    getDiscCatalog().then((c) => alive && setCatalog(c)).catch(() => {});
    getPracticeSessions(uid).then((s) => alive && setRange(s.range)).catch(() => {});
    return () => { alive = false; };
  }, [uid]);

  const career: CareerStats | null = useMemo(() => (rounds ? computeCareerStats(rounds, putterNames) : null), [rounds, putterNames]);
  const sg: StrokesGained | null = useMemo(() => (rounds ? computeStrokesGained(rounds, putterNames) : null), [rounds, putterNames]);

  if (dash === undefined || rounds === null) {
    return <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }
  if (!dash || !career || career.rounds === 0 || !sg) {
    return <div className="flex min-h-[40vh] flex-col items-center justify-center text-center text-[var(--cream)]"><h2 className={`${HEAD} text-2xl font-extrabold`}>No stats yet</h2><p className="mt-2 max-w-md text-[var(--text-body)]">Play a round in the Radius app and your Radius Rating, drives, hole map and strokes-gained show up here.</p></div>;
  }

  // Radius Rating with Game IQ fallback — drives the hero number, tier, and label.
  const disp = resolveRating({ radiusRating: dash.radiusRating, radiusRatingProvisional: dash.radiusRatingProvisional, gameIQ: dash.iqCurrent });
  const leak = rankedCategories(sg).filter((c) => c.eligible)[0];
  const rankText = rankLabel(disp.rank);
  const meta = `${career.rounds} round${career.rounds === 1 ? "" : "s"} · ${fmtToParAvg(career.avgToPar)} avg`;
  const insight = `You hit ${sg.teeFairwayPct}% of fairways and make ${sg.c1xPct}% inside the circle.${leak ? ` The strokes leak from your ${leak.name.toLowerCase()} — that's where the round is decided.` : ""}`;

  return <GameVisuals rating={disp} rankText={rankText} meta={meta} insight={insight} rounds={rounds} range={range} catalog={catalog} putterNames={putterNames} pro={pro} />;
}
