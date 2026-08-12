"use client";

import { useEffect, useMemo, useState } from "react";
import { getDecodedRounds, computeCareerStats, computeStrokesGained, rankedCategories, type DecodedRound } from "@/lib/rounds";
import { getPutterDiscNames } from "@/lib/bag";
import { usePro } from "@/lib/usePro";
import ProGate from "@/components/ProGate";

const HEAD = "font-[family-name:var(--font-heading)]";
const eyebrow = `${HEAD} text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sage-dim)]`;
const card = "rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6";

const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;

// Community putting benchmarks by skill tier (iOS puttingBenchmarkSheet): C1 = inside 33 ft, C2 = 33–66 ft.
type Tier = { name: string; start: number; end: number; color: string };
const C1_TIERS: Tier[] = [
  { name: "Beginner", start: 50, end: 65, color: "#cc5750" },
  { name: "Intermediate", start: 65, end: 80, color: "#e0873f" },
  { name: "Advanced", start: 80, end: 90, color: "#E8B560" },
  { name: "Pro", start: 90, end: 100, color: "#5fcf80" },
];
const C2_TIERS: Tier[] = [
  { name: "Beginner", start: 0, end: 5, color: "#cc5750" },
  { name: "Intermediate", start: 5, end: 15, color: "#e0873f" },
  { name: "Advanced", start: 15, end: 25, color: "#E8B560" },
  { name: "Pro", start: 25, end: 40, color: "#5fcf80" },
];
const hexA = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
function standing(pct: number, tiers: Tier[]): { name: string; color: string; next: string } {
  if (pct < tiers[0].start) return { name: "Developing", color: "var(--sage)", next: `${tiers[0].name} putting starts at ${tiers[0].start}%` };
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (pct >= tiers[i].start) { const nx = tiers[i + 1]; return { name: tiers[i].name, color: tiers[i].color, next: nx ? `${nx.name} starts at ${nx.start}%` : "elite territory — top of the ladder" }; }
  }
  return { name: tiers[0].name, color: tiers[0].color, next: "" };
}

// A make-% benchmark ladder: colored tier bands (the community by level) with the player's needle on it.
function BenchmarkBar({ title, sub, value, tiers, axisMax }: { title: string; sub: string; value: number | null; tiers: Tier[]; axisMax: number }) {
  const has = value != null;
  const userPct = has ? value * 100 : 0;
  const pos = Math.max(0, Math.min(100, (userPct / axisMax) * 100));
  const st = has ? standing(userPct, tiers) : null;
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span><span className={`${HEAD} text-[13.5px] font-bold text-[var(--cream)]`}>{title}</span> <span className="text-[11px] text-[var(--sage-dim)]">{sub}</span></span>
        <span className={`${HEAD} text-[16px] font-black`} style={{ ...MONO, color: has ? "var(--gold)" : "var(--sage-dim)" }}>{has ? `${Math.round(userPct)}%` : "—"}</span>
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-white/[0.06]" />
        {tiers.map((t) => (
          <div key={t.name} className="absolute top-1/2 h-2.5 -translate-y-1/2" style={{ left: `${(t.start / axisMax) * 100}%`, width: `${((t.end - t.start) / axisMax) * 100}%`, background: hexA(t.color, st?.name === t.name ? 0.9 : 0.4), borderRadius: 2 }} />
        ))}
        {has && <div className="absolute top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--cream)]" style={{ left: `${pos}%`, boxShadow: "0 0 0 2px rgba(19,30,24,0.9)" }} />}
      </div>
      {st ? <div className="mt-2 text-[11.5px] text-[var(--text-body)]">You&apos;re in the <span className="font-bold" style={{ color: st.color }}>{st.name}</span>{st.name !== "Developing" ? " range" : ""} · {st.next}</div>
          : <div className="mt-2 text-[11.5px] text-[var(--sage-dim)]">Track a putting-logged round to see where you land.</div>}
    </div>
  );
}

function PracticeTile({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[radial-gradient(circle_at_30%_20%,rgba(246,193,101,0.16),var(--bg-mid))] p-5">
      <div className={`${eyebrow} text-[var(--gold)]`}>Practice</div>
      <div className={`${HEAD} mt-1 text-lg font-extrabold text-[var(--cream)]`}>{title}</div>
      <div className="mt-0.5 text-[12px] text-[var(--sage-dim)]">{sub}</div>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-[var(--sage)]">
        Continue in the app
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3"><path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
    </div>
  );
}

