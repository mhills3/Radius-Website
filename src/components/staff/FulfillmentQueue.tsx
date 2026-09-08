"use client";

import { useEffect, useState } from "react";
import { getFulfillments, markFulfillmentShipped, rejectFulfillment, type Fulfillment } from "@/lib/rewards";
import { parseResolveError } from "@/lib/courseRemoval";
import { QueuePage, SectionLabel, Card, CardGrid, CardTitle, Tag, Fact, Spinner, Empty, Segmented, BTN, TONE } from "./QueueShell";

const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const tierText = (t: string[] = []) => (t.includes("gear") && t.includes("bag") ? "Gear + Bag" : t.includes("bag") ? "Bag" : t.includes("gear") ? "Gear" : "—");
const DAY = 86_400_000;
// Claims ship in quarterly batches — everything submitted in a quarter is due by that quarter's last day.
const quarterEndMs = (year: number, q: 1 | 2 | 3 | 4) => new Date(year, q * 3, 0, 23, 59, 59, 999).getTime(); // day 0 of next quarter's first month = last day of this quarter
const fmtDue = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysLeft = (ms: number) => Math.ceil((ms - Date.now()) / DAY);
const dueTone = (ms: number): "good" | "warn" | "bad" => (daysLeft(ms) <= 7 ? "bad" : daysLeft(ms) <= 21 ? "warn" : "good");
const dueText = (ms: number) => { const d = daysLeft(ms); return d < 0 ? `${-d} day${d === -1 ? "" : "s"} overdue` : d === 0 ? "due today" : `${d} day${d === 1 ? "" : "s"} left`; };
const isDomestic = (country?: string) => /^(us|usa|u\.s\.a?\.?|united states( of america)?)$/i.test((country || "").trim());

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

const input = "w-full rounded-xl border border-[var(--hair)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50";

