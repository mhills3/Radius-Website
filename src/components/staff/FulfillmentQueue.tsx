"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFulfillments, markFulfillmentShipped, rejectFulfillment, TIER_LABEL, type Fulfillment } from "@/lib/rewards";
import { parseResolveError } from "@/lib/courseRemoval";

const HEAD = "font-[family-name:var(--font-heading)]";
const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const tierText = (t: string[] = []) => (t.includes("gear") && t.includes("bag") ? "Both · Gear + Bag" : t.includes("bag") ? "Bag" : t.includes("gear") ? "Gear" : "—");

// Prefer the server-verified recount over the browser-submitted figure. When they disagree, show both
// so the discrepancy is visible — e.g. "12 courses · claimed 40".
function courseCountText(r: Fulfillment): string | null {
  const verified = r.verifiedCourseCount;
  const claimed = r.courseCount;
  if (verified != null) return claimed != null && claimed !== verified ? `${verified} courses · claimed ${claimed}` : `${verified} courses`;
  if (claimed != null) return `${claimed} courses · unverified`;
  return null;
}

// The full shipping label as one block: name, address, country, phone.
function labelBlock(r: Fulfillment): string {
  return [
    r.fullName,
    r.address1,
    r.address2 || null,
    [r.city, r.region].filter(Boolean).join(", ") + (r.postcode ? ` ${r.postcode}` : ""),
    r.country,
    r.phone ? `☎ ${r.phone}` : null,
  ].filter(Boolean).join("\n");
}

