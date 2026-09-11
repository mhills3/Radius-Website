"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PILOT_AS_OF, TOTALS, ARM_SPEED, STYLE, HAND, GENDER, GENDER_SET, MAX_DISTANCE,
  RATING_TIERS, BRAND_SHARE, TOP_MOLDS, type Slice,
} from "@/lib/insightsPilot";
import { getLiveInsights, type LiveInsights } from "@/lib/insightsLive";

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;
const GOLD = "var(--gold)";
const pctOf = (n: number, total: number) => (total ? (n / total) * 100 : 0);
const fmtPct = (p: number) => (p >= 10 ? Math.round(p) : p.toFixed(1).replace(/\.0$/, ""));
const sum = (s: { n: number }[]) => s.reduce((a, b) => a + b.n, 0);

// per-context palettes so live (colourless) + baked data look identical
const ARM_C: Record<string, string> = { Intermediate: "#f6c165", Recreational: "#8fd3a6", Advanced: "#6fb2ff", Beginner: "#b78c59", Pro: "#d98cf0" };
const STYLE_C: Record<string, string> = { Backhand: "#f6c165", Both: "#6fb2ff", Forehand: "#ef8f6b" };
const HAND_C: Record<string, string> = { Right: "#8fd3a6", Left: "#d98cf0" };
const GENDER_C: Record<string, string> = { Male: "#6fb2ff", Female: "#f6a8c0" };
const TIER_C: Record<string, string> = { Rookie: "#b78c59", Amateur: "#a6adb8", Competitor: "#8fd3a6", Advanced: "#8cc7eb", Pro: "#a673d9", Champion: "#d9404d" };
const paint = (s: { label: string; n: number }[], c: Record<string, string>): Slice[] => s.map((x) => ({ ...x, color: c[x.label] || GOLD }));

interface View {
  live: boolean; asOf: string; updatedAt?: number;
  totals: typeof TOTALS;
  arm: Slice[]; style: Slice[]; hand: Slice[]; gender: Slice[]; genderSet: number;
  maxDistance: Slice[]; ratingTiers: Slice[];
  brandShare: { label: string; n: number }[]; topMolds: { name: string; brand: string; n: number }[];
  putting: LiveInsights["putting"] | null;
  scoring: NonNullable<LiveInsights["scoring"]> | null;
}

const bakedView = (): View => ({
  live: false, asOf: PILOT_AS_OF, totals: TOTALS,
  arm: ARM_SPEED, style: STYLE, hand: HAND, gender: GENDER, genderSet: GENDER_SET,
  maxDistance: paint(MAX_DISTANCE, {}), ratingTiers: RATING_TIERS,
  brandShare: BRAND_SHARE, topMolds: TOP_MOLDS, putting: null, scoring: null,
});
const liveView = (d: LiveInsights): View => ({
  live: true, asOf: d.asOf, updatedAt: d.updatedAt, totals: d.totals,
  arm: paint(d.base.armSpeed, ARM_C), style: paint(d.base.style, STYLE_C), hand: paint(d.base.hand, HAND_C),
  gender: paint(d.base.gender.slices, GENDER_C), genderSet: d.base.gender.set,
  maxDistance: paint(d.base.maxDistance, {}), ratingTiers: paint(d.base.ratingTiers, TIER_C),
  brandShare: d.base.brandShare, topMolds: d.base.topMolds,
  putting: d.putting && d.putting.coverage.zonedMisses > 0 ? d.putting : null,
  scoring: d.scoring && d.scoring.byPar.length > 0 ? d.scoring : null,
});

