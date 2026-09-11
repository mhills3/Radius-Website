"use client";

// The Circle → "Roadmap: Goals, Milestones & Monetization" card.
// A private staff reminder of where we're taking Radius as a BUSINESS — not a queue, not live data.
// The pilot snapshot is a hand-pulled reading (see PILOT_AS_OF) so we have the shape of the data in
// our back pocket; the authoritative version will come from the extraction pipeline. Update the
// consts below by hand until that lands.

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;
const GOLD = "var(--gold)";

// ── milestones ────────────────────────────────────────────────────────────
const ROUNDS_NOW = 7018;
const ROUNDS_GOAL = 100_000; // the number where Brand Insights becomes properly sellable
const USERS_NOW = 9102;

// ── pilot snapshot (manual, 2026-09-10) ───────────────────────────────────
const PILOT_AS_OF = "Sep 10, 2026";
const BAG_SAMPLE = 4330; // users whose bag was readable for this pull
// most-bagged molds — count / share of the sample
const TOP_DISCS: { name: string; brand: string; n: number }[] = [
  { name: "Buzzz", brand: "Discraft", n: 1081 },
  { name: "Zone", brand: "Discraft", n: 976 },
  { name: "Destroyer", brand: "Innova", n: 912 },
  { name: "Trail", brand: "MVP", n: 754 },
  { name: "Hex", brand: "Axiom", n: 734 },
  { name: "Luna", brand: "Discraft", n: 586 },
  { name: "Wraith", brand: "Innova", n: 585 },
  { name: "Crave", brand: "Axiom", n: 564 },
];
// brand presence — total bag slots logged (directional share-of-bag)
const TOP_BRANDS: { name: string; n: number }[] = [
  { name: "Discraft", n: 9056 },
  { name: "Innova", n: 8277 },
  { name: "Axiom", n: 5100 },
  { name: "MVP", n: 4456 },
  { name: "Discmania", n: 3597 },
  { name: "Latitude 64", n: 2211 },
];
const ARM_SPLIT: { label: string; pct: number }[] = [
  { label: "Intermediate", pct: 50 },
  { label: "Recreational", pct: 26 },
  { label: "Advanced", pct: 16 },
  { label: "Beginner", pct: 6 },
  { label: "Pro", pct: 3 },
];

// ── what Brand Insights sells ─────────────────────────────────────────────
const INSIGHT_METRICS = [
  "% of bags each mold is in",
  "By arm speed & skill tier",
  "Most-bagged disc this month",
  "Added vs benched (retention)",
  "New-release adoption curve",
  "Real flight vs stamped numbers",
  "Miss bias — left / right",
];

// ── the monetization checklist (living) ───────────────────────────────────
type Status = "live" | "building" | "idea";
const PLAYS: { name: string; note: string; status: Status }[] = [
  { name: "Radius Brand Insights", note: "Per-brand data subscription — the play below", status: "idea" },
  { name: "Radius Pro", note: "Consumer subscription — Caddy, stats, analysis", status: "live" },
  { name: "Disc fitting → retail affiliate", note: "Recommend a disc, earn on the sale", status: "idea" },
  { name: "Course-demand intelligence", note: "Where players want courses → developers, parks & rec", status: "idea" },
  { name: '"State of the Bag" annual report', note: "Sponsored / PR flagship off the same data", status: "idea" },
  { name: "Leagues & Events premium", note: "Director tools + payments cut", status: "building" },
  { name: "Anonymized benchmark licensing", note: "Aggregate category data, non-exclusive", status: "idea" },
];
const DOT: Record<Status, { c: string; label: string }> = {
  live: { c: "#5fcf80", label: "Live" },
  building: { c: "#f0c069", label: "Building" },
  idea: { c: "var(--sage-dim)", label: "Idea" },
};

function Bar({ n, max, color }: { n: number; max: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full" style={{ width: `${Math.max(4, (n / max) * 100)}%`, background: color }} />
    </div>
  );
}

