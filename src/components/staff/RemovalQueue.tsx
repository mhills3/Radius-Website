"use client";

import { useEffect, useState } from "react";
import { getRemovalRequests, resolveCourseRemoval, parseResolveError, twoPinMapUrl, type RemovalRequest, type DuplicateCandidate } from "@/lib/courseRemoval";
import { QueuePage, SectionLabel, Card, CardGrid, CardTitle, Tag, Fact, Requester, ActionRail, Spinner, Empty, LoadError, fmtAgo, TONE } from "./QueueShell";

const REASON: Record<string, string> = { duplicate: "Duplicate", mistake: "Mistake", closed: "Course closed", wrong_location: "Wrong location", other: "Other" };
const loc = (c?: { city?: string; state?: string }) => [c?.city, c?.state].filter(Boolean).join(", ");

function DupRow({ d }: { d: DuplicateCandidate }) {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--hair)] py-3 first:border-0">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#22302A] text-[11px] font-bold" style={{ color: TONE.info }}>B</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold text-[var(--cream)]">{d.name}</span>
          {d.sameName && <Tag tone="info">Same name</Tag>}
        </div>
        <div className="truncate text-[13px] text-[var(--sage-dim)]">{loc(d) || "—"}{d.holeCount ? ` · ${d.holeCount} holes` : ""}{d.createdBy ? ` · by ${d.createdBy}` : ""}</div>
      </div>
      {typeof d.milesAway === "number" && <span className="shrink-0 text-[13px] font-semibold text-[var(--sage)]">{d.milesAway < 1 ? "<1" : Math.round(d.milesAway)} mi</span>}
    </div>
  );
}

