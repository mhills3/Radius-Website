"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminQueues, type AdminQueues, type QueueMeta } from "@/lib/adminQueues";
import GrowthStrip from "@/components/growth/GrowthStrip";
import DataRoomCard from "@/components/admin/DataRoomCard";
import OpportunityBoard from "@/components/admin/OpportunityBoard";
import type { GrowthData } from "@/lib/growth";

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const; // Inter numerals
const DAY = 86_400_000;

// Age tones — red = clear these first, amber = getting old, green = fresh.
const RED = { fg: "#ef7f7f", bg: "rgba(239,127,127,0.13)" };
const AMBER = { fg: "#f0c069", bg: "rgba(240,192,105,0.13)" };
const GREEN = { fg: "#8fe0a5", bg: "rgba(95,207,128,0.13)" };
const BLUE = "#6fa8ff";

const DEFS: Record<QueueMeta["key"], { name: string; blurb: string; href: string; icon: string; unit: [string, string] }> = {
  fulfillment: { name: "Reward Fulfillment", blurb: "Builder gear + bag claims", href: "/admin/fulfillment", icon: "📦", unit: ["item", "items"] },
  removals: { name: "Course Removals", blurb: "Pull courses from the directory", href: "/admin/removals", icon: "🗑️", unit: ["item", "items"] },
  adminRequests: { name: "Admin Requests", blurb: "Grant course edit rights", href: "/admin/admin-requests", icon: "🔑", unit: ["item", "items"] },
  discSubmissions: { name: "Disc Submissions", blurb: "Custom discs → catalog leads", href: "/admin/disc-submissions", icon: "🥏", unit: ["lead", "leads"] },
  digest: { name: "Trending Issues", blurb: "Weekly digest of what the community is talking about", href: "/admin/digest", icon: "💬", unit: ["item", "items"] },
};