export default function RoadmapCard() {
  const pct = Math.round((ROUNDS_NOW / ROUNDS_GOAL) * 100);
  const discMax = TOP_DISCS[0].n;
  const brandMax = TOP_BRANDS[0].n;

  return (
    <div className="mt-14 overflow-hidden rounded-3xl border border-[var(--gold)]/20 bg-[#0e1612]/55 backdrop-blur-md">
      {/* header */}
      <div className="border-b border-white/[0.06] bg-[radial-gradient(120%_140%_at_0%_0%,rgba(246,193,101,0.10),transparent_60%)] px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="text-[16px] leading-none">🎯</span>
          <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em]`} style={{ color: GOLD }}>Roadmap</span>
        </div>
        <h2 className={`${HEAD} mt-1.5 text-[26px] font-black leading-tight tracking-[-0.02em] text-[var(--cream)]`}>Goals, Milestones & Monetization</h2>
        <p className="mt-1 text-[14px] text-[var(--sage)]">Where we take Radius beyond the user base. A reminder, not a queue.</p>
      </div>

      <div className="space-y-8 px-6 py-7 sm:px-8">
        {/* ── milestone: the road to 100K ── */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className={`${HEAD} text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--sage)]`}>Road to 100K rounds</span>
            <span style={NUM} className="text-[13px] font-semibold text-[var(--sage-dim)]">Brand Insights gets sellable here</span>
          </div>
          <div className="flex items-end gap-4">
            <div style={NUM} className={`${HEAD} text-[38px] font-black leading-none text-[var(--cream)]`}>{ROUNDS_NOW.toLocaleString()}</div>
            <div style={NUM} className="pb-1 text-[15px] font-semibold text-[var(--sage-dim)]">/ {ROUNDS_GOAL.toLocaleString()} · {pct}%</div>
            <div className="flex-1" />
            <div className="text-right">
              <div style={NUM} className={`${HEAD} text-[22px] font-extrabold leading-none text-[var(--cream)]`}>{USERS_NOW.toLocaleString()}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">players</div>
            </div>
          </div>
          <div className="mt-3"><Bar n={ROUNDS_NOW} max={ROUNDS_GOAL} color={`linear-gradient(90deg, var(--gold), var(--gold-bright, #ffd98a))`} /></div>
        </div>

        {/* ── the flagship play: Radius Brand Insights ── */}
        <div className="rounded-2xl border border-[var(--gold)]/15 bg-[var(--gold)]/[0.04] p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`${HEAD} text-[18px] font-extrabold text-[var(--cream)]`}>Radius Brand Insights</span>
            <span className="rounded-full border border-[var(--gold)]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>Flagship data play</span>
          </div>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--text-body)]">
            A monthly subscription for disc companies — a private dashboard into <b className="text-[var(--cream)]">their own</b> discs: who bags them,
            at what arm speed, how they actually fly, and what's rising or getting benched. Market intelligence they can't get anywhere else.
            Scales with players now; flight performance layers on as rounds densify. ~10–15 brands at recurring 4–5 figures each.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {INSIGHT_METRICS.map((m) => (
              <span key={m} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[12px] font-medium text-[var(--sage)]">{m}</span>
            ))}
          </div>
        </div>

        {/* ── two columns: checklist + pilot snapshot ── */}
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* monetization checklist */}
          <div>
            <div className={`${HEAD} mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--sage)]`}>Ways to monetize</div>
            <div className="space-y-2.5">
              {PLAYS.map((p) => (
                <div key={p.name} className="flex items-start gap-3">
                  <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[p.status].c }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14.5px] font-semibold text-[var(--cream)]">{p.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DOT[p.status].c }}>{DOT[p.status].label}</span>
                    </div>
                    <div className="text-[12.5px] leading-snug text-[var(--sage-dim)]">{p.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* pilot snapshot */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className={`${HEAD} text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--sage)]`}>Pilot snapshot</span>
              <span className="text-[11px] font-semibold text-[var(--sage-dim)]">{PILOT_AS_OF} · {BAG_SAMPLE.toLocaleString()} bags</span>
            </div>

            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Most-bagged molds</div>
            <div className="mt-2 space-y-2">
              {TOP_DISCS.map((d) => (
                <div key={d.name} className="flex items-center gap-3">
                  <div className="w-[132px] shrink-0 truncate text-[13px] text-[var(--cream)]">{d.name} <span className="text-[var(--sage-dim)]">· {d.brand}</span></div>
                  <div className="flex-1"><Bar n={d.n} max={discMax} color={GOLD} /></div>
                  <div style={NUM} className="w-[42px] shrink-0 text-right text-[12px] font-semibold text-[var(--sage)]">{Math.round((d.n / BAG_SAMPLE) * 100)}%</div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1.5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Top brands</div>
                <div className="mt-1.5 space-y-1">
                  {TOP_BRANDS.map((b, i) => (
                    <div key={b.name} className="flex items-center gap-2">
                      <span style={NUM} className="w-3 text-[11px] font-bold text-[var(--sage-dim)]">{i + 1}</span>
                      <span className="flex-1 text-[13px] text-[var(--cream)]">{b.name}</span>
                      <span style={NUM} className="text-[11px] text-[var(--sage-dim)]">{Math.round((b.n / brandMax) * 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Arm speed</div>
                <div className="mt-1.5 space-y-1">
                  {ARM_SPLIT.map((a) => (
                    <div key={a.label} className="flex items-center gap-2">
                      <span className="flex-1 text-[13px] text-[var(--cream)]">{a.label}</span>
                      <span style={NUM} className="text-[12px] font-semibold text-[var(--sage)]">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-snug text-[var(--sage-dim)]">Directional — hand-pulled from a readable bag subset. The pipeline will make it authoritative and add shot-level flight.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
