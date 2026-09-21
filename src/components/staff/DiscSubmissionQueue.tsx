"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  getDiscSubmissions, groupLeads, catalogCheck, isLiveOnWeb, getDiscCatalogSafe, verifyPendingSubmissions,
  type DiscSubmission, type DiscLead, type CatalogVerdict, type VerifyRunResult,
} from "@/lib/discSubmissions";
import type { DbDisc } from "@/lib/bag";
import { QueuePage, SectionLabel, Card, CardGrid, CardTitle, Tag, Fact, ActionRail, Spinner, Empty, LoadError, Segmented, fmtAgo, HEAD, TONE } from "./QueueShell";

type Tab = "pending" | "approved" | "denied";

const fmtFlight = (d: { speed: number; glide: number; turn: number; fade: number }) => `${d.speed} / ${d.glide} / ${d.turn} / ${d.fade}`;
const platformLabel = (p: string) => (p === "ios" ? "iOS" : p === "android" ? "Android" : p);

/** What the server verifier concluded (Infinite Discs lookup) — shown instead of the local catalog guess. */
function ServerVerdict({ t }: { t: NonNullable<DiscSubmission["triage"]> }) {
  const tone = t.action === "approve" ? "good" : t.action === "deny" ? "bad" : "warn";
  const icon = t.action === "approve" ? "✅" : t.action === "deny" ? "⛔" : "🧭";
  return (
    <>
      <Fact icon={icon} tone={tone}>{t.reason}</Fact>
      {t.clean && (
        <Fact icon="🏷️">
          Will ship as <b className="text-[var(--cream)]">{t.clean.manufacturer} {t.clean.name}</b>
          <span className="text-[var(--sage)]"> · {t.clean.category} · </span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtFlight(t.clean)}</span>
          {t.verified && !t.verified.flightFromPage && <span className="text-[#f0c069]"> · flight numbers as submitted, not verified</span>}
        </Fact>
      )}
      {t.verified?.url && <Fact icon="🔗"><a href={t.verified.url} target="_blank" rel="noopener" className="font-semibold hover:underline" style={{ color: TONE.info }}>Infinite Discs page ↗</a></Fact>}
    </>
  );
}

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

const CATEGORIES = ["Distance Driver", "Control Driver", "Fairway Driver", "Midrange", "Approach", "Putter"];
const inputCls = "w-full rounded-xl border border-[var(--hair)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50";

interface Draft { name: string; manufacturer: string; category: string; speed: string; glide: string; turn: string; fade: string }
const draftFrom = (l: DiscLead): Draft => ({ name: l.name || "", manufacturer: l.manufacturer || "", category: l.category || "", speed: String(l.speed ?? ""), glide: String(l.glide ?? ""), turn: String(l.turn ?? ""), fade: String(l.fade ?? "") });