const ago = (msPast: number) => {
  const s = Math.max(0, Date.now() - msPast) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
};
// "19 days" / "6 hours" / "40 min"
const waitingLong = (msPast: number) => {
  const m = Math.max(1, Math.round((Date.now() - msPast) / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
};
// "19d" / "6h" / "40m"
const waitingShort = (msPast: number) => {
  const m = Math.max(1, Math.round((Date.now() - msPast) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
};
const ageTone = (msPast: number) => {
  const age = Date.now() - msPast;
  return age >= 14 * DAY ? RED : age >= 2 * DAY ? AMBER : GREEN;
};

function Row({ q }: { q: QueueMeta }) {
  const { name, blurb, href, icon, unit } = DEFS[q.key];
  const active = q.count > 0;
  const oldest = q.freshness.type === "oldest" ? q.freshness.ms : null;
  const tone = oldest != null ? ageTone(oldest) : GREEN;
  const delta = q.newThisWeek > 0 ? (q.newToday === q.newThisWeek ? `+${q.newToday} today` : `+${q.newThisWeek} this week`) : null;

  return (
    <Link
      href={href}
      className={`group flex items-center gap-6 rounded-2xl px-7 py-6 transition-colors ${active ? "bg-[#0e1612]/60 hover:bg-[#0e1612]/75" : "bg-[#0e1612]/40 opacity-60 hover:opacity-90"} border border-white/[0.06] backdrop-blur-md shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)]`}
    >
      <span className="grid h-[68px] w-[68px] shrink-0 place-items-center rounded-2xl bg-white/[0.04] text-[28px] leading-none">{icon}</span>

      <div className="w-[240px] shrink-0">
        <div className={`${HEAD} text-[22px] font-bold leading-tight text-[var(--cream)]`}>{name}</div>
        {oldest != null ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold" style={{ color: tone.fg, background: tone.bg }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />oldest {waitingLong(oldest)}
          </span>
        ) : (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold" style={{ color: GREEN.fg, background: GREEN.bg }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN.fg }} />all caught up
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 text-[16px] leading-snug text-[var(--sage)]">
        {q.nextUp ? (
          <>Next up: <b className="font-semibold text-[var(--cream)]">{q.nextUp.title}</b>{q.nextUp.detail && <> · {q.nextUp.detail}</>}</>
        ) : (
          <span className="text-[var(--sage-dim)]">{blurb} · nothing waiting</span>
        )}
      </div>

      {delta && <span style={NUM} className="shrink-0 text-[14px] font-semibold text-[var(--gold)]">{delta}</span>}

      <div className="w-[64px] shrink-0 text-right">
        <div style={NUM} className={`text-[34px] font-black leading-none ${active ? "text-[var(--cream)]" : "text-[var(--sage-dim)]"}`}>{q.count}</div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">{q.count === 1 ? unit[0] : unit[1]}</div>
      </div>
    </Link>
  );
}

function DigestRow({ q }: { q: QueueMeta }) {
  const { name, blurb, href, icon } = DEFS.digest;
  const lastRun = q.freshness.type === "lastRun" ? ` · last run ${ago(q.freshness.ms)}` : "";
  return (
    <Link href={href} className="group flex items-center gap-5 rounded-2xl border border-white/[0.06] bg-[#0e1612]/50 px-7 py-5 backdrop-blur-md transition-colors hover:bg-[#0e1612]/70">
      <span className="shrink-0 text-[24px] leading-none">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className={`${HEAD} text-[19px] font-bold leading-tight text-[var(--cream)]`}>{name}</div>
        <div className="mt-1 truncate text-[15px] text-[var(--sage)]">{blurb}{lastRun}</div>
      </div>
      <span className="shrink-0 text-[15px] font-semibold transition-transform group-hover:translate-x-0.5" style={{ color: BLUE }}>Read digest →</span>
    </Link>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="text-center">
      <div className={`${HEAD} text-[30px] font-extrabold leading-none tracking-[-0.02em]`} style={{ color: color || "var(--cream)" }}>{value}</div>
      <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">{label}</div>
    </div>
  );
}

export default function AdminHub({ growth }: { growth: GrowthData }) {
  const [data, setData] = useState<AdminQueues | null>(null);
  useEffect(() => { getAdminQueues().then(setData).catch(() => setData({ queues: [], total: 0, sinceFriday: 0, oldestMs: null })); }, []);

  // Oldest first — clear the red ones. Empty queues sink to the bottom.
  const ageOf = (q: QueueMeta) => (q.freshness.type === "oldest" ? q.freshness.ms : Infinity);
  const queues = data ? data.queues.filter((q) => q.key !== "digest").sort((a, b) => ageOf(a) - ageOf(b)) : null;
  const digest = data?.queues.find((q) => q.key === "digest");
  const oldestTone = data?.oldestMs != null ? ageTone(data.oldestMs) : GREEN;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      {/* ===== header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0">
          <h1 className={`${HEAD} text-[44px] font-black leading-none tracking-[-0.03em] text-[var(--cream)] sm:text-[52px]`}>The Circle</h1>
          <p className="mt-3 text-[16px] text-[var(--sage)]">Every community signal in one place. Oldest first — clear the red ones.</p>
        </div>
        {data && (
          <div className="flex items-end gap-10">
            <Stat value={String(data.total)} label="Open" />
            <Stat value={`+${data.sinceFriday}`} label="Since Friday" color="var(--gold)" />
            <Stat value={data.oldestMs != null ? waitingShort(data.oldestMs) : "—"} label="Oldest item" color={data.oldestMs != null ? oldestTone.fg : undefined} />
          </div>
        )}
      </div>

      {/* ===== data room (top, easy access) ===== */}
      <DataRoomCard />

      {/* ===== queues ===== */}
      <div className="mt-10 space-y-4">
        {queues === null ? (
          <div className="flex justify-center py-16 text-[var(--sage)]"><svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : (
          <>
            {queues.map((q) => <Row key={q.key} q={q} />)}
            {digest && <div className="pt-4"><DigestRow q={digest} /></div>}
          </>
        )}
      </div>

      <div className="mt-14 rounded-3xl border border-white/[0.06] bg-[#0e1612]/55 p-6 backdrop-blur-md sm:p-8">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5fcf80] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5fcf80]" />
          </span>
          <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.2em] text-[var(--sage)]`}>Radius pulse</span>
        </div>
        <GrowthStrip data={growth} />
      </div>

      {/* ===== opportunity board · goals, milestones & monetization ===== */}
      <OpportunityBoard />

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