export default function MyGameImprove({ uid }: { uid: string }) {
  const pro = usePro();
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [putterNames, setPutterNames] = useState<Set<string>>(new Set());
  useEffect(() => { let alive = true; getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([])); getPutterDiscNames().then((s) => alive && setPutterNames(s)).catch(() => {}); return () => { alive = false; }; }, [uid]);

  const career = useMemo(() => (rounds ? computeCareerStats(rounds, putterNames) : null), [rounds, putterNames]);
  // iOS strokes-gained focus: biggest leak = lowest sg among eligible categories, strength = highest.
  const sg = useMemo(() => (rounds ? computeStrokesGained(rounds, putterNames) : null), [rounds, putterNames]);
  const eligible = useMemo(() => (sg ? rankedCategories(sg).filter((c) => c.eligible) : []), [sg]);

  if (!rounds) return <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  const hasData = sg != null && sg.sgRounds > 0 && eligible.length >= 2;
  const leak = hasData ? eligible[0] : undefined;
  const strength = hasData ? eligible[eligible.length - 1] : undefined;

  return (
    <div className="space-y-5">
      {/* This week's focus */}
      <div className={card}>
        <div className={eyebrow}>This week&apos;s focus</div>
        <h2 className={`${HEAD} mt-2 text-2xl font-black leading-tight text-[var(--cream)]`}>
          {hasData && leak ? `Sharpen your ${leak.name.toLowerCase()}.` : "Track your shots and your focus builds itself."}
        </h2>
        {hasData && (
          <ProGate pro={pro} title="Unlock your numbers" blurb="See exactly where you're strong and where you're leaking strokes with Radius Pro." className="mt-4">
            <div className="grid gap-5 sm:grid-cols-2">
              {leak && <div className="rounded-2xl border border-[#e0733f]/25 bg-[#e0733f]/[0.06] p-4"><div className={`${eyebrow} text-[#eb9166]`}>Biggest leak</div><div className={`${HEAD} mt-1.5 text-lg font-black text-[var(--cream)]`}>{leak.name}</div><div className="mt-1 text-[12px] text-[var(--sage-dim)]">{leak.evidence}</div></div>}
              {strength && strength.id !== leak?.id && <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className={`${eyebrow} text-[var(--gold)]`}>Your strength</div><div className={`${HEAD} mt-1.5 text-lg font-black text-[var(--cream)]`}>{strength.name}</div><div className="mt-1 text-[12px] text-[var(--sage-dim)]">{strength.evidence}</div></div>}
            </div>
          </ProGate>
        )}
      </div>

      {/* Practice — app deep-links */}
      <div>
        <div className={`${eyebrow} mb-3`}>Practice modes</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PracticeTile title="Putting" sub="Structured C1/C2 sets, tracked over time" />
          <PracticeTile title="Driving range" sub="Dial in distance and shot shapes" />
        </div>
      </div>

      {/* Is it working */}
      <div className={card}>
        <div className={eyebrow}>Is it working</div>
        <p className="mt-1 text-sm text-[var(--text-body)]">Your on-course putting — the real test of practice.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div><div className={`${eyebrow} text-[var(--gold)]`}>C1 on course</div><div className={`${HEAD} mt-1 text-2xl font-black text-[var(--cream)]`}>{career?.c1.pct == null ? "—" : `${Math.round(career.c1.pct * 100)}%`}</div></div>
          <div><div className={`${eyebrow} text-[var(--gold)]`}>C2 on course</div><div className={`${HEAD} mt-1 text-2xl font-black text-[var(--cream)]`}>{career?.c2.pct == null ? "—" : `${Math.round(career.c2.pct * 100)}%`}</div></div>
          <div><div className={`${eyebrow} text-[var(--gold)]`}>Rounds tracked</div><div className={`${HEAD} mt-1 text-2xl font-black text-[var(--cream)]`}>{career?.rounds ?? 0}</div></div>
        </div>
      </div>

      {/* How you stack up — putting make% vs the community by level */}
      <div className={card}>
        <div className={eyebrow}>How you stack up</div>
        <p className="mt-1 text-sm text-[var(--text-body)]">Your make rate against the disc golf community, by skill level.</p>
        <div className="mt-5 space-y-5">
          <BenchmarkBar title="Circle 1" sub="inside 33 ft" value={career?.c1.pct ?? null} tiers={C1_TIERS} axisMax={100} />
          <BenchmarkBar title="Circle 2" sub="33–66 ft" value={career?.c2.pct ?? null} tiers={C2_TIERS} axisMax={45} />
        </div>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/[0.07] pt-4">
          {C1_TIERS.map((t) => (
            <span key={t.name} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: t.color }} /><span className="text-[10.5px] text-[var(--sage)]">{t.name}</span></span>
          ))}
        </div>
      </div>
    </div>
  );
}