function LeadCard({ lead, catalog, staffUid, onResolved, readOnly }: {
  lead: DiscLead; catalog: DbDisc[]; staffUid: string;
  onResolved: (ids: string[], status: "approved" | "denied") => void; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(lead));
  const [busy, setBusy] = useState<"primary" | "secondary" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Verdict + live badge track what will actually be STAGED — the draft while editing, the lead otherwise.
  const effName = editing ? draft.name : lead.name;
  const effMfr = editing ? draft.manufacturer : lead.manufacturer;
  const verdict = useMemo(() => catalogCheck({ name: effName, manufacturer: effMfr }, catalog), [effName, effMfr, catalog]);
  const live = useMemo(() => isLiveOnWeb(lead, catalog), [lead, catalog]);

  const startEdit = () => { setDraft(draftFrom(lead)); setErr(null); setEditing(true); };
  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const act = async (decision: "approve" | "deny", withEdits: boolean) => {
    if (!staffUid) { setErr("Sign in as staff to act."); return; }
    if (decision === "approve" && withEdits && !draft.name.trim()) { setErr("Name can't be empty."); return; }
    setBusy(decision === "approve" ? "primary" : "secondary"); setErr(null);
    try {
      const { resolveLead } = await import("@/lib/discSubmissions");
      const edits = withEdits ? {
        name: draft.name.trim(), manufacturer: draft.manufacturer.trim(), category: draft.category.trim(),
        speed: Number(draft.speed) || 0, glide: Number(draft.glide) || 0, turn: Number(draft.turn) || 0, fade: Number(draft.fade) || 0,
      } : undefined;
      await resolveLead(lead, decision, staffUid, edits);
      onResolved(lead.submissions.map((s) => s.id), decision === "approve" ? "approved" : "denied");
    } catch (e) {
      console.error("[resolveLead] failed:", e);
      setErr((e as { message?: string })?.message || "Something went wrong.");
      setBusy(null);
    }
  };

  const rep = lead.submissions[0];
  const others = lead.submitterCount - 1;
  const searchName = editing ? draft.name : lead.name;
  const searchMfr = editing ? draft.manufacturer : lead.manufacturer;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${searchMfr} ${searchName} disc golf flight numbers`)}`;

  return (
    <Card dim={readOnly} accent={editing ? "warn" : undefined}>
      <CardGrid
        left={
          <>
            <CardTitle
              title={lead.name || "—"}
              tag={<>
                {lead.submitterCount > 1 && <Tag>×{lead.submitterCount} submitted</Tag>}
                {editing && <Tag tone="warn">Editing</Tag>}
                {readOnly && rep.reviewedVia === "auto" && <Tag tone="neutral">{rep.triage?.source === "infinite" ? "Verified" : "Auto"}</Tag>}
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
        middle={editing ? (
          <div className="space-y-2.5">
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Clean up before staging</div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[var(--sage)]">Disc name</label>
              <input value={draft.name} onChange={set("name")} placeholder="e.g. Hiaaro" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[var(--sage)]">Manufacturer</label>
              <input value={draft.manufacturer} onChange={set("manufacturer")} placeholder="e.g. Discraft" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[var(--sage)]">Category</label>
              <input value={draft.category} onChange={set("category")} list="disc-categories" placeholder="e.g. Putter" className={inputCls} />
              <datalist id="disc-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[var(--sage)]">Flight (speed / glide / turn / fade)</label>
              <div className="grid grid-cols-4 gap-2">
                {(["speed", "glide", "turn", "fade"] as const).map((k) => (
                  <input key={k} value={draft[k]} onChange={set(k)} inputMode="decimal" aria-label={k} className={`${inputCls} text-center`} style={{ fontVariantNumeric: "tabular-nums" }} />
                ))}
              </div>
            </div>
            <div className="pt-1"><VerdictFact verdict={verdict} /></div>
          </div>
        ) : (
          <>
            {rep.triage ? <ServerVerdict t={rep.triage} /> : <VerdictFact verdict={verdict} />}
            <Fact icon="🔎"><a href={searchUrl} target="_blank" rel="noopener" className="font-semibold hover:underline" style={{ color: TONE.info }}>Search {lead.manufacturer || "the mold"} {lead.name} ↗</a></Fact>
            {!readOnly && <Fact icon="🥏">The player&apos;s custom disc is untouched either way — this only triages a catalog lead</Fact>}
          </>
        )}
        right={readOnly ? null : editing ? (
          <ActionRail
            primary={{ label: "Approve", busyLabel: "Approving…", onClick: () => act("approve", true) }}
            secondary={{ label: "Cancel", onClick: () => { setEditing(false); setErr(null); } }}
            busy={busy}
            error={err}
          />
        ) : (
          <ActionRail
            primary={{ label: "Approve", busyLabel: "Approving…", onClick: () => act("approve", false) }}
            secondary={{ label: "Deny", busyLabel: "Denying…", onClick: () => act("deny", false) }}
            busy={busy}
            error={err}
          >
            <button onClick={startEdit} disabled={!!busy} className="w-full rounded-2xl border border-[var(--gold)]/35 py-3.5 text-[15px] font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/10 disabled:opacity-50">✏️ Edit &amp; approve</button>
          </ActionRail>
        )}
      />
    </Card>
  );
}

function VerifyPanel({ pending, unverified, busy, disabled, onRun, last }: { pending: number; unverified: number; busy: boolean; disabled: boolean; onRun: () => void; last: VerifyRunResult | null }) {
  return (
    <div className="mt-8 rounded-3xl border border-[var(--gold)]/20 bg-[radial-gradient(130%_150%_at_0%_0%,rgba(246,193,101,0.09),transparent_60%)] bg-[#0e1612]/60 p-6 backdrop-blur-md sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 max-w-xl">
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] leading-none">🔎</span>
            <span className={`${HEAD} text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--gold)]`}>Verified triage</span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--sage)]">Every new submission is checked against Infinite Discs the moment it lands: real discs are approved with the manufacturer&apos;s spelling, brand and flight numbers; duplicates and no-brand customs are denied; anything Infinite doesn&apos;t know waits here for you.</p>
          <div className="mt-3 text-[13px] text-[var(--sage-dim)]">{pending} pending · {unverified} not yet verified{last ? ` · last run: ${last.approved} approved, ${last.denied} denied, ${last.review} held, ${last.errors} errors` : ""}</div>
        </div>
        <button onClick={onRun} disabled={disabled || busy || pending === 0} className="shrink-0 rounded-2xl bg-[var(--gold)] px-6 py-3.5 text-[15px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">
          {busy ? "Verifying…" : unverified > 0 ? `Verify ${unverified} pending` : "Re-verify all pending"}
        </button>
      </div>
    </div>
  );
}

