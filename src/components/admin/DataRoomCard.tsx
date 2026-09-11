"use client";

import Link from "next/link";
import { TOTALS } from "@/lib/insightsPilot";

// Top-of-The-Circle entry to the Brand Insights data room. Wide, gold, one tap in.
const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;

function Mini({ v, l }: { v: string; l: string }) {
  return (
    <div className="text-center">
      <div style={NUM} className={`${HEAD} text-[22px] font-black leading-none text-[var(--cream)]`}>{v}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">{l}</div>
    </div>
  );
}

export default function DataRoomCard() {
  return (
    <Link
      href="/admin/insights"
      className="group mt-8 flex flex-wrap items-center gap-x-8 gap-y-5 overflow-hidden rounded-3xl border border-[var(--gold)]/25 bg-[radial-gradient(130%_150%_at_0%_0%,rgba(246,193,101,0.14),transparent_58%)] bg-[#0e1612]/60 px-7 py-6 backdrop-blur-md transition-all hover:border-[var(--gold)]/45 hover:shadow-[0_28px_70px_-30px_rgba(246,193,101,0.4)] sm:px-9"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[15px] leading-none">📊</span>
          <span className={`${HEAD} text-[11px] font-bold uppercase tracking-[0.2em]`} style={{ color: "var(--gold)" }}>Radius Brand Insights</span>
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--sage-dim)]">Updated monthly</span>
        </div>
        <h2 className={`${HEAD} mt-1.5 text-[28px] font-black leading-tight tracking-[-0.02em] text-[var(--cream)] sm:text-[32px]`}>The data room</h2>
        <p className="mt-1 max-w-xl text-[14px] text-[var(--sage)]">What we can see that nobody else in disc golf can — bags, arm speed, and where the whole sport misses putts.</p>
      </div>
      <div className="hidden items-center gap-7 sm:flex">
        <Mini v={TOTALS.players.toLocaleString()} l="Players" />
        <Mini v={TOTALS.rounds.toLocaleString()} l="Rounds" />
        <Mini v={TOTALS.bagSlots.toLocaleString()} l="Discs bagged" />
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-5 py-2.5 text-[14px] font-bold text-[var(--gold)] transition-colors group-hover:bg-[var(--gold)]/20">
        Enter <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}