function Card({ r, onShipped, onRejected }: { r: Fulfillment; onShipped: (id: string, tracking: string, note: string) => void; onRejected: (id: string, reason: string) => void }) {
  const [mode, setMode] = useState<"idle" | "ship" | "reject">("idle");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const shipped = r.status === "shipped";
  const rejected = r.status === "rejected" || r.status === "dismissed";

  const copy = async () => {
    try { await navigator.clipboard.writeText(labelBlock(r)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const confirmShip = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await markFulfillmentShipped(r.id, tracking.trim() || undefined, note.trim() || undefined);
      if (res.error) { setErr(res.error); setBusy(false); return; }
      onShipped(r.id, tracking.trim(), note.trim());
    } catch (e) {
      console.error("[markFulfillmentShipped] failed:", e);
      const { code, message } = parseResolveError(e);
      setErr(`${message} · ${code}`); setBusy(false);
    }
  };

  const confirmReject = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await rejectFulfillment(r.id, reason.trim() || undefined);
      if (res.error) { setErr(res.error); setBusy(false); return; }
      onRejected(r.id, reason.trim());
    } catch (e) {
      console.error("[rejectFulfillment] failed:", e);
      const { code, message } = parseResolveError(e);
      setErr(`${message} · ${code}`); setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border bg-[var(--bg-mid)] p-5 shadow-sm border-[var(--hair)] ${shipped || rejected ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`${HEAD} text-[19px] font-bold text-[var(--cream)]`}>{r.fullName || "—"}</h3>
            <span className="rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--gold)]">{tierText(r.tiers)}</span>
            {shipped && <span className="rounded-full bg-[#5fcf80]/15 px-2 py-0.5 text-[11px] font-bold text-[#5fcf80]">Shipped</span>}
            {rejected && <span className="rounded-full bg-[#e0526a]/15 px-2 py-0.5 text-[11px] font-bold text-[#e0526a]">Rejected</span>}
          </div>
          <div className="mt-1 text-[12.5px] text-[var(--sage-dim)]" style={{ fontFamily: "'Sora', sans-serif" }}>{fmtDate(r.submittedAt)}{courseCountText(r) ? ` · ${courseCountText(r)}` : ""}</div>
        </div>
        <button onClick={copy} className="shrink-0 rounded-full border border-[var(--hair-strong)] px-3 py-1.5 text-[12px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">{copied ? "Copied ✓" : "Copy address"}</button>
      </div>

      {/* label-ready address block */}
      <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-[var(--hair)] bg-white/[0.02] px-4 py-3 text-[14px] leading-relaxed text-[var(--cream)]" style={{ fontFamily: "inherit" }}>{labelBlock(r)}</pre>

      {/* country + phone + email prominent */}
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Country</div><div className="text-[15px] font-bold text-[var(--cream)]">{r.country || "—"}</div></div>
        <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Phone</div><div className="text-[15px] font-bold text-[var(--cream)]">{r.phone || <span className="text-[#e0873f]">missing</span>}</div></div>
        <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Email</div>{r.email ? <a href={`mailto:${r.email}`} className="block truncate text-[15px] font-bold text-[var(--gold)] hover:underline">{r.email}</a> : <div className="text-[15px] font-bold text-[#e0873f]">missing</div>}</div>
      </div>

      {(r.bagRequest || r.bagLink) && (
        <div className="mt-3 rounded-xl border border-[var(--hair)] bg-white/[0.02] px-4 py-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Bag request</div>
          {r.bagRequest && <p className="mt-1 text-[14px] text-[var(--cream)]">{r.bagRequest}</p>}
          {r.bagLink && <a href={r.bagLink} target="_blank" rel="noopener" className="mt-1 block truncate text-[13px] font-semibold text-[var(--gold)] hover:underline">{r.bagLink}</a>}
        </div>
      )}
      {r.notes && <p className="mt-3 text-[13px] text-[var(--text-body)]">Note: {r.notes}</p>}

      {shipped ? (
        <div className="mt-4 border-t border-[var(--hair)] pt-3 text-[12.5px] text-[var(--sage-dim)]">Shipped {fmtDate(r.shippedAt)}{r.tracking ? ` · ${r.tracking}` : ""}{r.shipNote ? ` · ${r.shipNote}` : ""}</div>
      ) : rejected ? (
        <div className="mt-4 border-t border-[var(--hair)] pt-3 text-[12.5px] font-semibold text-[#e0526a]">Rejected{r.rejectedAt ? ` ${fmtDate(r.rejectedAt)}` : ""}{r.rejectReason ? ` · ${r.rejectReason}` : ""}</div>
      ) : (
        <div className="mt-4 border-t border-[var(--hair)] pt-4">
          {mode === "idle" ? (
            <div className="flex items-center gap-2.5">
              <button onClick={() => { setMode("ship"); setErr(null); }} className="flex items-center gap-2 rounded-full bg-[var(--gold)] px-5 py-2.5 text-[13px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 6L9 17l-5-5" /></svg>Mark shipped</button>
              <button onClick={() => { setMode("reject"); setErr(null); }} aria-label="Reject claim" title="Reject claim" className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-[#e0526a]/35 text-[#e0526a] transition-colors hover:bg-[#e0526a]/10"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" /></svg></button>
            </div>
          ) : mode === "ship" ? (
            <div className="space-y-2.5">
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number (optional)" className="w-full rounded-xl border border-[var(--hair-strong)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-[var(--hair-strong)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50" />
              {err && <div className="rounded-lg border border-[#e0873f]/40 bg-[#e0873f]/[0.08] px-3 py-2 text-[12.5px] font-semibold text-[#e0873f]">{err}</div>}
              <div className="flex gap-2.5">
                <button onClick={() => { setMode("idle"); setErr(null); }} disabled={busy} className="rounded-full border border-[var(--hair-strong)] px-4 py-2 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-50">Cancel</button>
                <button onClick={confirmShip} disabled={busy} className="rounded-full bg-[var(--gold)] px-5 py-2 text-[13px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">{busy ? "Marking…" : "Confirm shipped"}</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-[13px] font-semibold text-[var(--cream)]">Reject this claim? Nothing ships and it leaves the pending queue.</div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional — e.g. duplicate, fraudulent)" className="w-full rounded-xl border border-[var(--hair-strong)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[#e0526a]/60" />
              {err && <div className="rounded-lg border border-[#e0873f]/40 bg-[#e0873f]/[0.08] px-3 py-2 text-[12.5px] font-semibold text-[#e0873f]">{err}</div>}
              <div className="flex gap-2.5">
                <button onClick={() => { setMode("idle"); setErr(null); }} disabled={busy} className="rounded-full border border-[var(--hair-strong)] px-4 py-2 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-50">Cancel</button>
                <button onClick={confirmReject} disabled={busy} className="rounded-full bg-[#e0526a] px-5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#d13d57] disabled:opacity-50">{busy ? "Rejecting…" : "Reject claim"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Filter = "pending" | "completed" | "rejected" | "all";
type Quarter = 0 | 1 | 2 | 3 | 4; // 0 = whole year

// claims are batched into quarterly shipments — group by the quarter they were submitted.
const yearOf = (ms: number) => new Date(ms).getFullYear();
const quarterOf = (ms: number) => Math.floor(new Date(ms).getMonth() / 3) + 1; // 1..4
const QUARTERS: { q: Quarter; label: string }[] = [{ q: 0, label: "Full year" }, { q: 1, label: "Q1" }, { q: 2, label: "Q2" }, { q: 3, label: "Q3" }, { q: 4, label: "Q4" }];

export default function FulfillmentQueue() {
  const [rows, setRows] = useState<Fulfillment[] | null>(null);
  const [status, setStatus] = useState<Filter>("pending");
  const [year, setYear] = useState<number | "all">("all");
  const [quarter, setQuarter] = useState<Quarter>(0);

  useEffect(() => { getFulfillments().then(setRows).catch(() => setRows([])); }, []);
  // default to the current quarter's shipping batch — set on mount (client-only) to avoid an SSR date mismatch.
  useEffect(() => {
    const now = new Date();
    setYear(now.getFullYear());
    setQuarter((Math.floor(now.getMonth() / 3) + 1) as Quarter);
  }, []);

  const onShipped = (id: string, tracking: string, note: string) =>
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, status: "shipped", tracking, shipNote: note, shippedAt: Date.now() } : r)) ?? rs);
  const onRejected = (id: string, reason: string) =>
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, status: "rejected", rejectReason: reason, rejectedAt: Date.now() } : r)) ?? rs);

  const all = rows || [];
  // years present in the data + whatever year is selected (so the current year always has an option even
  // with no claims yet), newest first — populates the dropdown so it self-organizes.
  const years = Array.from(new Set([
    ...(typeof year === "number" ? [year] : []),
    ...all.map((r) => (r.submittedAt ? yearOf(r.submittedAt) : null)).filter((y): y is number => y != null),
  ])).sort((a, b) => b - a);

  const isRejected = (r: Fulfillment) => r.status === "rejected" || r.status === "dismissed";
  const isPending = (r: Fulfillment) => r.status !== "shipped" && !isRejected(r);
  const matchStatus = (r: Fulfillment) => (status === "all" ? true : status === "completed" ? r.status === "shipped" : status === "rejected" ? isRejected(r) : isPending(r));
  const matchYear = (r: Fulfillment) => year === "all" || (r.submittedAt != null && yearOf(r.submittedAt) === year);
  const matchQuarter = (r: Fulfillment) => quarter === 0 || (r.submittedAt != null && quarterOf(r.submittedAt) === quarter);

  const shown = all.filter((r) => matchStatus(r) && matchYear(r) && matchQuarter(r));

  // period-aware tab counts so "what's needed vs what we did" reads at a glance for the chosen window.
  const inPeriod = (r: Fulfillment) => matchYear(r) && matchQuarter(r);
  const pendingCount = all.filter((r) => isPending(r) && inPeriod(r)).length;
  const completedCount = all.filter((r) => r.status === "shipped" && inPeriod(r)).length;
  const rejectedCount = all.filter((r) => isRejected(r) && inPeriod(r)).length;
  const TABS: { k: Filter; label: string }[] = [
    { k: "pending", label: `Pending${pendingCount ? ` (${pendingCount})` : ""}` },
    { k: "completed", label: `Completed${completedCount ? ` (${completedCount})` : ""}` },
    { k: "rejected", label: `Rejected${rejectedCount ? ` (${rejectedCount})` : ""}` },
    { k: "all", label: "All" },
  ];

  // quarter pill counts respect the status + year selection (ignore quarter) → shows the spread across the year.
  const inScope = all.filter((r) => matchStatus(r) && matchYear(r));
  const qCount = (q: Quarter) => (q === 0 ? inScope.length : inScope.filter((r) => r.submittedAt != null && quarterOf(r.submittedAt) === q).length);

  const periodLabel = year === "all" ? (quarter === 0 ? "all time" : `Q${quarter}, all years`) : quarter === 0 ? `${year}` : `Q${quarter} ${year}`;
  const noun = status === "completed" ? "shipped" : status === "pending" ? "to ship" : status === "rejected" ? "rejected" : "total";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[12px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">← Admin</Link>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Reward fulfillment</h1>
      <p className="mt-2 max-w-xl text-[14px] text-[var(--text-body)]">Builder gear + bag claims. The address reads straight onto a label — copy it, ship it, mark it shipped.</p>

      <div className="mt-6 inline-flex rounded-full bg-white/[0.05] p-1">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setStatus(t.k)} className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${status === t.k ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{t.label}</button>
        ))}
      </div>

      {/* period: year dropdown + quarter pills — auto-organizes claims into quarterly shipping batches */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={String(year)}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="appearance-none rounded-full border border-[var(--hair-strong)] bg-white/[0.04] py-1.5 pl-4 pr-9 text-[13px] font-bold text-[var(--cream)] outline-none transition-colors focus:border-[var(--gold)]/50"
          >
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--sage)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <div className="inline-flex rounded-full bg-white/[0.05] p-1">
          {QUARTERS.map((qq) => {
            const c = qCount(qq.q);
            const on = quarter === qq.q;
            return (
              <button key={qq.q} onClick={() => setQuarter(qq.q)} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${on ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>
                {qq.label}
                {c > 0 && <span className={`text-[11px] ${on ? "text-[#141B16]/70" : "text-[var(--sage-dim)]"}`}>{c}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {rows === null ? (
        <div className="mt-10 flex justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--hair)] bg-[var(--bg-mid)] p-10 text-center">
          <div className="text-3xl">{status === "pending" ? "✅" : status === "rejected" ? "🚫" : "📦"}</div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--cream)]">{status === "pending" ? "Nothing to ship" : status === "rejected" ? "No rejected claims" : "Nothing here"} <span className="text-[var(--sage-dim)]">· {periodLabel}</span></p>
        </div>
      ) : (
        <>
          <div className="mt-6 text-[12.5px] font-semibold text-[var(--sage-dim)]">{shown.length} {noun} · {periodLabel}</div>
          <div className="mt-3 space-y-5">{shown.map((r) => <Card key={r.id} r={r} onShipped={onShipped} onRejected={onRejected} />)}</div>
        </>
      )}
    </div>
  );
}
