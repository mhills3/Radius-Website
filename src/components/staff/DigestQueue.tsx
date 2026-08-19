"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDigest, listDigestDates, markDigestItemReviewed, markDigestItemsReviewed, type Digest, type DigestItem } from "@/lib/communityDigest";
import { parseResolveError } from "@/lib/courseRemoval";

const HEAD = "font-[family-name:var(--font-heading)]";
const BLUE = "#4d94fa";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const; // Inter numerals

type Section = "bugs" | "features" | "questions" | "notable";
type Row = DigestItem & { section: Section };

const SECTIONS: { key: Section; label: string; short: string }[] = [
  { key: "bugs", label: "Bugs", short: "Bug" },
  { key: "features", label: "Requests", short: "Req" },
  { key: "questions", label: "Questions", short: "Q" },
  { key: "notable", label: "Notable", short: "Note" },
];
const PLATFORMS = ["iOS", "Android", "web"];
const PRIO_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const fmtDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const linkLabel = (url: string, i: number, total: number) => {
  const email = url.includes("mail.google.com");
  if (total > 1) return `${email ? "Email" : "Discord"} ${i + 1}`;
  return email ? "Open email thread" : "View in Discord";
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

function ItemRow({ row, expanded, onToggle, selected, onSelect, onReviewed, showSection, date }: {
  row: Row; expanded: boolean; onToggle: () => void; selected: boolean; onSelect: () => void;
  onReviewed: (id: string, reviewed: boolean) => void; showSection: boolean; date: string;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleReviewed = async () => {
    setBusy(true); setErr(null);
    const next = !row.reviewed;
    try {
      const res = await markDigestItemReviewed(date, row.id, next);
      if (res.error) { setErr(res.error); setBusy(false); return; }
      onReviewed(row.id, next); setBusy(false);
    } catch (e) { setErr(parseResolveError(e).message); setBusy(false); }
  };
  const copyPrompt = async () => { try { await navigator.clipboard.writeText(row.prompt || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };

  return (
    <div className={`border-b border-[var(--hair)] ${row.reviewed && !expanded ? "opacity-45" : ""}`}>
      <div className="flex items-center gap-3 py-2.5" >
        <input type="checkbox" checked={selected} onChange={onSelect} onClick={(e) => e.stopPropagation()} className="h-4 w-4 shrink-0 cursor-pointer accent-[var(--gold)]" />
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <SevDot p={row.priority} />
          {row.platform && row.platform !== "unknown" && <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{row.platform}</span>}
          <SourceIcons sources={row.sources} />
          {showSection && <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--sage-dim)]/70">{SECTIONS.find((s) => s.key === row.section)?.short}</span>}
          {row.theme && <span className="shrink-0 text-[11px] font-semibold text-[var(--sage-dim)]">{row.theme}</span>}
          <span className={`min-w-0 flex-1 truncate text-[14px] ${row.reviewed ? "text-[var(--sage)]" : "text-[var(--cream)]"}`}>{row.description}</span>
        </button>
        <span style={NUM} className={`shrink-0 text-[15px] font-bold ${row.count > 1 ? "text-[var(--gold)]" : "text-[var(--sage-dim)]"}`}>{row.count}</span>
        <button onClick={onToggle} className="shrink-0 text-[var(--sage-dim)] transition-colors hover:text-[var(--sage)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {expanded && (
        <div className="pb-4 pl-7 pr-1">
          <p className="text-[14px] leading-snug text-[var(--text-body)]">{row.description}</p>
          {row.prompt && (
            <div className="mt-3 rounded-xl bg-white/[0.02] px-3.5 py-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--sage-dim)]">Claude Code prompt</span>
                <button onClick={copyPrompt} className="rounded-full bg-[var(--gold)]/12 px-3 py-1 text-[11px] font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20">{copied ? "Copied ✓" : "Copy prompt"}</button>
              </div>
              <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[var(--text-body)]" style={{ fontFamily: "inherit" }}>{row.prompt}</pre>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {row.links.map((l, i) => (
              <a key={l} href={l} target="_blank" rel="noopener" className="text-[12.5px] font-bold hover:underline" style={{ color: BLUE }}>{linkLabel(l, i, row.links.length)}</a>
            ))}
            <button onClick={toggleReviewed} disabled={busy} className="ml-auto rounded-full bg-[var(--gold)] px-4 py-1.5 text-[12px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">{busy ? "…" : row.reviewed ? "Mark unreviewed" : "Mark reviewed"}</button>
          </div>
          {err && <div className="mt-2 text-[12px] font-semibold text-[#e0873f]">{err}</div>}
        </div>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full px-3 py-1 text-[12px] font-bold transition-colors ${on ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{children}</button>;
}

export default function DigestQueue() {
  const [dates, setDates] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [digest, setDigest] = useState<Digest | null | undefined>(undefined);
  const [showIgnored, setShowIgnored] = useState(false);

  // filters
  const [section, setSection] = useState<Section | "all">("all");
  const [platform, setPlatform] = useState<string>("all");
  const [unreviewedOnly, setUnreviewedOnly] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => { listDigestDates().then((ds) => { setDates(ds); setIdx(0); }).catch(() => setDates([])); }, []);
  useEffect(() => {
    if (!dates) return;
    if (dates.length === 0) { setDigest(null); return; }
    setDigest(undefined); setExpandedId(null); setSel(new Set()); setShowIgnored(false);
    getDigest(dates[idx]).then(setDigest).catch(() => setDigest(null));
  }, [dates, idx]);

  const patchReviewed = (ids: string[], reviewed: boolean) =>
    setDigest((d) => {
      if (!d) return d;
      const cats = { ...d.categories };
      let reviewedCount = 0;
      for (const s of SECTIONS) {
        cats[s.key] = cats[s.key].map((it) => (ids.includes(it.id) ? { ...it, reviewed } : it));
        reviewedCount += cats[s.key].filter((it) => it.reviewed).length;
      }
      return { ...d, categories: cats, reviewedCount };
    });

  const rows: Row[] = digest ? SECTIONS.flatMap((s) => digest.categories[s.key].map((it) => ({ ...it, section: s.key }))) : [];
  const filtered = rows
    .filter((r) => (section === "all" ? true : r.section === section))
    .filter((r) => (platform === "all" ? true : (r.platform || "unknown") === platform))
    .filter((r) => (unreviewedOnly ? !r.reviewed : true))
    .sort((a, b) => (b.count - a.count) || (PRIO_RANK[a.priority ?? "low"] - PRIO_RANK[b.priority ?? "low"]));

  const unreviewed = rows.filter((r) => !r.reviewed).length;
  const promptBundle = filtered.filter((r) => r.prompt).map((r, n) => `## ${n + 1}. ${r.description}\n\n${r.prompt}`).join("\n\n---\n\n");
  const hasNewer = idx > 0;
  const hasOlder = dates != null && idx < dates.length - 1;

  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const markSelected = async () => {
    if (!digest || sel.size === 0) return;
    setBulkBusy(true);
    const ids = [...sel];
    try { await markDigestItemsReviewed(digest.date, ids, true); patchReviewed(ids, true); setSel(new Set()); } catch { /* ignore */ }
    setBulkBusy(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[12px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">← Admin</Link>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Community digest</h1>

      {/* date pager */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={!hasNewer} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] px-3 py-1.5 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6" /></svg>Newer
        </button>
        <div className="min-w-0 text-center">
          <div className={`${HEAD} truncate text-[15px] font-bold text-[var(--cream)]`}>{dates && dates.length > 0 ? fmtDay(dates[idx]) : "—"}</div>
          {digest && <div className="text-[12px] text-[var(--sage-dim)]">{digest.messageCount ?? 0} messages{unreviewed > 0 ? <> · <span className="font-bold text-[var(--gold)]">{unreviewed} to review</span></> : " · all reviewed"}</div>}
        </div>
        <button onClick={() => setIdx((i) => (dates ? Math.min(dates.length - 1, i + 1) : i))} disabled={!hasOlder} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] px-3 py-1.5 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-40">
          Older<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {digest && (
        // sticky filter bar
        <div className="sticky top-[72px] z-20 -mx-6 mt-4 border-b border-[var(--hair)] bg-[var(--bg-deep)] px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="inline-flex rounded-full bg-white/[0.05] p-1">
              <Chip on={section === "all"} onClick={() => setSection("all")}>All</Chip>
              {SECTIONS.map((s) => <Chip key={s.key} on={section === s.key} onClick={() => setSection(s.key)}>{s.label}</Chip>)}
            </div>
            <div className="inline-flex rounded-full bg-white/[0.05] p-1">
              <Chip on={platform === "all"} onClick={() => setPlatform("all")}>Any</Chip>
              {PLATFORMS.map((p) => <Chip key={p} on={platform === p} onClick={() => setPlatform(p)}>{p}</Chip>)}
            </div>
            <button onClick={() => setUnreviewedOnly((v) => !v)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${unreviewedOnly ? "bg-[var(--gold)] text-[#141B16]" : "bg-white/[0.05] text-[var(--sage)] hover:text-[var(--cream)]"}`}>Unreviewed only</button>
            {promptBundle && <button onClick={() => navigator.clipboard.writeText(promptBundle).catch(() => {})} className="ml-auto rounded-full border border-[var(--gold)]/40 px-3 py-1.5 text-[12px] font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/10">Copy all prompts</button>}
          </div>
        </div>
      )}

      {dates === null || digest === undefined ? (
        <div className="mt-10 flex justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : dates.length === 0 || !digest ? (
        <div className="mt-10 py-16 text-center">
          <div className="text-3xl">💬</div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--cream)]">No digest yet</p>
          <p className="mt-1 text-[13px] text-[var(--text-body)]">The daily job writes one only when there&apos;s activity.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="mt-10 py-12 text-center text-[14px] text-[var(--sage-dim)]">Nothing matches these filters.</p>
      ) : (
        <div className="mt-2 border-t border-[var(--hair)]">
          {filtered.map((r) => (
            <ItemRow
              key={r.id} row={r} date={digest.date}
              expanded={expandedId === r.id}
              onToggle={() => setExpandedId((cur) => (cur === r.id ? null : r.id))}
              selected={sel.has(r.id)} onSelect={() => toggleSel(r.id)}
              onReviewed={(id, rv) => patchReviewed([id], rv)}
              showSection={section === "all"}
            />
          ))}
        </div>
      )}

      {/* filter audit */}
      {digest && digest.ignored && digest.ignored.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowIgnored((v) => !v)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--sage-dim)] transition-colors hover:text-[var(--sage)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`h-3 w-3 transition-transform ${showIgnored ? "rotate-90" : ""}`}><path d="M9 18l6-6-6-6" /></svg>
            Filtered {digest.ignored.length} business/partnership {digest.ignored.length === 1 ? "message" : "messages"} — {showIgnored ? "hide" : "review"}
          </button>
          {showIgnored && (
            <div className="mt-2 space-y-1.5">
              {digest.ignored.map((ig, i) => (
                <div key={i} className="text-[12.5px] text-[var(--text-body)]">{ig.description} <span className="text-[var(--sage-dim)]">· {ig.reason}</span></div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* bulk action bar */}
      {sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-6">
          <div className="flex items-center gap-3 rounded-full bg-[var(--bg-mid)] px-4 py-2.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]">
            <span className="text-[13px] font-semibold text-[var(--cream)]"><b style={NUM} className="text-[var(--gold)]">{sel.size}</b> selected</span>
            <button onClick={() => setSel(new Set())} className="text-[12px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">Clear</button>
            <button onClick={markSelected} disabled={bulkBusy} className="rounded-full bg-[var(--gold)] px-4 py-1.5 text-[12.5px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">{bulkBusy ? "Marking…" : `Mark ${sel.size} reviewed`}</button>
          </div>
        </div>
      )}
    </div>
  );
}