// ── generic panels ──────────────────────────────────────────────────────────
function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0e1612]/55 p-5 backdrop-blur-md">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className={`${HEAD} text-[15px] font-bold text-[var(--cream)]`}>{title}</h3>
        {sub && <span className="shrink-0 text-[11px] font-semibold text-[var(--sage-dim)]">{sub}</span>}
      </div>
      {children}
    </div>
  );
}
function RankBars({ items, total, denomLabel, accent, showBrand }: { items: (Slice & { brand?: string })[]; total: number; denomLabel?: string; accent?: string; showBrand?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-3">
          <span style={NUM} className="w-4 shrink-0 text-right text-[11px] font-bold text-[var(--sage-dim)]">{i + 1}</span>
          <div className="w-[128px] shrink-0 truncate text-[13px] text-[var(--cream)]">{it.label}{showBrand && it.brand && <span className="text-[var(--sage-dim)]"> · {it.brand}</span>}</div>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (it.n / max) * 100)}%`, background: accent || GOLD }} /></div>
          <span style={NUM} className="w-[52px] shrink-0 text-right text-[12.5px] font-semibold text-[var(--sage)]">{fmtPct(pctOf(it.n, total))}%</span>
        </div>
      ))}
      {denomLabel && <div className="pt-1 text-[11px] text-[var(--sage-dim)]">{denomLabel}</div>}
    </div>
  );
}
function SplitBar({ items, denom }: { items: Slice[]; denom?: string }) {
  const total = sum(items);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {items.map((it) => <div key={it.label} style={{ width: `${pctOf(it.n, total)}%`, background: it.color || GOLD }} title={`${it.label} ${fmtPct(pctOf(it.n, total))}%`} />)}
      </div>
      <div className="mt-3 space-y-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: it.color || GOLD }} />
            <span className="flex-1 text-[13px] text-[var(--cream)]">{it.label}</span>
            <span style={NUM} className="text-[13px] font-semibold text-[var(--sage)]">{fmtPct(pctOf(it.n, total))}%</span>
            <span style={NUM} className="w-[52px] text-right text-[11px] text-[var(--sage-dim)]">{it.n.toLocaleString()}</span>
          </div>
        ))}
      </div>
      {denom && <div className="mt-2.5 text-[11px] text-[var(--sage-dim)]">{denom}</div>}
    </div>
  );
}
function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0e1612]/50 px-4 py-4 text-center backdrop-blur-md">
      <div style={{ ...NUM, color: accent || "var(--cream)" }} className={`${HEAD} text-[26px] font-black leading-none tracking-[-0.02em]`}>{value}</div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">{label}</div>
    </div>
  );
}

// ── putting heat map (live) ──────────────────────────────────────────────────
const CELL_LABEL: Record<string, string> = {
  "high-left": "long-left", high: "long", "high-right": "long-right",
  left: "left", center: "center", right: "right",
  "low-left": "short-left", low: "short", "low-right": "short-right",
};
function PuttingLive({ p }: { p: NonNullable<View["putting"]> }) {
  const maxPct = Math.max(...p.grid.map((g) => g.pct), 1);
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/20 bg-[#0e1612]/55 p-6 backdrop-blur-md sm:p-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className={`${HEAD} text-[20px] font-extrabold text-[var(--cream)]`}>Putting misses — where the whole sport misses</h3>
        <span className="rounded-full border border-[var(--gold)]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>Live · {p.coverage.zonedMisses.toLocaleString()} misses</span>
      </div>
      <div className="mt-5 grid items-start gap-8 lg:grid-cols-[auto_1fr]">
        {/* the 3×3 heat grid */}
        <div className="mx-auto w-[220px] shrink-0">
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            {p.grid.map((g) => {
              const a = 0.12 + 0.78 * (g.pct / maxPct);
              return (
                <div key={g.cell} className="grid aspect-square place-items-center rounded-md border border-white/[0.08] text-center" style={{ background: `rgba(246,193,101,${a.toFixed(3)})` }}>
                  <div>
                    <div style={NUM} className="text-[15px] font-black text-[#141b16]">{fmtPct(g.pct)}%</div>
                    <div className="text-[8px] font-bold uppercase tracking-wide text-[#141b16]/70">{CELL_LABEL[g.cell]}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-center text-[11px] text-[var(--sage-dim)]">share of missed putts · viewed toward basket</div>
        </div>
        {/* readouts */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Most common miss</div>
              <div className={`${HEAD} mt-0.5 text-[18px] font-extrabold text-[var(--cream)]`}>{p.mostCommon.cell ? CELL_LABEL[p.mostCommon.cell] : "—"} <span style={NUM} className="text-[var(--gold)]">{fmtPct(p.mostCommon.pct)}%</span></div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Make rate</div>
              <div style={NUM} className={`${HEAD} mt-0.5 text-[18px] font-extrabold text-[var(--cream)]`}>C1 {fmtPct(p.makeRate.C1)}% · C2 {fmtPct(p.makeRate.C2)}%</div>
            </div>
          </div>
          {/* L/R bias */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-[var(--sage)]"><span>Miss left {fmtPct(p.missLeftPct)}%</span><span>{fmtPct(p.missRightPct)}% miss right</span></div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div style={{ width: `${p.missLeftPct}%`, background: "#6fb2ff" }} /><div style={{ width: `${p.missRightPct}%`, background: "#ef8f6b" }} />
            </div>
          </div>
          {/* by arm speed */}
          {p.byArm.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">By arm speed — make % · miss L/R</div>
              <div className="space-y-1">
                {p.byArm.map((a) => (
                  <div key={a.arm} className="flex items-center gap-3 text-[13px]">
                    <span className="w-[104px] shrink-0 text-[var(--cream)]">{a.arm}</span>
                    <span style={NUM} className="w-[52px] shrink-0 font-semibold text-[var(--gold)]">{fmtPct(a.makePct)}%</span>
                    <span style={NUM} className="text-[var(--sage-dim)]">{fmtPct(a.missLeftPct)}L / {fmtPct(a.missRightPct)}R</span>
                    <span style={NUM} className="ml-auto text-[11px] text-[var(--sage-dim)]">{a.attempts.toLocaleString()} putts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* per-putter */}
      {p.perPutter.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Per putter — make % · miss bias (the per-disc money view)</div>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {p.perPutter.map((d) => (
              <div key={d.disc} className="flex items-center gap-3 text-[13px]">
                <span className="w-[132px] shrink-0 truncate text-[var(--cream)]">{d.disc}{d.brand && <span className="text-[var(--sage-dim)]"> · {d.brand}</span>}</span>
                <span style={NUM} className="w-[48px] shrink-0 font-semibold text-[var(--gold)]">{fmtPct(d.makePct)}%</span>
                <span style={NUM} className="text-[var(--sage-dim)]">{fmtPct(d.missLeftPct)}L / {fmtPct(d.missRightPct)}R</span>
                <span style={NUM} className="ml-auto text-[11px] text-[var(--sage-dim)]">{d.attempts.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PuttingLocked() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/20 bg-[#0e1612]/55 p-6 backdrop-blur-md sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
        <div className="mx-auto w-[168px] shrink-0">
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`grid aspect-square place-items-center rounded-md border text-[10px] font-bold uppercase tracking-wide ${i === 4 ? "border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold)]" : "border-white/[0.08] bg-white/[0.03] text-[var(--sage-dim)]"}`}>{i === 4 ? "make" : ""}</div>
            ))}
          </div>
          <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Miss heat · 3×3</div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className={`${HEAD} text-[20px] font-extrabold text-[var(--cream)]`}>Putting misses — where the whole sport misses</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--gold)]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              Awaiting first run
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--text-body)]">
            The flagship nobody else has: every logged C1/C2 putt, aggregated to a miss-direction heat map — <b className="text-[var(--cream)]">left / right / short / long</b> — sliced by distance band, arm speed, and disc. This fills in automatically the first time the monthly snapshot runs.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {["Most common miss %", "By distance band", "By arm speed", "Per-disc miss bias", "Make % C1 / C2"].map((t) => <span key={t} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[12px] font-medium text-[var(--sage-dim)]">{t}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── scoring (live) ───────────────────────────────────────────────────────────
const SCORE_SEG = [
  { key: "birdiePct" as const, label: "Birdie+", c: "#8fe0a5" },
  { key: "parPct" as const, label: "Par", c: "#6fb2ff" },
  { key: "bogeyPct" as const, label: "Bogey", c: "#f0c069" },
  { key: "dblPct" as const, label: "Double+", c: "#ef7f7f" },
];
function ScoringSection({ s }: { s: NonNullable<View["scoring"]> }) {
  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-2.5"><span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--sage)]`}>How the sport scores</span><span className="h-px flex-1 bg-[var(--hair)]" /></div>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* by par */}
        <Panel title="Scoring by par" sub="birdie / par / bogey">
          <div className="space-y-3.5">
            {s.byPar.map((r) => (
              <div key={r.par}>
                <div className="mb-1 flex items-baseline justify-between text-[12.5px]"><span className="font-semibold text-[var(--cream)]">Par {r.par}</span><span style={NUM} className="text-[var(--sage-dim)]">avg {r.avgToPar > 0 ? "+" : ""}{r.avgToPar} · {r.holes.toLocaleString()} holes</span></div>
                <div className="flex h-3 w-full overflow-hidden rounded-full">
                  {SCORE_SEG.map((seg) => <div key={seg.key} style={{ width: `${r[seg.key]}%`, background: seg.c }} title={`${seg.label} ${fmtPct(r[seg.key])}%`} />)}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
              {SCORE_SEG.map((seg) => <span key={seg.key} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--sage)]"><span className="h-2 w-2 rounded-[2px]" style={{ background: seg.c }} />{seg.label}</span>)}
            </div>
          </div>
        </Panel>
        {/* by distance */}
        <Panel title="Scoring by hole length" sub="birdie rate">
          <div className="space-y-2.5">
            {s.byDistance.map((r) => {
              const max = Math.max(1, ...s.byDistance.map((x) => x.birdiePct));
              return (
                <div key={r.bucket} className="flex items-center gap-3">
                  <div className="w-[76px] shrink-0 text-[12.5px] text-[var(--cream)]">{r.bucket}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, (r.birdiePct / max) * 100)}%`, background: "#8fe0a5" }} /></div>
                  <span style={NUM} className="w-[40px] shrink-0 text-right text-[12px] font-semibold text-[var(--sage)]">{fmtPct(r.birdiePct)}%</span>
                  <span style={NUM} className="w-[42px] shrink-0 text-right text-[11px] text-[var(--sage-dim)]">{r.avgToPar > 0 ? "+" : ""}{r.avgToPar}</span>
                </div>
              );
            })}
            <div className="pt-1 text-[11px] text-[var(--sage-dim)]">Birdie rate + avg score to par, by tee-to-basket distance.</div>
          </div>
        </Panel>
        {/* result mix */}
        <Panel title="Shot result mix" sub={`${s.resultTotal.toLocaleString()} shots`}>
          <RankBars items={s.resultMix.map((r) => ({ label: r.label, n: r.n }))} total={s.resultTotal} accent="#bb95e8" denomLabel="Every logged throw by outcome." />
        </Panel>
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function InsightsDashboard() {
  const [v, setV] = useState<View>(bakedView);
  useEffect(() => { getLiveInsights().then((d) => { if (d) setV(liveView(d)); }).catch(() => {}); }, []);

  const brandTotal = sum(v.brandShare);
  const updated = v.updatedAt ? new Date(v.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : v.asOf;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">← The Circle</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em]`} style={{ color: GOLD }}>Radius Brand Insights</span>
            <span className="rounded-full border border-[var(--gold)]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>Pilot · internal</span>
          </div>
          <h1 className={`${HEAD} mt-2 text-[40px] font-black leading-none tracking-[-0.03em] text-[var(--cream)] sm:text-[48px]`}>The data room</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--sage)]">What we can see that nobody else in disc golf can. The shape of the product we sell to brands.</p>
        </div>
        <div className="text-right text-[12px] text-[var(--sage-dim)]">
          {v.live ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#5fcf80]/30 bg-[#5fcf80]/10 px-2.5 py-1 font-semibold text-[#8fe0a5]"><span className="h-1.5 w-1.5 rounded-full bg-[#5fcf80]" />Live · updated {updated}</div>
          ) : (
            <div>Snapshot · {v.asOf}<br />Baked pilot · awaiting first monthly run</div>
          )}
          <div className="mt-1.5 text-[11px] text-[var(--sage-dim)]">Refreshes automatically on the 1st of each month</div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat value={v.totals.players.toLocaleString()} label="Players" />
        <Stat value={v.totals.rounds.toLocaleString()} label="Rounds" />
        <Stat value={v.totals.activePlayers.toLocaleString()} label="Active (≥1 round)" />
        <Stat value={v.totals.proMembers.toLocaleString()} label="Pro members" accent={GOLD} />
        <Stat value={v.totals.bagSlots.toLocaleString()} label="Discs in bags" />
        <Stat value={String(v.totals.avgBagSize)} label="Avg bag size" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel title="Brand share of every bagged disc" sub={`${brandTotal.toLocaleString()} discs`}>
          <RankBars items={v.brandShare} total={brandTotal} accent={GOLD} denomLabel="Share of all brand-mapped discs in bags — the market-share read a brand can't get elsewhere." />
        </Panel>
        <Panel title="Most-bagged molds" sub={`${v.totals.withBag.toLocaleString()} bags`}>
          <RankBars items={v.topMolds.map((m) => ({ label: m.name, brand: m.brand, n: m.n }))} total={v.totals.withBag} showBrand accent="#8fd3a6" denomLabel="% of players carrying each mold." />
        </Panel>
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center gap-2.5"><span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--sage)]`}>Who plays Radius</span><span className="h-px flex-1 bg-[var(--hair)]" /></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Panel title="Arm speed" sub="onboarding"><SplitBar items={v.arm} denom={`${sum(v.arm).toLocaleString()} set an arm speed`} /></Panel>
          <Panel title="Throwing style" sub="onboarding"><SplitBar items={v.style} denom={`${sum(v.style).toLocaleString()} set a style`} /></Panel>
          <Panel title="Dominant hand" sub="onboarding"><SplitBar items={v.hand} denom={`${sum(v.hand).toLocaleString()} set a hand`} /></Panel>
          <Panel title="Gender" sub="self-reported"><SplitBar items={v.gender} denom={`${v.genderSet.toLocaleString()} of ${v.totals.players.toLocaleString()} report gender — heavily male, a real growth signal.`} /></Panel>
          <Panel title="Max distance" sub="self-reported"><RankBars items={v.maxDistance} total={sum(v.maxDistance)} accent="#6fb2ff" denomLabel="Most players top out 350–400 ft." /></Panel>
          <Panel title="Rating tiers" sub={`${v.totals.ratedPlayers} rated`}><SplitBar items={v.ratingTiers} denom={`Game IQ (live rating). Skews strong — only engaged players get a computed rating. Radius Rating is ${v.totals.ratingRolloutPct}% rolled out.`} /></Panel>
        </div>
      </div>

      {v.scoring && <ScoringSection s={v.scoring} />}

      <div className="mt-8">{v.putting ? <PuttingLive p={v.putting} /> : <PuttingLocked />}</div>

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--sage-dim)]">
        <b className="text-[var(--sage)]">How to read this.</b> Bags, arm speed, hand, style and gender come from onboarding, so their denominators are broad (6–9K). Rounds and ratings are activity data — {v.totals.activePlayers.toLocaleString()} players have logged a round, {v.totals.ratedPlayers} have a computed rating — so those panels describe the engaged core, not every signup. Every number is rolled-up; nothing is per-person. {v.live ? "Refreshes automatically on the 1st of each month." : "This is a baked pilot; the monthly snapshot replaces it with live shot-level data on its first run."}
      </p>
    </div>
  );
}
