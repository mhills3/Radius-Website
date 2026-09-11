"use client";

import Link from "next/link";
import {
  PILOT_AS_OF, TOTALS, ARM_SPEED, STYLE, HAND, GENDER, GENDER_SET, MAX_DISTANCE,
  RATING_TIERS, BRAND_SHARE, TOP_MOLDS, type Slice,
} from "@/lib/insightsPilot";

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;
const GOLD = "var(--gold)";
const pctOf = (n: number, total: number) => (total ? (n / total) * 100 : 0);
const fmtPct = (p: number) => (p >= 10 ? Math.round(p) : p.toFixed(1).replace(/\.0$/, ""));
const sum = (s: Slice[]) => s.reduce((a, b) => a + b.n, 0);

// ── panels ────────────────────────────────────────────────────────────────
function Panel({ title, sub, children, tall }: { title: string; sub?: string; children: React.ReactNode; tall?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#0e1612]/55 p-5 backdrop-blur-md ${tall ? "" : ""}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className={`${HEAD} text-[15px] font-bold text-[var(--cream)]`}>{title}</h3>
        {sub && <span className="shrink-0 text-[11px] font-semibold text-[var(--sage-dim)]">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

// horizontal ranked bars (brands, molds)
function RankBars({ items, total, denomLabel, accent, showBrand }: { items: (Slice & { brand?: string })[]; total: number; denomLabel?: string; accent?: string; showBrand?: boolean }) {
  const max = Math.max(...items.map((i) => i.n));
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => {
        const p = pctOf(it.n, total);
        return (
          <div key={it.label} className="flex items-center gap-3">
            <span style={NUM} className="w-4 shrink-0 text-right text-[11px] font-bold text-[var(--sage-dim)]">{i + 1}</span>
            <div className="w-[128px] shrink-0 truncate text-[13px] text-[var(--cream)]">
              {it.label}{showBrand && it.brand && <span className="text-[var(--sage-dim)]"> · {it.brand}</span>}
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${Math.max(3, (it.n / max) * 100)}%`, background: accent || GOLD }} />
            </div>
            <span style={NUM} className="w-[52px] shrink-0 text-right text-[12.5px] font-semibold text-[var(--sage)]">{fmtPct(p)}%</span>
          </div>
        );
      })}
      {denomLabel && <div className="pt-1 text-[11px] text-[var(--sage-dim)]">{denomLabel}</div>}
    </div>
  );
}

// stacked segmented bar + legend (splits)
function SplitBar({ items, denom }: { items: Slice[]; denom?: string }) {
  const total = sum(items);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {items.map((it) => (
          <div key={it.label} style={{ width: `${pctOf(it.n, total)}%`, background: it.color || GOLD }} title={`${it.label} ${fmtPct(pctOf(it.n, total))}%`} />
        ))}
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

export default function InsightsDashboard() {
  const brandTotal = sum(BRAND_SHARE);
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      {/* header */}
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">← The Circle</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em]`} style={{ color: GOLD }}>Radius Brand Insights</span>
            <span className="rounded-full border border-[var(--gold)]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>Pilot · internal</span>
          </div>
          <h1 className={`${HEAD} mt-2 text-[40px] font-black leading-none tracking-[-0.03em] text-[var(--cream)] sm:text-[48px]`}>The data room</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--sage)]">
            What we can see that nobody else in disc golf can. A baked pilot snapshot — the shape of the product we sell to brands.
          </p>
        </div>
        <div className="text-right text-[12px] text-[var(--sage-dim)]">
          <div>Snapshot · {PILOT_AS_OF}</div>
          <div>Hand-pulled · directional</div>
        </div>
      </div>

      {/* top stat row */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat value={TOTALS.players.toLocaleString()} label="Players" />
        <Stat value={TOTALS.rounds.toLocaleString()} label="Rounds" />
        <Stat value={TOTALS.activePlayers.toLocaleString()} label="Active (≥1 round)" />
        <Stat value={TOTALS.proMembers.toLocaleString()} label="Pro members" accent={GOLD} />
        <Stat value={TOTALS.bagSlots.toLocaleString()} label="Discs in bags" />
        <Stat value={String(TOTALS.avgBagSize)} label="Avg bag size" />
      </div>

      {/* the money view: brand share + molds */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Panel title="Brand share of every bagged disc" sub={`${brandTotal.toLocaleString()} discs`}>
          <RankBars items={BRAND_SHARE} total={brandTotal} accent={GOLD} denomLabel="Share of all brand-mapped discs in bags — the market-share read a brand can't get elsewhere." />
        </Panel>
        <Panel title="Most-bagged molds" sub={`${TOTALS.withBag.toLocaleString()} bags`}>
          <RankBars items={TOP_MOLDS.map((m) => ({ label: m.name, brand: m.brand, n: m.n }))} total={TOTALS.withBag} showBrand accent="#8fd3a6" denomLabel="% of players carrying each mold. Axiom lands 4 of the top 12 — punching above its size." />
        </Panel>
      </div>

      {/* who plays radius */}
      <div className="mt-4">
        <div className="mb-3 flex items-center gap-2.5">
          <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--sage)]`}>Who plays Radius</span>
          <span className="h-px flex-1 bg-[var(--hair)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Panel title="Arm speed" sub="onboarding"><SplitBar items={ARM_SPEED} denom={`${sum(ARM_SPEED).toLocaleString()} set an arm speed`} /></Panel>
          <Panel title="Throwing style" sub="onboarding"><SplitBar items={STYLE} denom={`${sum(STYLE).toLocaleString()} set a style`} /></Panel>
          <Panel title="Dominant hand" sub="onboarding"><SplitBar items={HAND} denom={`${sum(HAND).toLocaleString()} set a hand`} /></Panel>
          <Panel title="Gender" sub="self-reported">
            <SplitBar items={GENDER} denom={`${GENDER_SET.toLocaleString()} of ${TOTALS.players.toLocaleString()} report gender — heavily male, a real growth signal.`} />
          </Panel>
          <Panel title="Max distance" sub="self-reported">
            <RankBars items={MAX_DISTANCE} total={sum(MAX_DISTANCE)} accent="#6fb2ff" denomLabel="Most players top out 350–400 ft." />
          </Panel>
          <Panel title="Rating tiers" sub={`${TOTALS.ratedPlayers} rated`}>
            <SplitBar items={RATING_TIERS} denom={`Game IQ (live rating). Skews strong — only engaged players get a computed rating. Radius Rating is ${TOTALS.ratingRolloutPct}% rolled out.`} />
          </Panel>
        </div>
      </div>

      {/* flagship — locked until the pipeline lands */}
      <div className="mt-8">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/20 bg-[#0e1612]/55 p-6 backdrop-blur-md sm:p-8">
          <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr]">
            {/* the 3×3 miss grid schematic — no numbers, this is the shape only */}
            <div className="mx-auto w-[168px] shrink-0">
              <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className={`grid aspect-square place-items-center rounded-md border text-[10px] font-bold uppercase tracking-wide ${i === 4 ? "border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold)]" : "border-white/[0.08] bg-white/[0.03] text-[var(--sage-dim)]"}`}>
                    {i === 4 ? "make" : ""}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Miss heat · 3×3</div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className={`${HEAD} text-[20px] font-extrabold text-[var(--cream)]`}>Putting misses — where the whole sport misses</h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--gold)]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  Pipeline required
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--text-body)]">
                The flagship nobody else has: every logged C1/C2 putt, aggregated to a miss-direction heat map — <b className="text-[var(--cream)]">left / right / short / long</b> — sliced by distance band, arm speed, and disc.
                Which miss is most common, and how a mold’s misses differ from the field. This lives in shot-level round data, which isn’t in the readable user docs — it unlocks when the extraction pipeline runs with admin creds.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Most common miss %", "By distance band", "By arm speed", "Per-disc miss bias", "Make % C1 / C2"].map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[12px] font-medium text-[var(--sage-dim)]">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* methodology footer */}
      <p className="mt-8 text-[12px] leading-relaxed text-[var(--sage-dim)]">
        <b className="text-[var(--sage)]">How to read this.</b> Bags, arm speed, hand, style and gender come from onboarding, so their denominators are broad (6–9K). Rounds and ratings are activity data — {TOTALS.activePlayers.toLocaleString()} players have logged a round, {TOTALS.ratedPlayers} have a computed rating — so those panels describe the engaged core, not every signup. Every number is rolled-up; nothing is per-person. A hand-pulled pilot to prove the shape; the pipeline makes it live, authoritative, and adds the shot-level layers.
      </p>
    </div>
  );
}
