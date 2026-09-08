"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  getDiscSubmissions, groupLeads, catalogCheck, isLiveOnWeb, getDiscCatalogSafe,
  type DiscSubmission, type DiscLead, type CatalogVerdict,
} from "@/lib/discSubmissions";
import type { DbDisc } from "@/lib/bag";
import { QueuePage, SectionLabel, Card, CardGrid, CardTitle, Tag, Fact, ActionRail, Spinner, Empty, LoadError, Segmented, fmtAgo, HEAD, TONE } from "./QueueShell";

type Tab = "pending" | "approved" | "denied";

const fmtFlight = (d: { speed: number; glide: number; turn: number; fade: number }) => `${d.speed} / ${d.glide} / ${d.turn} / ${d.fade}`;
const platformLabel = (p: string) => (p === "ios" ? "iOS" : p === "android" ? "Android" : p);

function VerdictFact({ verdict }: { verdict: CatalogVerdict }) {
  if (verdict.kind === "none") return <Fact icon="✅" tone="good">Not in the database — real catalog lead</Fact>;
  if (verdict.kind === "exact") {
    return (
      <Fact icon="⚠️" tone="bad">
        Already in the database <span className="text-[var(--sage)]">· we carry <b className="text-[var(--cream)]">{verdict.disc.manufacturer} {verdict.disc.name}</b> at {fmtFlight(verdict.disc)}</span>
      </Fact>
    );
  }
  if (verdict.kind === "nameOtherMfr") {
    return <Fact icon="⚠️" tone="warn">Name exists under {verdict.disc.manufacturer} <span className="text-[var(--sage)]">· could be a dupe, or a genuinely different mold</span></Fact>;
  }
  return <Fact icon="⚠️" tone="warn">Did they mean {verdict.disc.manufacturer} {verdict.disc.name}? <span className="text-[var(--sage)]">· one letter off — likely the same disc</span></Fact>;
}

function LeadCard({ lead, catalog, staffUid, onResolved, readOnly }: {
  lead: DiscLead; catalog: DbDisc[]; staffUid: string;
  onResolved: (ids: string[], status: "approved" | "denied") => void; readOnly?: boolean;
}) {
  const verdict = useMemo(() => catalogCheck(lead, catalog), [lead, catalog]);
  const live = useMemo(() => isLiveOnWeb(lead, catalog), [lead, catalog]);
  const [busy, setBusy] = useState<"primary" | "secondary" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (decision: "approve" | "deny") => {
    if (!staffUid) { setErr("Sign in as staff to act."); return; }
    setBusy(decision === "approve" ? "primary" : "secondary"); setErr(null);
    try {
      const { resolveLead } = await import("@/lib/discSubmissions");
      await resolveLead(lead, decision, staffUid);
      onResolved(lead.submissions.map((s) => s.id), decision === "approve" ? "approved" : "denied");
    } catch (e) {
      console.error("[resolveLead] failed:", e);
      setErr((e as { message?: string })?.message || "Something went wrong.");
      setBusy(null);
    }
  };

  const rep = lead.submissions[0];
  const others = lead.submitterCount - 1;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${lead.manufacturer} ${lead.name} disc golf flight numbers`)}`;

  return (
    <Card dim={readOnly}>
      <CardGrid
        left={
          <>
            <CardTitle
              title={lead.name || "—"}
              tag={<>
                {lead.submitterCount > 1 && <Tag>×{lead.submitterCount} submitted</Tag>}
                {readOnly && live && <Tag tone="good">Live on web</Tag>}
              </>}
              meta={<>{lead.manufacturer || "Custom"} · {lead.category || "—"} · <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtFlight(lead)}</span></>}
            />
            <div className="mt-5 text-[15px]">
              <span className="font-bold text-[var(--cream)]">{rep.submittedByName || "A player"}</span>
              {others > 0 && <span className="text-[var(--sage)]"> and {others} other{others === 1 ? "" : "s"}</span>}
              <span className="text-[var(--sage-dim)]"> · {fmtAgo(lead.latestAt)} · {lead.platforms.map(platformLabel).join(", ")}</span>
            </div>
          </>
        }
        middle={
          <>
            <VerdictFact verdict={verdict} />
            <Fact icon="🔎"><a href={searchUrl} target="_blank" rel="noopener" className="font-semibold hover:underline" style={{ color: TONE.info }}>Search {lead.manufacturer || "the mold"} {lead.name} ↗</a></Fact>
            {!readOnly && <Fact icon="🥏">The player&apos;s custom disc is untouched either way — this only triages a catalog lead</Fact>}
          </>
        }
        right={readOnly ? null : (
          <ActionRail
            primary={{ label: "Approve", busyLabel: "Approving…", onClick: () => act("approve") }}
            secondary={{ label: "Deny", busyLabel: "Denying…", onClick: () => act("deny") }}
            busy={busy}
            error={err}
          />
        )}
      />
    </Card>
  );
}