function ClaimCard({ r, onShipped, onRejected }: { r: Fulfillment; onShipped: (id: string, tracking: string, note: string) => void; onRejected: (id: string, reason: string) => void }) {
  const [mode, setMode] = useState<"idle" | "ship" | "reject">("idle");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const shipped = r.status === "shipped";
  const rejected = r.status === "rejected" || r.status === "dismissed";
  const intl = !!r.country && !isDomestic(r.country);

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

  const errBox = err && <div className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold leading-snug" style={{ color: TONE.bad, background: "rgba(239,127,127,0.10)" }}>{err}</div>;

  return (
    <Card dim={shipped || rejected}>
      <CardGrid
        left={
          <>
            <CardTitle
              title={r.fullName || "—"}
              tag={<>
                <Tag>{tierText(r.tiers)}</Tag>
                {shipped && <Tag tone="good">Shipped</Tag>}
                {rejected && <Tag tone="bad">Rejected</Tag>}
              </>}
              meta={[`Claimed ${fmtDate(r.submittedAt)}`, courseCountText(r)].filter(Boolean).join(" · ")}
            />
            {/* label-ready address block */}
            <pre className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--cream)]" style={{ fontFamily: "inherit" }}>{labelBlock(r)}</pre>
            <button onClick={copy} className="mt-2 text-[14px] font-semibold text-[var(--gold)] hover:underline">{copied ? "Copied ✓" : "Copy address"}</button>
          </>
        }
        middle={
          <>
            <Fact icon="🌍" tone={intl ? "warn" : "neutral"}>
              <b className="text-[var(--cream)]">{r.country || "—"}</b>{intl ? " · international shipping" : ""}
            </Fact>
            <Fact icon="☎️" tone={r.phone ? "neutral" : "bad"}>{r.phone ? <b className="text-[var(--cream)]">{r.phone}</b> : "No phone — carriers may need one"}</Fact>
            <Fact icon="✉️" tone={r.email ? "neutral" : "bad"}>{r.email ? <a href={`mailto:${r.email}`} className="text-[var(--cream)] hover:text-[var(--gold)] hover:underline">{r.email}</a> : "No email on file"}</Fact>
            {(r.bagRequest || r.bagLink) && (
              <Fact icon="🎒">
                {r.bagRequest && <span className="text-[var(--cream)]">{r.bagRequest}</span>}
                {r.bagLink && <a href={r.bagLink} target="_blank" rel="noopener" className="block truncate font-semibold text-[var(--gold)] hover:underline">{r.bagLink}</a>}
              </Fact>
            )}
            {r.notes && <Fact icon="📝"><span className="italic">&ldquo;{r.notes}&rdquo;</span></Fact>}
            {!shipped && !rejected && r.submittedAt != null && (() => {
              const due = quarterEndMs(yearOf(r.submittedAt), quarterOf(r.submittedAt) as 1 | 2 | 3 | 4);
              return <Fact icon="⏳" tone={dueTone(due)}>Due <b className="text-[var(--cream)]">{fmtDue(due)}</b> · Q{quarterOf(r.submittedAt)} batch · {dueText(due)}</Fact>;
            })()}
            {shipped && <Fact icon="✅" tone="good">Shipped {fmtDate(r.shippedAt)}{r.tracking ? ` · ${r.tracking}` : ""}{r.shipNote ? ` · ${r.shipNote}` : ""}</Fact>}
            {rejected && <Fact icon="🚫" tone="bad">Rejected{r.rejectedAt ? ` ${fmtDate(r.rejectedAt)}` : ""}{r.rejectReason ? ` · ${r.rejectReason}` : ""}</Fact>}
          </>
        }
        right={
          shipped || rejected ? null : mode === "idle" ? (
            <div className="space-y-3">
              <button onClick={() => { setMode("ship"); setErr(null); }} className={BTN.primary}>Mark shipped</button>
              <button onClick={() => { setMode("reject"); setErr(null); }} className={BTN.secondary}>Reject</button>
            </div>
          ) : mode === "ship" ? (
            <div className="space-y-2.5">
              <input autoFocus value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking number (optional)" className={input} />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={input} />
              {errBox}
              <button onClick={confirmShip} disabled={busy} className={BTN.primary}>{busy ? "Marking…" : "Confirm shipped"}</button>
              <button onClick={() => { setMode("idle"); setErr(null); }} disabled={busy} className="block w-full text-center text-[14px] text-[var(--sage-dim)] transition-colors hover:text-[var(--sage)]">Cancel</button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="text-[13px] leading-snug text-[var(--sage)]">Nothing ships and it leaves the pending queue.</div>
              <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional — e.g. duplicate, fraudulent)" className={input} />
              {errBox}
              <button onClick={confirmReject} disabled={busy} className={BTN.danger}>{busy ? "Rejecting…" : "Reject claim"}</button>
              <button onClick={() => { setMode("idle"); setErr(null); }} disabled={busy} className="block w-full text-center text-[14px] text-[var(--sage-dim)] transition-colors hover:text-[var(--sage)]">Cancel</button>
            </div>
          )
        }
      />
    </Card>
  );
}

