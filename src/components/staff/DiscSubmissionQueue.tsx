"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  getDiscSubmissions, groupLeads, catalogCheck, isLiveOnWeb, getDiscCatalogSafe,
  type DiscSubmission, type DiscLead, type CatalogVerdict,
} from "@/lib/discSubmissions";
import type { DbDisc } from "@/lib/bag";

const HEAD = "font-[family-name:var(--font-heading)]";
type Tab = "pending" | "approved" | "denied";

const fmtFlight = (d: { speed: number; glide: number; turn: number; fade: number }) => `${d.speed} / ${d.glide} / ${d.turn} / ${d.fade}`;
const fmtAgo = (ms: number) => {
  if (!ms) return "";
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  const d = Math.round(s / 86400);
  return `${d}d ago`;
};

function CatalogBanner({ verdict }: { verdict: CatalogVerdict }) {
  if (verdict.kind === "none") {
    return (
      <div className="rounded-xl border px-3.5 py-2.5 text-[13px] font-semibold" style={{ borderColor: "rgba(95,207,128,0.35)", background: "rgba(95,207,128,0.10)", color: "#8fe0a5" }}>
        ✅ Not in the database — real catalog lead
      </div>
    );
  }
  if (verdict.kind === "exact") {
    return (
      <div className="rounded-xl border px-3.5 py-2.5 text-[13px]" style={{ borderColor: "rgba(224,135,63,0.4)", background: "rgba(224,135,63,0.10)" }}>
        <span className="font-bold text-[#e0873f]">Already in the database</span>
        <span className="text-[var(--sage)]"> · we carry <b className="text-[var(--cream)]">{verdict.disc.manufacturer} {verdict.disc.name}</b> at {fmtFlight(verdict.disc)}</span>
      </div>
    );
  }
  if (verdict.kind === "nameOtherMfr") {
    return (
      <div className="rounded-xl border px-3.5 py-2.5 text-[13px]" style={{ borderColor: "rgba(232,181,96,0.35)", background: "rgba(232,181,96,0.09)" }}>
        <span className="font-bold text-[#E8B560]">Name exists under {verdict.disc.manufacturer}</span>
        <span className="text-[var(--sage)]"> · could be a dupe, or a genuinely different mold</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border px-3.5 py-2.5 text-[13px]" style={{ borderColor: "rgba(232,181,96,0.35)", background: "rgba(232,181,96,0.09)" }}>
      <span className="font-bold text-[#E8B560]">Did they mean {verdict.disc.manufacturer} {verdict.disc.name}?</span>
      <span className="text-[var(--sage)]"> · one letter off — likely the same disc</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-[var(--sage)]">{children}</span>;
}

function LeadCard({ lead, catalog, staffUid, onResolved, readOnly }: {
  lead: DiscLead; catalog: DbDisc[]; staffUid: string;
  onResolved: (ids: string[], status: "approved" | "denied") => void; readOnly?: boolean;
}) {
  const verdict = useMemo(() => catalogCheck(lead, catalog), [lead, catalog]);
  const live = useMemo(() => isLiveOnWeb(lead, catalog), [lead, catalog]);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (decision: "approve" | "deny") => {
    if (!staffUid) { setErr("Sign in as staff to act."); return; }
    setBusy(decision); setErr(null);
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
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${lead.manufacturer} ${lead.name} disc golf flight numbers`)}`;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${HEAD} text-[18px] font-bold text-[var(--cream)]`}>{lead.name || "—"}</span>
            {lead.submitterCount > 1 && <span className="rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--gold)]">×{lead.submitterCount} submitted</span>}
            {readOnly && live && <span className="rounded-full bg-[#5fcf80]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8fe0a5]">Live on web</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--sage-dim)]">
            <span className="font-semibold text-[var(--sage)]">{lead.manufacturer || "Custom"}</span>
            <span>·</span><span>{lead.category || "—"}</span>
            <span>·</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtFlight(lead)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {lead.platforms.map((p) => <Chip key={p}>{p === "ios" ? "iOS" : p === "android" ? "Android" : p}</Chip>)}
        </div>
      </div>

      <div className="mt-2 text-[12px] text-[var(--sage-dim)]">
        {rep.submittedByName || "A player"}{lead.submitterCount > 1 ? ` and ${lead.submitterCount - 1} other${lead.submitterCount - 1 === 1 ? "" : "s"}` : ""} · {fmtAgo(lead.latestAt)}
      </div>

      <div className="mt-3"><CatalogBanner verdict={verdict} /></div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href={searchUrl} target="_blank" rel="noopener" className="text-[12.5px] font-bold text-[#4d94fa] hover:underline">Search {lead.manufacturer || "the mold"} {lead.name} ↗</a>
        {!readOnly && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => act("deny")} disabled={!!busy} className="rounded-full border border-white/15 px-4 py-1.5 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[#e0873f] disabled:opacity-50">{busy === "deny" ? "Denying…" : "Deny"}</button>
            <button onClick={() => act("approve")} disabled={!!busy} className="rounded-full bg-[var(--gold)] px-4 py-1.5 text-[13px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">{busy === "approve" ? "Approving…" : "Approve → stage"}</button>
          </div>
        )}
      </div>
      {err && <div className="mt-2 text-[12px] font-semibold text-[#e0873f]">{err}</div>}
      {!readOnly && <div className="mt-2 text-[11px] text-[var(--sage-dim)]">Either way the player&apos;s custom disc is untouched — this only triages a catalog lead.</div>}
    </div>
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
  const realLeads = pendingLeads.filter((l) => !l.lowSignal);
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

  const TABS: { key: Tab; label: string; n: number }[] = [
    { key: "pending", label: "Pending", n: realLeads.length },
    { key: "approved", label: "Approved", n: approvedLeads.length },
    { key: "denied", label: "Denied", n: deniedLeads.length },
  ];

  const shown = tab === "pending" ? realLeads : tab === "approved" ? approvedLeads : deniedLeads;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[12px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">← Admin</Link>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Disc Submissions</h1>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--text-body)]">Every custom disc a player creates is a catalog lead. Approve the real ones (they stage for the next catalog release); deny the noise. Their custom disc is never touched.</p>

      {/* tabs */}
      <div className="mt-5 inline-flex rounded-full bg-white/[0.05] p-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${tab === t.key ? "bg-[var(--gold)] text-[#141B16]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>
            {t.label}{subs ? ` ${t.n}` : ""}
          </button>
        ))}
      </div>

      {subs === null ? (
        <div className="mt-10 flex justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : loadErr ? (
        <p className="mt-10 py-12 text-center text-sm text-[var(--sage-dim)]">Couldn&apos;t load the queue. Refresh to try again.</p>
      ) : shown.length === 0 && !(tab === "pending" && lowLeads.length > 0) ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/10 py-14 text-center">
          <div className="text-3xl">🥏</div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--cream)]">{tab === "pending" ? "Queue is clear" : `No ${tab} submissions`}</p>
          {tab === "pending" && <p className="mt-1 text-[13px] text-[var(--text-body)]">New custom discs land here as players create them.</p>}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {shown.map((l) => (
            <LeadCard key={l.key} lead={l} catalog={catalog} staffUid={staffUid} onResolved={onResolved} readOnly={tab !== "pending"} />
          ))}
        </div>
      )}

      {/* low-signal section (pending only) */}
      {tab === "pending" && lowLeads.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={() => setShowLow((v) => !v)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--sage-dim)] transition-colors hover:text-[var(--sage)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`h-3 w-3 transition-transform ${showLow ? "rotate-90" : ""}`}><path d="M9 18l6-6-6-6" /></svg>
              Low signal · {lowLeads.length} noise submission{lowLeads.length === 1 ? "" : "s"} (test names, empty customs)
            </button>
            <button onClick={denyAllLow} disabled={bulkBusy} className="rounded-full border border-white/15 px-3.5 py-1 text-[12px] font-bold text-[var(--sage)] transition-colors hover:text-[#e0873f] disabled:opacity-50">{bulkBusy ? "Denying…" : `Deny all ${lowLeads.length}`}</button>
          </div>
          {showLow && (
            <div className="mt-3 space-y-3 opacity-70">
              {lowLeads.map((l) => <LeadCard key={l.key} lead={l} catalog={catalog} staffUid={staffUid} onResolved={onResolved} />)}
            </div>
          )}
        </div>
      )}

      {/* release-loop footer */}
      <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 text-[12.5px] leading-relaxed text-[var(--sage-dim)]">
        <div className={`${HEAD} mb-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--sage)]`}>How approval reaches players</div>
        Approving <b className="text-[var(--cream)]">stages</b> a disc into <code className="text-[var(--sage)]">discCatalogQueue</code> — it does <b>not</b> edit the live catalog. A staged disc goes live when (1) <b className="text-[var(--cream)]">discs.json is regenerated</b> for web (anytime — the site is dynamic), and (2) iOS/Android <b className="text-[var(--cream)]">compile it into their next release&apos;s DiscDatabase</b>. Until then, approved ≠ live — the <span className="text-[#8fe0a5]">Live on web</span> badge on the Approved tab means the folded name already matches discs.json. Flight numbers players type are often wrong; verify against the manufacturer before a catalog release.
      </div>
    </div>
  );
}
