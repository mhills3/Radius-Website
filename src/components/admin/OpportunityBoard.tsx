"use client";

import { useState } from "react";
import Link from "next/link";
import { TOTALS } from "@/lib/insightsPilot";

// The Circle → "Opportunity Board": our roadmap/blueprint for monetizing Radius beyond the user base.
// Milestone strip up top, then a grid of plays — tap any card to flip it for the pitch + what we'd
// need to make it real.
const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;
const GOLD = "var(--gold)";
const ROUNDS_GOAL = 100_000;

type Status = "live" | "building" | "piloting" | "idea";
const DOT: Record<Status, { c: string; label: string }> = {
  live: { c: "#5fcf80", label: "Live" },
  building: { c: "#f0c069", label: "Building" },
  piloting: { c: "#f6c165", label: "Piloting" },
  idea: { c: "var(--sage-dim)", label: "Idea" },
};

interface Play {
  id: string; icon: string; name: string; blurb: string; status: Status;
  pitch: string; need: string[]; href?: string; hrefLabel?: string;
}
const PLAYS: Play[] = [
  {
    id: "brand-insights", icon: "📊", name: "Radius Brand Insights", status: "piloting",
    blurb: "Per-brand data subscription for disc companies.",
    pitch: "A private monthly dashboard into a brand's own discs — bag %, arm-speed audience, real flight, where they miss. Recurring 4–5 figures × 10–15 brands.",
    need: ["Data room live ✓ (this build)", "Sales one-pager + sample report", "~100K rounds for per-mold density", "1–2 design-partner brands to pilot"],
    href: "/admin/insights", hrefLabel: "Open the data room →",
  },
  {
    id: "pro", icon: "⭐", name: "Radius Pro", status: "live",
    blurb: "Caddy, stats & analysis subscription.",
    pitch: "Our consumer subscription — the base revenue line. Every new engaged player is a conversion target.",
    need: ["Web paywall + isPro mirror", "Pricing experiments", "Annual + family plans"],
  },
  {
    id: "affiliate", icon: "🛒", name: "Disc fitting → retail affiliate", status: "idea",
    blurb: "Recommend a disc, earn on the sale.",
    pitch: "Caddy already knows the gap in your bag. Turn that recommendation into a tracked buy link and take a cut of every sale.",
    need: ["Affiliate terms (Infinite / GGT — retail feed already live)", "In-app buy flow", "Click → purchase attribution"],
  },
  {
    id: "course-demand", icon: "🗺️", name: "Course-demand intelligence", status: "idea",
    blurb: "Where players want courses → developers, parks & rec.",
    pitch: "We can see unmet demand by geography — searches, plays, travel. Sell regional demand reports to course developers, parks departments, and land owners.",
    need: ["Geo-demand aggregation from searches/plays", "Packaged regional reports", "Outreach list of developers / park depts"],
  },
  {
    id: "state-of-bag", icon: "📰", name: '"State of the Bag" report', status: "idea",
    blurb: "Sponsored annual flagship — PR + lead gen.",
    pitch: "The whole-sport story, published yearly. Free PR that pulls brands toward the paid per-brand product, and a title-sponsor slot of its own.",
    need: ["Data room live ✓", "Editorial + design", "Distribution / PR plan", "A title sponsor"],
  },
  {
    id: "leagues", icon: "🏆", name: "Leagues & Events premium", status: "building",
    blurb: "Director tools + a cut of payments.",
    pitch: "Own the league night. Free for players, premium director tools, and a slice of entry payments — the wedge UDisc leaves open.",
    need: ["Leagues GA (web-first, in progress)", "Payments integration", "Director pricing tier"],
  },
  {
    id: "benchmark", icon: "📈", name: "Anonymized benchmark licensing", status: "idea",
    blurb: "Blended whole-sport aggregates for retailers & investors.",
    pitch: "The public, blended layer — category-wide truths with no brand or player identifiable. Non-exclusive, high-margin, sell it to many.",
    need: ["Anonymization guardrails (min sample, blended)", "Licensing terms (non-exclusive)", "A teaser sample to sell from"],
  },
];

