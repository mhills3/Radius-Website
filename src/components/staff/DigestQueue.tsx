"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDigest, listDigestDates, markDigestItemReviewed, type Digest, type DigestItem } from "@/lib/communityDigest";
import { parseResolveError } from "@/lib/courseRemoval";

const HEAD = "font-[family-name:var(--font-heading)]";
const BLUE = "#4d94fa"; // community-data accent (same blue as the growth chart)

const fmtDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

type CatKey = "bugs" | "features" | "questions" | "notable";
const CATS: { key: CatKey; label: string }[] = [
  { key: "bugs", label: "Bugs" },
  { key: "features", label: "Feature requests" },
  { key: "questions", label: "Questions" },
  { key: "notable", label: "Notable" },
];

function PlatformChip({ p }: { p?: string }) {
  if (!p) return null;
  return <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-[var(--sage)]">{p}</span>;
}
// where the item came from — community data, so it carries the blue accent.
function SourceChip({ sources }: { sources?: string[] }) {
  if (!sources || sources.length === 0) return null;
  const d = sources.includes("discord");
  const e = sources.includes("email");
  const label = d && e ? "Discord + Email" : e ? "Email" : "Discord";
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `${BLUE}26`, color: BLUE }}>{label}</span>;
}
const linkLabel = (url: string, i: number, total: number) => {
  const kind = url.includes("mail.google.com") ? "email thread" : url.includes("discord.com") ? "Discord" : "source";
  const verb = kind === "email thread" ? "Open" : "View in";
  return total > 1 ? `${kind === "email thread" ? "Email" : kind} ${i + 1}` : `${verb} ${kind}`;
};
function KindChip({ k }: { k?: string }) {
  if (k === "churn_risk") return <span className="rounded-full bg-[#e0873f]/15 px-2 py-0.5 text-[11px] font-bold text-[#e0873f]">Churn risk</span>;
  if (k === "praise") return <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-[var(--sage)]">Praise</span>;
  return null;
}

