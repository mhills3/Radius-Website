"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFulfillments, markFulfillmentShipped, TIER_LABEL, type Fulfillment } from "@/lib/rewards";
import { parseResolveError } from "@/lib/courseRemoval";

const HEAD = "font-[family-name:var(--font-heading)]";
const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const tierText = (t: string[] = []) => (t.includes("gear") && t.includes("bag") ? "Both · Gear + Bag" : t.includes("bag") ? "Bag" : t.includes("gear") ? "Gear" : "—");

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

function Card({ r, onShipped }: { r: Fulfillment; onShipped: (id: string, tracking: string, note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const shipped = r.status === "shipped";

  const copy = async () => {
    try { await navigator.clipboard.writeText(labelBlock(r)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const confirm = async () => {
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

  return (
    <div className={`rounded-2xl border bg-[var(--bg-mid)] p-5 shadow-sm ${shipped ? "border-[var(--hair)] opacity-80" : "border-[var(--hair)]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`${HEAD} text-[19px] font-bold text-[var(--cream)]`}>{r.fullName || "—"}</h3>
            <span className="rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--gold)]">{tierText(r.tiers)}</span>
            {shipped && <span className="rounded-full bg-[#5fcf80]/15 px-2 py-0.5 text-[11px] font-bold text-[#5fcf80]">Shipped</span>}
          </div>
          <div className="mt-1 text-[12.5px] text-[var(--sage-dim)]" style={{ fontFamily: "'Sora', sans-serif" }}>{fmtDate(r.submittedAt)}{r.courseCount != null ? ` · ${r.courseCount} courses` : ""}</div>
        </div>
        <button onClick={copy} className="shrink-0 rounded-full border border-[var(--hair-strong)] px-3 py-1.5 text-[12px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)]">{copied ? "Copied ✓" : "Copy address"}</button>
      </div>

      {/* label-ready address block */}
      <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-[var(--hair)] bg-white/[0.02] px-4 py-3 text-[14px] leading-relaxed text-[var(--cream)]" style={{ fontFamily: "inherit" }}>{labelBlock(r)}</pre>

      {/* country + phone prominent */}
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Country</div><div className="text-[15px] font-bold text-[var(--cream)]">{r.country || "—"}</div></div>
        <div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Phone</div><div className="text-[15px] font-bold text-[var(--cream)]">{r.phone || <span className="text-[#e0873f]">missing</span>}</div></div>
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
      ) : (
        <div className="mt-4 border-t border-[var(--hair)] pt-4">
          {!open ? (
            <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full bg-[var(--gold)] px-5 py-2.5 text-[13px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 6L9 17l-5-5" /></svg>Mark shipped</button>
          ) : (
            <div className="space-y-2.5">
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number (optional)" className="w-full rounded-xl border border-[var(--hair-strong)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-[var(--hair-strong)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50" />
              {err && <div className="rounded-lg border border-[#e0873f]/40 bg-[#e0873f]/[0.08] px-3 py-2 text-[12.5px] font-semibold text-[#e0873f]">{err}</div>}
              <div className="flex gap-2.5">
                <button onClick={() => { setOpen(false); setErr(null); }} disabled={busy} className="rounded-full border border-[var(--hair-strong)] px-4 py-2 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-50">Cancel</button>
                <button onClick={confirm} disabled={busy} className="rounded-full bg-[var(--gold)] px-5 py-2 text-[13px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">{busy ? "Marking…" : "Confirm shipped"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Filter = "pending" | "completed" | "all";

export default function FulfillmentQueue() {
  const [rows, setRows] = useState<Fulfillment[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  useEffect(() => { getFulfillments().then(setRows).catch(() => setRows([])); }, []);

  const onShipped = (id: string, tracking: string, note: string) =>
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, status: "shipped", tracking, shipNote: note, shippedAt: Date.now() } : r)) ?? rs);

  const pending = (rows || []).filter((r) => r.status !== "shipped");
  const shown = filter === "all" ? (rows || []) : filter === "completed" ? (rows || []).filter((r) => r.status === "shipped") : pending;
  const TABS: { k: Filter; label: string }[] = [{ k: "pending", label: `Pending${pending.length ? ` (${pending.length})` : ""}` }, { k: "completed", label: "Completed" }, { k: "all", label: "All" }];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[12px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">← Admin</Link>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Reward fulfillment</h1>
      <p className="mt-2 max-w-xl text-[14px] text-[var(--text-body)]">Builder gear + bag claims. The address reads straight onto a label — copy it, ship it, mark it shipped.</p>

      <div className="mt-6 inline-flex rounded-full bg-white/[0.05] p-1">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setFilter(t.k)} className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${filter === t.k ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{t.label}</button>
        ))}
      </div>

      {rows === null ? (
        <div className="mt-10 flex justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : shown.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--hair)] bg-[var(--bg-mid)] p-10 text-center">
          <div className="text-3xl">{filter === "pending" ? "✅" : "📦"}</div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--cream)]">{filter === "pending" ? "Nothing to ship" : "Nothing here"}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">{shown.map((r) => <Card key={r.id} r={r} onShipped={onShipped} />)}</div>
      )}
    </div>
  );
}