export default function DiscSubmissionQueue() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<DiscSubmission[] | null>(null);
  const [catalog, setCatalog] = useState<DbDisc[]>([]);
  const [tab, setTab] = useState<Tab>("pending");
  const [loadErr, setLoadErr] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [lastRun, setLastRun] = useState<VerifyRunResult | null>(null);

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
  const approvedLeads = useMemo(() => groupLeads((subs || []).filter((s) => s.status === "approved")), [subs]);
  const deniedLeads = useMemo(() => groupLeads((subs || []).filter((s) => s.status === "denied")), [subs]);

  // Server-verified triage: the verifier already resolved the confident ones on arrival; what's
  // still pending is either awaiting verification (older docs) or held for a human with a reason.
  const unverified = (subs || []).filter((s) => s.status === "pending" && !s.triage?.action).length;
  const heldLeads = pendingLeads.filter((l) => l.submissions.some((s) => s.triage?.action === "review")).sort((a, b) => firstSeen(a) - firstSeen(b));
  const waitingLeads = pendingLeads.filter((l) => !l.submissions.some((s) => s.triage?.action === "review")).sort((a, b) => firstSeen(a) - firstSeen(b));

  const runVerify = async () => {
    if (!staffUid || verifying) return;
    setVerifying(true);
    try {
      const res = await verifyPendingSubmissions(unverified === 0);
      setLastRun(res);
      const fresh = await getDiscSubmissions(); setSubs(fresh);
    } catch (e) { console.error("[verifyDiscSubmissions] failed:", e); }
    setVerifying(false);
  };

  const historyLeads = tab === "approved" ? approvedLeads : deniedLeads;

  return (
    <QueuePage title="Disc Submissions" blurb={<>Every custom disc a player creates is a catalog lead. Approving stages it for the next catalog release; denying drops it.<br />The player&apos;s custom disc is never touched.</>}>
      <div className="mt-8">
        <Segmented value={tab} onChange={setTab} options={[
          { k: "pending", label: "Pending", n: subs ? realLeads.length : undefined },
          { k: "approved", label: "Approved", n: subs ? approvedLeads.length : undefined },
          { k: "denied", label: "Denied", n: subs ? deniedLeads.length : undefined },
        ]} />
      </div>

      {subs === null ? <Spinner /> : loadErr ? <LoadError /> : tab !== "pending" ? (
        historyLeads.length === 0 ? (
          <Empty emoji="🥏" title={`No ${tab} submissions`} />
        ) : (
          <div className="mt-10 space-y-5">
            <SectionLabel>{historyLeads.length} {tab}</SectionLabel>
            {historyLeads.map((l) => <LeadCard key={l.key} lead={l} catalog={catalog} staffUid={staffUid} onResolved={onResolved} readOnly />)}
          </div>
        )
      ) : (
        <>
          <VerifyPanel pending={pendingLeads.length} unverified={unverified} busy={verifying} disabled={!staffUid} onRun={runVerify} last={lastRun} />
          {pendingLeads.length === 0 ? (
            <Empty emoji="🥏" title="Queue is clear" sub="New custom discs land here, get verified against Infinite Discs, and only the unknowns wait for you." />
          ) : (
            <>
              {heldLeads.length > 0 && (
                <div className="mt-10 space-y-5">
                  <SectionLabel tone="warn">Needs your review · {heldLeads.length}</SectionLabel>
                  {heldLeads.map((l) => <LeadCard key={l.key} lead={l} catalog={catalog} staffUid={staffUid} onResolved={onResolved} />)}
                </div>
              )}
              {waitingLeads.length > 0 && (
                <div className="mt-10 space-y-5">
                  <SectionLabel>Not yet verified · {waitingLeads.length}</SectionLabel>
                  {waitingLeads.map((l) => <LeadCard key={l.key} lead={l} catalog={catalog} staffUid={staffUid} onResolved={onResolved} />)}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* release-loop footer */}
      <div className="mt-12 rounded-3xl border border-white/[0.06] bg-[#0e1612]/50 p-6 text-[13px] backdrop-blur-md leading-relaxed text-[var(--sage-dim)]">
        <div className={`${HEAD} mb-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--sage)]`}>How approval reaches players</div>
        Approving <b className="text-[var(--cream)]">stages</b> a disc into <code className="text-[var(--sage)]">discCatalogQueue</code> — it does <b>not</b> edit the live catalog. Before each release, <code className="text-[var(--sage)]">node tools/merge-disc-catalog.js --write</code> (radius-functions) appends every staged disc to the web, Android and iOS catalogs in one go, so approved discs ship with the next update of all three. The <span style={{ color: TONE.good }}>Live on web</span> badge on the Approved tab means the disc is already in discs.json. Verified discs carry Infinite&apos;s manufacturer flight numbers; a submission Infinite doesn&apos;t know keeps the player&apos;s numbers and is flagged at merge time.
      </div>
    </QueuePage>
  );
}
