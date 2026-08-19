"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getAdminQueues, type AdminQueues, type QueueMeta } from "@/lib/adminQueues";
import GrowthStrip from "@/components/growth/GrowthStrip";
import type { GrowthData } from "@/lib/growth";

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const; // Inter numerals

// Static presentation per queue; live count + freshness come from getAdminQueues().
const DEFS: Record<QueueMeta["key"], { name: string; desc: string; href: string; icon: ReactNode }> = {
  digest: {
    name: "Community Digest", desc: "Bugs, requests, questions", href: "/admin/digest",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  fulfillment: {
    name: "Reward Fulfillment", desc: "Ship builder gear", href: "/admin/fulfillment",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>,
  },
  removals: {
    name: "Course Removals", desc: "Pull courses from the directory", href: "/admin/removals",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>,
  },
};

const ago = (ms: number) => {
  const s = Math.max(0, Date.now() - ms) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};
const waiting = (ms: number) => {
  const h = Math.max(0, Date.now() - ms) / 3600000;
  if (h < 24) return `${Math.max(1, Math.round(h))}h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
};

// subtitle: clear → just "All caught up"; otherwise "description · freshness"
function subtitle(q: QueueMeta): string {
  const desc = DEFS[q.key].desc;
  if (q.freshness.type === "lastRun") return `${desc} · last run ${ago(q.freshness.ms)}`;
  if (q.freshness.type === "oldest") return `${desc} · oldest waiting ${waiting(q.freshness.ms)}`;
  return "All caught up";
}

function Row({ q }: { q: QueueMeta }) {
  const { name, href, icon } = DEFS[q.key];
  const active = q.count > 0;
  return (
    <Link href={href} className={`group flex items-center gap-4 py-4 transition-opacity ${active ? "" : "opacity-50"}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-[var(--gold)]/12 text-[var(--gold)]" : "bg-white/[0.04] text-[var(--sage-dim)]"}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`${HEAD} text-[16px] font-bold text-[var(--cream)]`}>{name}</div>
        <div className="truncate text-[13px] text-[var(--sage-dim)]">{subtitle(q)}</div>
      </div>
      <span style={NUM} className={`text-[22px] font-bold tabular-nums ${active ? "text-[var(--gold)]" : "text-[var(--sage-dim)]"}`}>{q.count}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-[var(--sage-dim)] transition-colors group-hover:text-[var(--sage)]"><path d="M9 18l6-6-6-6" /></svg>
    </Link>
  );
}

export default function AdminHub({ growth }: { growth: GrowthData }) {
  const [data, setData] = useState<AdminQueues | null>(null);
  useEffect(() => { getAdminQueues().then(setData).catch(() => setData({ queues: [], total: 0 })); }, []);

  const queues = data ? [...data.queues].sort((a, b) => b.count - a.count) : null;
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className={`${HEAD} text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Admin</h1>
        {data && (
          total > 0
            ? <span className="text-[15px] text-[var(--text-body)]"><b style={NUM} className="text-[var(--gold)]">{total}</b> item{total === 1 ? "" : "s"} need you</span>
            : <span className="text-[15px] text-[var(--sage-dim)]">You&apos;re all caught up</span>
        )}
      </div>

      {/* queue list — no cards, hairline dividers, sorted by pending desc */}
      <div className="mt-6 divide-y divide-[var(--hair)] border-t border-[var(--hair)]">
        {queues === null ? (
          <div className="flex justify-center py-12 text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          queues.map((q) => <Row key={q.key} q={q} />)
        )}
        <div className="py-3.5 text-[12.5px] text-[var(--sage-dim)]">Coming soon · Course Approvals · Staff Applications</div>
      </div>

      {/* demoted: Radius pulse as a compact strip */}
      <div className="mt-10">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5fcf80]" />
          <span className={`${HEAD} text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--sage)]`}>Radius pulse</span>
        </div>
        <GrowthStrip data={growth} />
      </div>
    </div>
  );
}
