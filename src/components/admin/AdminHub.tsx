"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { getAdminQueues, type AdminQueues, type QueueMeta } from "@/lib/adminQueues";
import GrowthStrip from "@/components/growth/GrowthStrip";
import type { GrowthData } from "@/lib/growth";

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const; // Inter numerals

const DEFS: Record<QueueMeta["key"], { name: string; desc: string; href: string; icon: ReactNode }> = {
  digest: {
    name: "Trending Issues", desc: "What's coming up most this week", href: "/admin/digest",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  fulfillment: {
    name: "Reward Fulfillment", desc: "Ship builder gear", href: "/admin/fulfillment",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></svg>,
  },
  removals: {
    name: "Course Removals", desc: "Pull courses from the directory", href: "/admin/removals",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>,
  },
};

function useCountUp(target: number, ms = 750) {
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(target); return; }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, ms]);
  return n;
}

const ago = (msPast: number) => {
  const s = Math.max(0, Date.now() - msPast) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};
const waiting = (msPast: number) => {
  const h = Math.max(0, Date.now() - msPast) / 3600000;
  if (h < 24) return `${Math.max(1, Math.round(h))}h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
};

// { text, dot } — dot: green = automation alive, amber = someone waiting a while, null = clear
function freshness(q: QueueMeta): { text: string; dot: string | null } {
  const desc = DEFS[q.key].desc;
  if (q.freshness.type === "lastRun") return { text: `${desc} · last run ${ago(q.freshness.ms)}`, dot: "#5fcf80" };
  if (q.freshness.type === "oldest") {
    const stale = Date.now() - q.freshness.ms > 2 * 86400000;
    return { text: `${desc} · oldest waiting ${waiting(q.freshness.ms)}`, dot: stale ? "#e0873f" : "#F6C165" };
  }
  return { text: "All caught up", dot: null };
}

function Row({ q }: { q: QueueMeta }) {
  const { name, href, icon } = DEFS[q.key];
  const active = q.count > 0;
  const count = useCountUp(q.count);
  const fr = freshness(q);
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-5 overflow-hidden rounded-2xl px-5 py-5 transition-all duration-300 sm:px-6 ${
        active ? "bg-white/[0.035] hover:-translate-y-0.5 hover:bg-white/[0.06]" : "bg-white/[0.015] opacity-55 hover:opacity-90"
      }`}
    >
      {active && <span className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-full bg-gradient-to-b from-transparent via-[var(--gold)] to-transparent opacity-70" />}
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${active ? "bg-[var(--gold)]/12 text-[var(--gold)] shadow-[0_0_28px_-8px_rgba(246,193,101,0.55)]" : "bg-white/[0.04] text-[var(--sage-dim)]"}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`${HEAD} text-[20px] font-bold text-[var(--cream)]`}>{name}</div>
        <div className="mt-1 flex items-center gap-2 text-[13.5px] text-[var(--sage-dim)]">
          {fr.dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: fr.dot }} />}
          <span className="truncate">{fr.text}</span>
        </div>
      </div>
      <span style={NUM} className={`text-[42px] font-black leading-none ${active ? "text-[var(--gold)]" : "text-[var(--sage-dim)]"}`}>{count}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0 text-[var(--sage-dim)] transition-transform duration-300 group-hover:translate-x-1 group-hover:text-[var(--sage)]"><path d="M9 18l6-6-6-6" /></svg>
    </Link>
  );
}

export default function AdminHub({ growth }: { growth: GrowthData }) {
  const [data, setData] = useState<AdminQueues | null>(null);
  useEffect(() => { getAdminQueues().then(setData).catch(() => setData({ queues: [], total: 0 })); }, []);

  const queues = data ? [...data.queues].sort((a, b) => b.count - a.count) : null;
  const total = data?.total ?? 0;
  const totalUp = useCountUp(total);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      {/* ===== cinematic hero ===== */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] shadow-[0_44px_110px_-44px_rgba(0,0,0,0.95)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/team/circle-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_38%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-deep)] via-[var(--bg-deep)]/60 to-[var(--bg-deep)]/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-deep)] via-[var(--bg-deep)]/35 to-transparent" />
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gold)]/50 to-transparent" />

        <div className="relative flex min-h-[380px] flex-col justify-end p-7 sm:min-h-[440px] sm:p-10">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--gold)] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--gold)]" /></span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--gold)]">Internal use only</span>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="min-w-0">
              <h1 className={`${HEAD} text-5xl font-black tracking-[-0.03em] text-[var(--cream)] drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] sm:text-[68px] sm:leading-[0.92]`}>The Circle</h1>
              <p className="mt-2.5 max-w-md text-[14.5px] leading-relaxed text-[var(--cream)]/70">Every signal from the community — bugs, requests, rewards, removals — gathered in one place for the people who keep Radius moving.</p>
            </div>
            {data && (total > 0 ? (
              <div className="rounded-2xl border border-[var(--gold)]/25 bg-black/35 px-6 py-4 text-right backdrop-blur-md">
                <div style={NUM} className="text-5xl font-black leading-none text-[var(--gold)] sm:text-6xl">{totalUp}</div>
                <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--sage)]">item{total === 1 ? "" : "s"} need you</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#5fcf80]/25 bg-black/35 px-6 py-4 text-[14px] font-semibold text-[#8fe0a5] backdrop-blur-md">✓ All caught up</div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {queues === null ? (
          <div className="flex justify-center py-16 text-[var(--sage)]"><svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          queues.map((q) => <Row key={q.key} q={q} />)
        )}
      </div>
      <div className="mt-5 px-6 text-[12.5px] text-[var(--sage-dim)]">Coming soon · Course Approvals · Staff Applications</div>

      <div className="mt-14 rounded-3xl bg-white/[0.02] p-6 sm:p-8">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5fcf80] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5fcf80]" />
          </span>
          <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--sage)]`}>Radius pulse</span>
        </div>
        <GrowthStrip data={growth} />
      </div>

      {/* ===== the crew ===== */}
      <div className="mt-14">
        <div className="mb-4 flex items-center gap-2.5">
          <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--sage)]`}>The crew</span>
          <span className="h-px flex-1 bg-[var(--hair)]" />
          <span className="text-[12px] text-[var(--sage-dim)]">Why we do this</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { src: "/team/crew-walk.jpg", pos: "object-center" },
            { src: "/team/crew-handshake.jpg", pos: "object-center" },
            { src: "/team/crew-hug.jpg", pos: "object-[center_30%]" },
            { src: "/team/crew-highfive.jpg", pos: "object-center" },
          ].map((c) => (
            <div key={c.src} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.src} alt="" loading="lazy" className={`h-full w-full object-cover ${c.pos} transition-transform duration-500 group-hover:scale-[1.05]`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