export default function DiscSubmissionQueue() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<DiscSubmission[] | null>(null);
  const [catalog, setCatalog] = useState<DbDisc[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loadErr, setLoadErr] = useState(false);
  const [showLow, setShowLow] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    getDiscSubmissions().then(setSubs).catch((e) => { console.error(e); setLoadErr(true); setSubs([]); });
    getDiscCatalogSafe().then(setCatalog).catch(() => {});
  }, []);

  const staffUid = user?.uid ?? "";
  const onResolved = (ids: string[], status: "approved" | "denied") =>
    setSubs((prev) => (prev || []).map((s) => (ids.includes(s.id) ? { ...s, status, reviewedBy: staffUid, reviewedAt: Date.now() } : s)));

  const pendingLeads = useMemo(() => groupLeads((subs || []).filter((s) => s.status === "pending")), [subs]);
  // Oldest first — the hub promises "oldest first", so the queue delivers the same order.
  const firstSeen = (l: DiscLead) => Math.min(...l.submissions.map((s) => s.createdAt || Infinity));
  const realLeads = pendingLeads.filter((l) => !l.lowSignal).sort((a, b) => firstSeen(a) - firstSeen(b));
  const lowLeads = pendingLeads.filter((l) => l.lowSignal);
  const approvedLeads = useMemo(() => groupLeads((subs || []).filter((s) => s.status === "approved")), [subs]);
  const deniedLeads = useMemo(() => groupLeads((subs || []).filter((s) => s.status === "denied")), [subs]);

  const denyAllLow = async () => {
    if (!staffUid || lowLeads.length === 0) return;
    setBulkBusy(true);
    const { resolveLead } = await import("@/lib/discSubmissions");
    for (const l of lowLeads) {
      try { await resolveLead(l, "deny", staffUid); onResolved(l.submissions.map((s) => s.id), "denied"); } catch { /* keep going */ }
    }
    setBulkBusy(false);
  };

  const shown = tab === "pending" ? realLeads : tab === "approved" ? approvedLeads : deniedLeads;

  return (
    <QueuePage title="Disc Submissions" blurb={<>Every custom disc a player creates is a catalog lead. Approving stages it for the next catalog release; denying drops it.<br />The player&apos;s custom disc is never touched.</>}>
      <div className="mt-8">
        <Segmented value={tab} onChange={setTab} options={[
          { k: "pending", label: "Pending", n: subs ? realLeads.length : undefined },
          { k: "approved", label: "Approved", n: subs ? approvedLeads.length : undefined },
          { k: "denied", label: "Denied", n: subs ? deniedLeads.length : undefined },
        ]} />
      </div>

      {subs === null ? <Spinner /> : loadErr ? <LoadError /> : shown.length === 0 && !(tab === "pending" && lowLeads.length > 0) ? (
        <Empty emoji="🥏" title={tab === "pending" ? "Queue is clear" : `No ${tab} submissions`} sub={tab === "pending" ? "New custom discs land here as players create them." : undefined} />
      ) : (
        <div className="mt-10 space-y-5">
          {shown.length > 0 && <SectionLabel>{shown.length} {tab}</SectionLabel>}
          {shown.map((l) => (
            <LeadCard key={l.key} lead={l} catalog={catalog} staffUid={staffUid} onResolved={onResolved} readOnly={tab !== "pending"} />
          ))}
        </div>
      )}

      {/* low-signal section (pending only) */}
      {tab === "pending" && lowLeads.length > 0 && (
        <div className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => setShowLow((v) => !v)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--sage-dim)] transition-colors hover:text-[var(--sage)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`h-3 w-3 transition-transform ${showLow ? "rotate-90" : ""}`}><path d="M9 18l6-6-6-6" /></svg>
              Low signal · {lowLeads.length} noise submission{lowLeads.length === 1 ? "" : "s"} (test names, empty customs)
            </button>
            <button onClick={denyAllLow} disabled={bulkBusy} className="rounded-full bg-white/[0.05] px-3.5 py-1.5 text-[12px] font-bold text-[var(--sage)] transition-colors hover:text-[#ef7f7f] disabled:opacity-50">{bulkBusy ? "Denying…" : `Deny all ${lowLeads.length}`}</button>
          </div>
          {showLow && (
            <div className="mt-4 space-y-5 opacity-70">
              {lowLeads.map((l) => <LeadCard key={l.key} lead={l} catalog={catalog} staffUid={staffUid} onResolved={onResolved} />)}
            </div>
          )}
        </div>
      )}

      {/* release-loop footer */}
      <div className="mt-12 rounded-3xl border border-white/[0.06] bg-[#0e1612]/50 p-6 text-[13px] backdrop-blur-md leading-relaxed text-[var(--sage-dim)]">
        <div className={`${HEAD} mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--sage)]`}>How approval reaches players</div>
        Approving <b className="text-[var(--cream)]">stages</b> a disc into <code className="text-[var(--sage)]">discCatalogQueue</code> — it does <b>not</b> edit the live catalog. A staged disc goes live when (1) <b className="text-[var(--cream)]">discs.json is regenerated</b> for web (anytime — the site is dynamic), and (2) iOS/Android <b className="text-[var(--cream)]">compile it into their next release&apos;s DiscDatabase</b>. Until then, approved ≠ live — the <span style={{ color: TONE.good }}>Live on web</span> badge on the Approved tab means the folded name already matches discs.json. Flight numbers players type are often wrong; verify against the manufacturer before a catalog release.
      </div>
    </QueuePage>
  );
}