function FlipCard({ p }: { p: Play }) {
  const [flipped, setFlipped] = useState(false);
  const tone = DOT[p.status];
  return (
    <div className="h-[248px] [perspective:1400px]">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }}
        className="relative h-full w-full cursor-pointer rounded-2xl transition-transform duration-[550ms] [transform-style:preserve-3d]"
        style={{ transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}
      >
        {/* front */}
        <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }} className="absolute inset-0 flex flex-col rounded-2xl border border-white/[0.08] bg-[#0e1612]/70 p-5 transition-colors hover:border-white/[0.16]">
          <div className="flex items-start justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.05] text-[20px]">{p.icon}</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: tone.c }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.c }} />{tone.label}
            </span>
          </div>
          <div className={`${HEAD} mt-4 text-[18px] font-extrabold leading-tight text-[var(--cream)]`}>{p.name}</div>
          <div className="mt-1.5 text-[13px] leading-snug text-[var(--sage)]">{p.blurb}</div>
          <div className="mt-auto flex items-center gap-1.5 pt-3 text-[11.5px] font-semibold" style={{ color: GOLD }}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /></svg>
            Tap for the play
          </div>
        </div>
        {/* back */}
        <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }} className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-[#0e1612]/85 p-5">
          <div className={`${HEAD} text-[15px] font-extrabold text-[var(--cream)]`}>{p.name}</div>
          <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-body)]">{p.pitch}</p>
          <div className="mt-2.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: GOLD }}>What we&apos;d need</div>
          <ul className="mt-1 space-y-1 overflow-y-auto">
            {p.need.map((n) => (
              <li key={n} className="flex gap-1.5 text-[12px] leading-snug text-[var(--sage)]">
                <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-[var(--sage-dim)]" />{n}
              </li>
            ))}
          </ul>
          {p.href && (
            <Link href={p.href} onClick={(e) => e.stopPropagation()} className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3 py-1 text-[11.5px] font-bold text-[var(--gold)] hover:bg-[var(--gold)]/20">
              {p.hrefLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpportunityBoard() {
  const pct = Math.round((TOTALS.rounds / ROUNDS_GOAL) * 100);
  return (
    <div className="mt-14 overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0e1612]/45 backdrop-blur-md">
      {/* header */}
      <div className="border-b border-white/[0.06] bg-[radial-gradient(120%_140%_at_0%_0%,rgba(246,193,101,0.09),transparent_60%)] px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="text-[16px] leading-none">🧭</span>
          <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em]`} style={{ color: GOLD }}>Opportunity board</span>
        </div>
        <h2 className={`${HEAD} mt-1.5 text-[26px] font-black leading-tight tracking-[-0.02em] text-[var(--cream)]`}>Goals, milestones & monetization</h2>
        <p className="mt-1 text-[14px] text-[var(--sage)]">Our blueprint beyond the user base. Tap any play to see the pitch and what it&apos;d take to make it real.</p>
      </div>

      <div className="space-y-7 px-6 py-7 sm:px-8">
        {/* milestone strip */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className={`${HEAD} text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--sage)]`}>Road to 100K rounds</span>
            <span style={NUM} className="text-[13px] font-semibold text-[var(--sage-dim)]">Brand Insights gets sellable here</span>
          </div>
          <div className="flex items-end gap-4">
            <div style={NUM} className={`${HEAD} text-[34px] font-black leading-none text-[var(--cream)]`}>{TOTALS.rounds.toLocaleString()}</div>
            <div style={NUM} className="pb-1 text-[14px] font-semibold text-[var(--sage-dim)]">/ {ROUNDS_GOAL.toLocaleString()} · {pct}%</div>
            <div className="flex-1" />
            <div className="text-right">
              <div style={NUM} className={`${HEAD} text-[20px] font-extrabold leading-none text-[var(--cream)]`}>{TOTALS.players.toLocaleString()}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">players</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, pct)}%`, background: "linear-gradient(90deg, var(--gold), var(--gold-bright, #ffd98a))" }} />
          </div>
        </div>

        {/* plays */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLAYS.map((p) => <FlipCard key={p.id} p={p} />)}
        </div>
      </div>
    </div>
  );
}
