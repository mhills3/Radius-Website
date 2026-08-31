"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDigestsInRange, type Digest, type DigestItem } from "@/lib/communityDigest";

const HEAD = "font-[family-name:var(--font-heading)]";
const BLUE = "#4d94fa";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const; // Inter numerals
const DAY = 86_400_000;

type Section = "bugs" | "features" | "questions" | "notable";
type Row = DigestItem & { section: Section; date: string };

const SECTION_LABEL: Record<Section, string> = { bugs: "Bugs", features: "Requests", questions: "Questions", notable: "Notable" };
const SECTION_SHORT: Record<Section, string> = { bugs: "Bug", features: "Req", questions: "Q", notable: "Note" };
const SECTIONS: Section[] = ["bugs", "features", "questions", "notable"];
const PRIO_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface ThemeGroup { theme: string; total: number; items: Row[]; sections: Set<Section> }

function weekWindow(offset: number): { startMs: number; endMs: number } {
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endMs = todayMid + DAY - offset * 7 * DAY; // exclusive upper bound (next midnight of the last day)
  return { startMs: endMs - 7 * DAY, endMs };
}
const fmtShort = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const linkLabel = (url: string, i: number, total: number) => {
  const email = url.includes("mail.google.com");
  if (total > 1) return `${email ? "Email" : "Discord"} ${i + 1}`;
  return email ? "Email thread" : "View in Discord";
};

function SevDot({ p }: { p?: string }) {
  const c = p === "high" ? "#e0873f" : p === "medium" ? "var(--gold)" : p === "low" ? "var(--sage-dim)" : "transparent";
  return <span title={p ? p[0].toUpperCase() + p.slice(1) : ""} className="h-2 w-2 shrink-0 rounded-full" style={{ background: c }} />;
}
function SourceIcons({ sources }: { sources?: string[] }) {
  if (!sources?.length) return null;
  return (
    <span className="flex shrink-0 items-center gap-1" style={{ color: BLUE }}>
      {sources.includes("discord") && <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.25.5a18.3 18.3 0 0 1 4.36 1.36 15 15 0 0 0-4.44-1.4 13.8 13.8 0 0 0-6.14 0A15 15 0 0 0 4.5 4.86 18.3 18.3 0 0 1 8.85 3.5L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1 8.9.3 13.3.65 17.6a19.9 19.9 0 0 0 6 3l.8-1.1a13 13 0 0 1-2.02-.98l.5-.37a14.2 14.2 0 0 0 12.14 0l.5.37c-.64.38-1.32.71-2.03.98l.8 1.1a19.9 19.9 0 0 0 6-3c.4-5-.68-9.36-3.36-13.2ZM8.9 15c-1.16 0-2.12-1.07-2.12-2.38S7.72 10.2 8.9 10.2s2.13 1.08 2.11 2.4c0 1.32-.94 2.4-2.11 2.4Zm6.2 0c-1.16 0-2.12-1.07-2.12-2.38s.94-2.4 2.12-2.4 2.13 1.08 2.11 2.4c0 1.32-.93 2.4-2.11 2.4Z" /></svg>}
      {sources.includes("email") && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>}
    </span>
  );
}

function CaseCard({ row }: { row: Row }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
            <SevDot p={row.priority} />
            <span className="font-bold uppercase tracking-[0.1em] text-[var(--sage-dim)]">{SECTION_SHORT[row.section]}</span>
            {row.platform && row.platform !== "unknown" && <span className="font-bold uppercase tracking-wide text-[var(--sage-dim)]">{row.platform}</span>}
            <span className="text-[var(--sage-dim)]">{fmtDay(row.date)}</span>
            <SourceIcons sources={row.sources} />
          </div>
          <p className="mt-1.5 text-[14px] leading-snug text-[var(--cream)]">{row.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12px]">
            {row.links.map((l, i) => (
              <a key={l} href={l} target="_blank" rel="noopener" className="font-bold hover:underline" style={{ color: BLUE }}>{linkLabel(l, i, row.links.length)} ↗</a>
            ))}
          </div>
        </div>
        <span style={NUM} className={`shrink-0 text-[22px] font-black leading-none ${row.count > 1 ? "text-[var(--gold)]" : "text-[var(--sage-dim)]"}`} title={`${row.count} ${row.count === 1 ? "reporter" : "reporters"}`}>{row.count}</span>
      </div>
    </div>
  );
}