function RemovalCard({ r, onResolved }: { r: RemovalRequest; onResolved: (id: string) => void }) {
  const [busy, setBusy] = useState<"primary" | "secondary" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [canOverride, setCanOverride] = useState(false);
  const [lastNote, setLastNote] = useState("");
  const ev = r.evidence || {};
  const snap = r.courseSnapshot || {};
  const dups = ev.likelyDuplicates || [];
  const invalid = r.status === "invalid";
  const map = twoPinMapUrl(snap, dups[0] ?? null);
  const rounds = ev.roundsPlayed ?? 0;

  const act = async (decision: "approve" | "deny", note: string, override = false) => {
    setBusy(decision === "approve" ? "primary" : "secondary"); setErr(null); setLastNote(note);
    if (!override) setCanOverride(false);
    try {
      const res = await resolveCourseRemoval(r.id, decision, note || undefined, override);
      if (res.error) { setErr(res.error); setBusy(null); return; }
      onResolved(r.id); // ok OR alreadyResolved — either way it's off the queue
    } catch (e) {
      console.error("[resolveCourseRemoval] failed:", e); // surfaces code/message/details in devtools
      const { code, message, overridable } = parseResolveError(e);
      setErr(`${message} · ${code}`);
      // The ownership precondition can be forced through with "Approve anyway"; the name-mismatch guard can't.
      setCanOverride(decision === "approve" && overridable && !override);
      setBusy(null);
    }
  };

  // Bedford Boys Ranch guard (2026-09-06): a removal request that reads like
  // an EDIT request ("just delete the 9 hole layout") got approved and hid the
  // whole course — approve has no smaller hammer. Flag the language loudly.
  const looksLikeEdit = /\blayout\b|\bholes? (changed|updated|moved)|\breconfigur|\bremap|\bjust (the|a) \b/i.test(r.detail || "");

  const meta = [loc(snap) || "Location unknown", snap.holeCount ? `${snap.holeCount} holes` : null, ev.isPublished === false ? "unpublished" : ev.isPublished ? "published" : null].filter(Boolean).join(" · ");

  return (
    <Card accent={invalid ? "bad" : looksLikeEdit ? "warn" : undefined}>
      {invalid && (
        <div className="mb-6 rounded-2xl px-5 py-4" style={{ background: "rgba(239,127,127,0.08)" }}>
          <SectionLabel tone="bad">Failed server validation</SectionLabel>
          <ul className="mt-2 list-disc pl-5 text-[14px] text-[var(--cream)]">{(r.validationErrors || ["Unspecified validation error"]).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {looksLikeEdit && (
        <div className="mb-6 rounded-2xl px-5 py-4" style={{ background: "rgba(240,192,105,0.08)" }}>
          <SectionLabel tone="warn">⚠ Reads like an edit request, not a removal</SectionLabel>
          <p className="mt-2 text-[14px] leading-snug text-[var(--cream)]">Approve hides the <b>entire course</b> — there is no layout-sized removal. If they want holes or layouts fixed, <b>deny</b> and point them to <b>Request Admin Access</b> (••• menu on the course) so they can edit it themselves.</p>
        </div>
      )}
      <CardGrid
        left={
          <>
            <CardTitle title={snap.name || r.courseName} tag={r.reasonKey ? <Tag>{REASON[r.reasonKey] || r.reasonKey}</Tag> : null} meta={meta} />
            <Requester name={r.requesterName} username={r.requesterUsername} email={r.requesterEmail} emailMissing={r.requesterEmailMissing} quote={r.detail} />
          </>
        }
        middle={
          <>
            <Fact icon="🏗️" tone={ev.requesterBuiltIt === true ? "good" : ev.requesterBuiltIt === false ? "bad" : "neutral"}>
              {ev.requesterBuiltIt === true ? "They built this course" : ev.requesterBuiltIt === false ? "Not the builder" : "Builder unknown"}
            </Fact>
            {r.requesterVerified === false && (
              <Fact icon="🪪" tone="bad">
                Identity mismatch — the account that filed this is NOT the person it claims to be
              </Fact>
            )}
            {r.requesterVerified === undefined && (
              <Fact icon="🪪" tone="neutral">
                Identity unverified (filed before the identity check existed) — Approve will ask for an override
              </Fact>
            )}
            <Fact icon="🥏" tone={rounds > 0 ? "warn" : "good"}>
              {rounds > 0 ? <><b className="text-[var(--cream)]">{rounds}</b> round{rounds === 1 ? "" : "s"} logged here <span className="text-[var(--sage)]">· they keep resolving after removal</span></> : "No rounds logged here"}
            </Fact>
            <Fact icon="🔁" tone={dups.length > 0 ? "warn" : "neutral"}>
              {dups.length > 0 ? <><b className="text-[var(--cream)]">{dups.length}</b> likely duplicate{dups.length === 1 ? "" : "s"} nearby</> : "No likely duplicates nearby"}
            </Fact>
            <Fact icon="📅">Requested {fmtAgo(r.createdAt) || "—"}</Fact>
            {(r.requesterEmailMissing || !r.requesterEmail) && <Fact icon="⚠️" tone="bad">No email on file — can&apos;t reach out</Fact>}
          </>
        }
        right={
          <ActionRail
            primary={{ label: "Approve", busyLabel: "Approving…", onClick: (n) => act("approve", n) }}
            secondary={{ label: "Deny", busyLabel: "Denying…", onClick: (n) => act("deny", n) }}
            busy={busy}
            note="Note — attached to the decision"
            error={err && (
              <>
                <div>{err}</div>
                {canOverride && (
                  <>
                    <p className="mt-1.5 font-normal text-[var(--sage)]">The requester doesn&apos;t own this course. You can still remove it if you&apos;ve verified it should go.</p>
                    <button onClick={() => act("approve", lastNote, true)} disabled={!!busy} className="mt-2.5 w-full rounded-xl bg-[#ef7f7f] py-2.5 text-[14px] font-bold text-[#141B16] transition-colors hover:bg-[#f39a9a] disabled:opacity-50">{busy === "primary" ? "Approving…" : "Approve anyway"}</button>
                  </>
                )}
              </>
            )}
          />
        }
      />

      {dups.length > 0 && (
        <div className="mt-7 border-t border-[var(--hair)] pt-6">
          <SectionLabel>Likely duplicates</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {map && (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={map} alt="Course vs. duplicate location" className="w-full rounded-2xl" />
                <div className="mt-2 text-[12px] text-[var(--sage-dim)]"><span className="text-[var(--gold)]">A</span> = this course · <span style={{ color: TONE.info }}>B</span> = nearest duplicate</div>
              </div>
            )}
            <div className="rounded-2xl bg-white/[0.03] px-5 py-1">
              {dups.slice(0, 5).map((d, i) => <DupRow key={d.courseId || i} d={d} />)}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function RemovalQueue() {
  const [requests, setRequests] = useState<RemovalRequest[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    getRemovalRequests().then(setRequests).catch(() => { setLoadErr(true); setRequests([]); });
  }, []);

  const onResolved = (id: string) => setRequests((rs) => (rs ? rs.filter((r) => r.id !== id) : rs));
  const byOldest = (a: RemovalRequest, b: RemovalRequest) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity);
  const pending = (requests || []).filter((r) => r.status === "pending").sort(byOldest);
  const invalid = (requests || []).filter((r) => r.status === "invalid").sort(byOldest);

  return (
    <QueuePage title="Course Removals" blurb={<>Approving is a soft delete — the course leaves the map and search while existing rounds keep resolving. Nothing is destroyed.<br />Denying changes nothing.</>}>
      {requests === null ? <Spinner /> : loadErr ? <LoadError /> : pending.length === 0 && invalid.length === 0 ? (
        <Empty emoji="✅" title="Queue is clear" sub="No pending removal requests right now." />
      ) : (
        <div className="mt-10 space-y-5">
          {pending.length > 0 && <SectionLabel>{pending.length} pending</SectionLabel>}
          {pending.map((r) => <RemovalCard key={r.id} r={r} onResolved={onResolved} />)}
          {invalid.length > 0 && (
            <>
              <SectionLabel tone="bad" className="pt-6">{invalid.length} flagged invalid — needs attention</SectionLabel>
              {invalid.map((r) => <RemovalCard key={r.id} r={r} onResolved={onResolved} />)}
            </>
          )}
        </div>
      )}
    </QueuePage>
  );
}
