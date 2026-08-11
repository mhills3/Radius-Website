"use client";

import { useEffect, useMemo, useState } from "react";
import { getDecodedRounds, computeCareerStats, type DecodedRound, type CareerStats } from "@/lib/rounds";
import { usePro } from "@/lib/usePro";
import ProGate from "@/components/ProGate";

const HEAD = "font-[family-name:var(--font-heading)]";
const eyebrow = `${HEAD} text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sage-dim)]`;
const card = "rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6";
const pctInt = (v: number | null) => (v == null ? null : Math.round(v * 100));

type Skill = { label: string; value: number; benchmark: number; note: string };

function skillsFrom(c: CareerStats): Skill[] {
  const out: Skill[] = [];
  if (c.c1.pct != null) out.push({ label: "Putting (C1)", value: c.c1.pct, benchmark: 0.7, note: `${c.c1.made}/${c.c1.att} inside 33 ft` });
  if (c.fairwayPct != null) out.push({ label: "Off the tee", value: c.fairwayPct, benchmark: 0.6, note: "tees in play" });
  if (c.obRate != null) out.push({ label: "Avoiding OB", value: 1 - c.obRate, benchmark: 0.92, note: `${pctInt(c.obRate)}% OB rate` });
  if (c.scramblePct != null) out.push({ label: "Scrambling", value: c.scramblePct, benchmark: 0.4, note: "saves after trouble" });
  return out;
}

function Bar({ skill, tone }: { skill: Skill; tone: "gold" | "red" }) {
  const color = tone === "gold" ? "var(--gold)" : "#e0733f";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-bold text-[var(--cream)]">{skill.label}</span>
        <span className={`${HEAD} text-lg font-black`} style={{ color }}>{Math.round(skill.value * 100)}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, skill.value * 100)}%`, background: color }} /></div>
      <div className="mt-1 text-[11px] text-[var(--sage-dim)]">{skill.note}</div>
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
  useEffect(() => { let alive = true; getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([])); return () => { alive = false; }; }, [uid]);

  const career = useMemo(() => (rounds ? computeCareerStats(rounds) : null), [rounds]);
  const skills = useMemo(() => (career ? skillsFrom(career) : []), [career]);
  const ranked = useMemo(() => [...skills].map((s) => ({ ...s, gap: s.benchmark - s.value })).sort((a, b) => b.gap - a.gap), [skills]);
  const leak = ranked[0];
  const strength = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  if (!rounds) return <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  const hasData = skills.length > 0;

  return (
    <div className="space-y-5">
      {/* This week's focus */}
      <div className={card}>
        <div className={eyebrow}>This week&apos;s focus</div>
        <h2 className={`${HEAD} mt-2 text-2xl font-black leading-tight text-[var(--cream)]`}>
          {hasData ? `Sharpen your ${leak.label.toLowerCase()}.` : "Track your shots and your focus builds itself."}
        </h2>
        {hasData && (
          <ProGate pro={pro} title="Unlock your numbers" blurb="See exactly where you're strong and where you're leaking strokes with Radius Pro." className="mt-4">
            <div className="grid gap-5 sm:grid-cols-2">
              {leak && <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className={`${eyebrow} text-[#e0733f]`}>Biggest leak</div><div className="mt-2"><Bar skill={leak} tone="red" /></div></div>}
              {strength && <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><div className={`${eyebrow} text-[var(--gold)]`}>Your strength</div><div className="mt-2"><Bar skill={strength} tone="gold" /></div></div>}
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
    </div>
  );
}