function Bar({ g, max, open, onToggle }: { g: ThemeGroup; max: number; open: boolean; onToggle: () => void }) {
  const pct = max > 0 ? Math.max(4, (g.total / max) * 100) : 0;
  const secs = SECTIONS.filter((s) => g.sections.has(s)).map((s) => SECTION_LABEL[s]).join(" · ");
  return (
    <div>
      <button onClick={onToggle} className={`group w-full rounded-2xl px-4 py-3.5 text-left transition-colors ${open ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 shrink-0 text-[var(--sage-dim)] transition-transform ${open ? "rotate-90 text-[var(--gold)]" : "group-hover:text-[var(--sage)]"}`}><path d="M9 18l6-6-6-6" /></svg>
          <span className={`${HEAD} min-w-0 flex-1 truncate text-[15px] font-bold ${open ? "text-[var(--gold)]" : "text-[var(--cream)]"}`}>{g.theme}</span>
          <span className="shrink-0 text-[11.5px] text-[var(--sage-dim)]">{g.items.length} {g.items.length === 1 ? "issue" : "issues"}</span>
          <span style={NUM} className="w-9 shrink-0 text-right text-[19px] font-black text-[var(--gold)]" title="Total reporters this week">{g.total}</span>
        </div>
        <div className="mt-2 flex items-center gap-3" style={{ marginLeft: "1.625rem" }}>
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: open ? "linear-gradient(90deg, var(--gold), var(--gold-bright))" : "linear-gradient(90deg, rgba(246,193,101,0.55), rgba(246,193,101,0.85))" }}
            />
          </span>
          <span className="shrink-0 text-[11px] text-[var(--sage-dim)]">{secs}</span>
        </div>
      </button>
      {open && (
        <div className="mt-1.5 space-y-2 pb-3 pl-6 pr-1">
          {g.items.map((r) => <CaseCard key={r.id} row={r} />)}
        </div>
      )}
    </div>
  );
}

export default function TrendingIssues() {
  const [offset, setOffset] = useState(0);
  const [digests, setDigests] = useState<Digest[] | undefined>(undefined);
  const [openTheme, setOpenTheme] = useState<string | null>(null);

  const { startMs, endMs } = useMemo(() => weekWindow(offset), [offset]);

  useEffect(() => {
    let alive = true;
    setDigests(undefined); setOpenTheme(null);
    getDigestsInRange(startMs, endMs).then((d) => { if (alive) setDigests(d); }).catch(() => { if (alive) setDigests([]); });
    return () => { alive = false; };
  }, [startMs, endMs]);

  const rows: Row[] = useMemo(
    () => (digests ?? []).flatMap((d) => SECTIONS.flatMap((s) => d.categories[s].map((it) => ({ ...it, section: s, date: d.date })))),
    [digests]
  );

  const themes: ThemeGroup[] = useMemo(() => {
    const map = new Map<string, ThemeGroup>();
    for (const r of rows) {
      const key = (r.theme || "").trim() || SECTION_LABEL[r.section];
      const g = map.get(key) ?? { theme: key, total: 0, items: [], sections: new Set<Section>() };
      g.total += r.count || 1;
      g.items.push(r);
      g.sections.add(r.section);
      map.set(key, g);
    }
    for (const g of map.values()) g.items.sort((a, b) => (b.count - a.count) || (PRIO_RANK[a.priority ?? "low"] - PRIO_RANK[b.priority ?? "low"]));
    return [...map.values()].sort((a, b) => (b.total - a.total) || (b.items.length - a.items.length));
  }, [rows]);

  const max = themes[0]?.total ?? 0;
  const totalReporters = rows.reduce((n, r) => n + (r.count || 1), 0);
  const rangeLabel = `${fmtShort(startMs)} – ${fmtShort(endMs - DAY)}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[12px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">← The Circle</Link>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Internal use only</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Trending issues</h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--text-body)]">What the community is raising most — themes ranked by how many people brought them up. Tap a bar to see the exact bugs, requests, and messages behind it.</p>

      {/* week pager */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button onClick={() => setOffset((o) => o + 1)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] px-3 py-1.5 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6" /></svg>Earlier
        </button>
        <div className="min-w-0 text-center">
          <div className={`${HEAD} truncate text-[15px] font-bold text-[var(--cream)]`}>{offset === 0 ? "This week" : rangeLabel}</div>
          <div className="text-[12px] text-[var(--sage-dim)]">{offset === 0 ? rangeLabel : `${offset} week${offset === 1 ? "" : "s"} ago`}{digests && rows.length > 0 ? <> · <span className="font-bold text-[var(--gold)]">{totalReporters}</span> mentions across {rows.length}</> : ""}</div>
        </div>
        <button onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] px-3 py-1.5 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-40">
          Later<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {digests === undefined ? (
        <div className="mt-12 flex justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : themes.length === 0 ? (
        <div className="mt-12 py-16 text-center">
          <div className="text-3xl">🌤️</div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--cream)]">Quiet week</p>
          <p className="mt-1 text-[13px] text-[var(--text-body)]">No issues surfaced in this window. Try an earlier week.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-1">
          {themes.map((g) => (
            <Bar key={g.theme} g={g} max={max} open={openTheme === g.theme} onToggle={() => setOpenTheme((t) => (t === g.theme ? null : g.theme))} />
          ))}
        </div>
      )}
    </div>
  );
}
