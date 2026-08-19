"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getPendingRemovalCount } from "@/lib/courseRemoval";

const HEAD = "font-[family-name:var(--font-heading)]";

// Adding a staff tool = add an entry here. Live tools get an href; deferred ones render as
// dimmed "Coming soon" cards so the hub already shows the roadmap without a rewrite.
type Tool = { title: string; desc: string; icon: ReactNode; href?: string; count?: number | null; live: boolean };

function ToolCard({ t }: { t: Tool }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.live ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "bg-white/[0.04] text-[var(--sage-dim)]"}`}>{t.icon}</span>
        {t.live
          ? (t.count != null && t.count > 0
              ? <span className={`${HEAD} rounded-full bg-[var(--gold)] px-2.5 py-1 text-[12px] font-bold text-[#141B16]`}>{t.count} pending</span>
              : t.count != null ? <span className="text-[12px] font-semibold text-[var(--sage-dim)]">Clear</span> : null)
          : <span className={`${HEAD} rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--sage-dim)]`}>Soon</span>}
      </div>
      <div className={`${HEAD} mt-4 text-[19px] font-bold ${t.live ? "text-[var(--cream)]" : "text-[var(--sage)]"}`}>{t.title}</div>
      <p className="mt-1 text-[13.5px] leading-snug text-[var(--text-body)]">{t.desc}</p>
    </>
  );
  const cls = "block rounded-2xl border p-5 shadow-sm transition-colors";
  return t.live && t.href
    ? <Link href={t.href} className={`${cls} border-[var(--hair)] bg-[var(--bg-mid)] hover:border-[var(--gold)]/40`}>{body}</Link>
    : <div className={`${cls} border-[var(--hair)] bg-[var(--bg-mid)] opacity-70`}>{body}</div>;
}

export default function AdminHub() {
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => { getPendingRemovalCount().then(setPending).catch(() => setPending(0)); }, []);

  const tools: Tool[] = [
    {
      title: "Course Removals", desc: "Review requests to pull a course from the directory.", href: "/admin/removals", count: pending, live: true,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>,
    },
    {
      title: "Course Approvals", desc: "Review new course submissions before they go public.", live: false,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4 12 14.01l-3-3" /></svg>,
    },
    {
      title: "Staff Applications", desc: "Review requests for staff access.", live: false,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" /></svg>,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Admin</h1>
      <p className="mt-2 max-w-xl text-[14px] text-[var(--text-body)]">Radius staff tools. Pick a queue to work.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tools.map((t) => <ToolCard key={t.title} t={t} />)}
      </div>
    </div>
  );
}