function Item({ date, item, onToggled }: { date: string; item: DigestItem; onToggled: (id: string, reviewed: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async () => {
    setBusy(true); setErr(null);
    const next = !item.reviewed;
    try {
      const res = await markDigestItemReviewed(date, item.id, next);
      if (res.error) { setErr(res.error); setBusy(false); return; }
      onToggled(item.id, next);
    } catch (e) {
      const { message } = parseResolveError(e);
      setErr(message || "Couldn't update."); setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border border-[var(--hair)] bg-[var(--bg-mid)] p-4 shadow-sm ${item.reviewed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.count > 1 && <span className={`${HEAD} rounded-full bg-[var(--gold)] px-2 py-0.5 text-[12px] font-bold text-[#141B16]`}>×{item.count}</span>}
          <SourceChip sources={item.sources} />
          <PlatformChip p={item.platform} />
          <KindChip k={item.kind} />
        </div>
        {item.reviewed && <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--sage-dim)]">Reviewed</span>}
      </div>

      <p className="mt-2 text-[14.5px] leading-snug text-[var(--cream)]">{item.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {item.links.map((l, i) => {
          const isEmail = l.includes("mail.google.com");
          return (
            <a key={l} href={l} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold hover:underline" style={{ color: BLUE }}>
              {isEmail ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.25.5a18.3 18.3 0 0 1 4.36 1.36 15 15 0 0 0-4.44-1.4 13.8 13.8 0 0 0-6.14 0A15 15 0 0 0 4.5 4.86 18.3 18.3 0 0 1 8.85 3.5L8.6 3a19.8 19.8 0 0 0-4.9 1.4C1 8.9.3 13.3.65 17.6a19.9 19.9 0 0 0 6 3l.8-1.1a13 13 0 0 1-2.02-.98l.5-.37a14.2 14.2 0 0 0 12.14 0l.5.37c-.64.38-1.32.71-2.03.98l.8 1.1a19.9 19.9 0 0 0 6-3c.4-5-.68-9.36-3.36-13.2ZM8.9 15c-1.16 0-2.12-1.07-2.12-2.38S7.72 10.2 8.9 10.2s2.13 1.08 2.11 2.4c0 1.32-.94 2.4-2.11 2.4Zm6.2 0c-1.16 0-2.12-1.07-2.12-2.38s.94-2.4 2.12-2.4 2.13 1.08 2.11 2.4c0 1.32-.93 2.4-2.11 2.4Z" /></svg>
              )}
              {linkLabel(l, i, item.links.length)}
            </a>
          );
        })}
        <button onClick={toggle} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/40 px-3.5 py-1.5 text-[12px] font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/10 disabled:opacity-50">
          {busy ? "…" : item.reviewed ? "Undo" : "Mark reviewed"}
        </button>
      </div>
      {err && <div className="mt-2 rounded-lg border border-[#e0873f]/40 bg-[#e0873f]/[0.08] px-3 py-2 text-[12px] font-semibold text-[#e0873f]">{err}</div>}
    </div>
  );
}

export default function DigestQueue() {
  const [dates, setDates] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [digest, setDigest] = useState<Digest | null | undefined>(undefined);

  useEffect(() => { listDigestDates().then((ds) => { setDates(ds); setIdx(0); }).catch(() => setDates([])); }, []);

  useEffect(() => {
    if (!dates) return;
    if (dates.length === 0) { setDigest(null); return; }
    setDigest(undefined);
    getDigest(dates[idx]).then(setDigest).catch(() => setDigest(null));
  }, [dates, idx]);

  // optimistic reviewed toggle on the loaded digest
  const onToggled = (id: string, reviewed: boolean) =>
    setDigest((d) => {
      if (!d) return d;
      const cats = { ...d.categories };
      let reviewedCount = 0;
      for (const c of CATS) {
        cats[c.key] = cats[c.key].map((it) => (it.id === id ? { ...it, reviewed } : it));
        reviewedCount += cats[c.key].filter((it) => it.reviewed).length;
      }
      return { ...d, categories: cats, reviewedCount };
    });

  const unreviewed = digest ? CATS.reduce((n, c) => n + digest.categories[c.key].filter((it) => !it.reviewed).length, 0) : 0;
  const hasNewer = idx > 0;
  const hasOlder = dates != null && idx < dates.length - 1;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[12px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">← Admin</Link>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Community digest</h1>
      <p className="mt-2 max-w-xl text-[14px] text-[var(--text-body)]">A daily classified read of the Discord — grouped, counted, and linked back to the thread.</p>

      {/* date pager */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={!hasNewer} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] px-3.5 py-1.5 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6" /></svg>Newer
        </button>
        <div className="min-w-0 text-center">
          <div className={`${HEAD} truncate text-[15px] font-bold text-[var(--cream)]`}>{dates && dates.length > 0 ? fmtDay(dates[idx]) : "—"}</div>
          {digest && <div className="text-[12px] text-[var(--sage-dim)]">{digest.messageCount ?? 0} messages · {digest.channelsScanned ?? 0} channels{unreviewed > 0 ? <> · <span className="font-bold text-[var(--gold)]">{unreviewed} to review</span></> : " · all reviewed"}</div>}
        </div>
        <button onClick={() => setIdx((i) => (dates ? Math.min(dates.length - 1, i + 1) : i))} disabled={!hasOlder} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair-strong)] px-3.5 py-1.5 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-40">
          Older<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {dates === null || digest === undefined ? (
        <div className="mt-10 flex justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : dates.length === 0 || !digest ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--hair)] bg-[var(--bg-mid)] p-10 text-center">
          <div className="text-3xl">💬</div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--cream)]">No digest yet</p>
          <p className="mt-1 text-[13px] text-[var(--text-body)]">The daily job writes one only when there&apos;s activity. Check back after it next runs.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {CATS.map((c) => {
            const items = digest.categories[c.key];
            if (items.length === 0) return null;
            return (
              <section key={c.key}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: BLUE }} />
                  <h2 className={`${HEAD} text-[15px] font-bold uppercase tracking-[0.12em]`} style={{ color: BLUE }}>{c.label}</h2>
                  <span className="text-[12px] font-semibold text-[var(--sage-dim)]">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.map((it) => <Item key={it.id} date={digest.date} item={it} onToggled={onToggled} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
