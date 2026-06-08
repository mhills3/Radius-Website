"use client";

import { type RankInfo } from "@/lib/community";

export default function RankPill({ rank }: { rank?: RankInfo }) {
  if (!rank) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none" style={{ background: `${rank.color}22`, color: rank.color }} title={`Game IQ ${rank.iq}`}>
      {rank.tier}
    </span>
  );
}
