"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBagEarnerCount } from "@/lib/shop";

/** The last grid cell — Builder Rewards, not a product. The earner count is
 *  live from the same records the rewards program reads; while loading or on
 *  failure the sentence is simply omitted, never faked. */
export default function RewardsTile({ variant = "tile" }: { variant?: "tile" | "bar" }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => { getBagEarnerCount().then(setCount); }, []);

  if (variant === "bar") {
    return (
      <Link
        href="/rewards"
        className="flex h-[54px] items-center justify-between gap-3 rounded-2xl border border-[rgba(215,160,0,.34)] px-4.5 text-[var(--shop-cream)]"
        style={{ background: "linear-gradient(130deg, #18552F 0%, #0B361A 100%)", paddingLeft: 18, paddingRight: 18 }}
      >
        <span className="flex flex-col leading-tight">
          <span className="font-[family-name:var(--font-heading)] text-[14px] font-bold">Earn a bag free</span>
          <span className="text-[11.5px] text-[rgba(252,249,239,.66)]">Map 50 courses{count !== null ? ` · ${count} have done it` : ""}</span>
        </span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--shop-gold-soft)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </Link>
    );
  }

  return (
    <Link
      href="/rewards"
      className="flex min-h-[380px] flex-col justify-between overflow-hidden rounded-2xl border border-[rgba(215,160,0,.34)] p-7 text-[var(--shop-cream)] transition-transform duration-[220ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:-translate-y-[3px]"
      style={{ background: "linear-gradient(168deg, #18552F 0%, #0C3A1C 52%, #06250F 100%)" }}
    >
      <div>
        <div className="mb-4 text-[11px] font-bold tracking-[0.18em] text-[var(--shop-gold-soft)]">BUILDER REWARDS</div>
        <div className="max-w-[270px] font-[family-name:var(--font-heading)] text-[29px] font-bold leading-[1.14] tracking-[-0.025em]">Don&apos;t buy a bag. Earn one.</div>
        <p className="mt-4 max-w-[290px] text-[14.5px] leading-relaxed text-[rgba(252,249,239,.76)]">
          Map 50 courses into Radius and we ship you a bag of your choice, on us.{count !== null ? ` ${count} players have already done it.` : ""}
        </p>
      </div>
      <div className="mt-6 inline-flex items-center gap-2 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--shop-gold-soft)]">
        See the leaderboard
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </div>
    </Link>
  );
}