type Filter = "pending" | "completed" | "rejected" | "all";
type TierFilter = "all" | "gear" | "bag" | "both";
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
  const [tier, setTier] = useState<TierFilter>("all");

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
  // Gear = anyone who needs a gear bundle (incl. both-claims); Bag likewise; Both = needs both.
  const hasTier = (r: Fulfillment, t: "gear" | "bag") => (r.tiers || []).includes(t);
  const matchTier = (r: Fulfillment) => tier === "all" ? true : tier === "both" ? hasTier(r, "gear") && hasTier(r, "bag") : hasTier(r, tier);

  // Oldest first for the pending queue (clear the old ones); newest first for history.
  const shown = all
    .filter((r) => matchStatus(r) && matchYear(r) && matchQuarter(r) && matchTier(r))
    .sort((a, b) => (status === "pending" ? (a.submittedAt ?? Infinity) - (b.submittedAt ?? Infinity) : (b.submittedAt ?? 0) - (a.submittedAt ?? 0)));

  // period-aware tab counts so "what's needed vs what we did" reads at a glance for the chosen window.
  const inPeriod = (r: Fulfillment) => matchYear(r) && matchQuarter(r) && matchTier(r);
  const pendingCount = all.filter((r) => isPending(r) && inPeriod(r)).length;
  const completedCount = all.filter((r) => r.status === "shipped" && inPeriod(r)).length;
  const rejectedCount = all.filter((r) => isRejected(r) && inPeriod(r)).length;

  // quarter pill counts respect the status + year selection (ignore quarter) → shows the spread across the year.
  const inScope = all.filter((r) => matchStatus(r) && matchYear(r) && matchTier(r));
  // tier pill counts respect status + period (ignore tier) → what's in each pile for this batch.
  const tierScope = all.filter((r) => matchStatus(r) && matchYear(r) && matchQuarter(r));
  const tCount = (t: TierFilter) => tierScope.filter((r) => t === "all" ? true : t === "both" ? hasTier(r, "gear") && hasTier(r, "bag") : hasTier(r, t)).length;

  // The batch deadline: end of the selected quarter, or of the current quarter when viewing a whole year.
  const now = new Date();
  const dueYear = typeof year === "number" ? year : now.getFullYear();
  const dueQ = (quarter === 0 ? Math.floor(now.getMonth() / 3) + 1 : quarter) as 1 | 2 | 3 | 4;
  const dueMs = quarterEndMs(dueYear, dueQ);
  const dueColor = { good: "#8fe0a5", warn: "#f0c069", bad: "#ef7f7f" }[dueTone(dueMs)];
  const qCount = (q: Quarter) => (q === 0 ? inScope.length : inScope.filter((r) => r.submittedAt != null && quarterOf(r.submittedAt) === q).length);

  const periodLabel = year === "all" ? (quarter === 0 ? "all time" : `Q${quarter}, all years`) : quarter === 0 ? `${year}` : `Q${quarter} ${year}`;
  const noun = status === "completed" ? "shipped" : status === "pending" ? "to ship" : status === "rejected" ? "rejected" : "total";
  const tierLabel = tier === "all" ? "" : tier === "both" ? " · gear + bag" : ` · ${tier}`;

  return (
    <QueuePage title="Reward Fulfillment" blurb={<>Builder gear + bag claims, batched into quarterly shipments. The address reads straight onto a label — copy it, ship it, mark it shipped.<br />Rejecting ships nothing and drops the claim from the queue.</>}>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Segmented value={status} onChange={setStatus} options={[
          { k: "pending", label: "Pending", n: pendingCount },
          { k: "completed", label: "Completed", n: completedCount },
          { k: "rejected", label: "Rejected", n: rejectedCount },
          { k: "all", label: "All" },
        ]} />
        <div className="relative">
          <select
            value={String(year)}
            onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="appearance-none rounded-full bg-white/[0.05] py-2 pl-4 pr-9 text-[13px] font-bold text-[var(--cream)] outline-none"
          >
            <option value="all">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--sage)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
        </div>
        <Segmented value={quarter} onChange={setQuarter} options={QUARTERS.map((qq) => ({ k: qq.q, label: qq.label, n: qCount(qq.q) }))} />
        <Segmented value={tier} onChange={setTier} options={[
          { k: "all", label: "All rewards" },
          { k: "gear", label: "Gear", n: tCount("gear") },
          { k: "bag", label: "Bag", n: tCount("bag") },
          { k: "both", label: "Gear + Bag", n: tCount("both") },
        ]} />
      </div>

      {/* batch deadline */}
      {status === "pending" && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/[0.06] bg-[#0e1612]/50 px-6 py-4 backdrop-blur-md">
          <span className="text-[22px] leading-none">⏳</span>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] text-[var(--cream)]">Q{dueQ} {dueYear} batch due <b>{fmtDue(dueMs)}</b></div>
            <div className="mt-0.5 text-[13px] text-[var(--sage-dim)]">Everything claimed in a quarter ships by that quarter&apos;s last day{quarter === 0 ? " · showing the current quarter's deadline" : ""}.</div>
          </div>
          <span className="text-[15px] font-bold" style={{ color: dueColor }}>{dueText(dueMs)}</span>
        </div>
      )}

      {rows === null ? <Spinner /> : shown.length === 0 ? (
        <Empty emoji={status === "pending" ? "✅" : status === "rejected" ? "🚫" : "📦"} title={<>{status === "pending" ? "Nothing to ship" : status === "rejected" ? "No rejected claims" : "Nothing here"} <span className="text-[var(--sage-dim)]">· {periodLabel}{tierLabel}</span></>} />
      ) : (
        <div className="mt-10 space-y-5">
          <SectionLabel>{shown.length} {noun} · {periodLabel}{tierLabel}</SectionLabel>
          {shown.map((r) => <ClaimCard key={r.id} r={r} onShipped={onShipped} onRejected={onRejected} />)}
        </div>
      )}
    </QueuePage>
  );
}
