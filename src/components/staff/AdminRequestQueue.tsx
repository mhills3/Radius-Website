"use client";

import { useEffect, useState } from "react";
import { getAdminAccessRequests, getResolvedAdminRequests, resolveCourseAdminRequest, type AdminRequest } from "@/lib/courseAdmin";
import { QueuePage, SectionLabel, Card, CardGrid, CardTitle, Tag, Fact, Requester, ActionRail, Spinner, Empty, LoadError, Segmented, HistoryList, fmtAgo } from "./QueueShell";

const REASON: Record<string, string> = {
  maintainer: "Maintains the course",
  designer: "Designed / installed it",
  club: "Club or parks staff",
  inactive_mapper: "Mapper inactive",
  other: "Other",
};
const loc = (c?: { city?: string; state?: string }) => [c?.city, c?.state].filter(Boolean).join(", ");

function RequestCard({ r, onResolved }: { r: AdminRequest; onResolved: (id: string, decision: "approve" | "deny", note: string) => void }) {
  const [busy, setBusy] = useState<"primary" | "secondary" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ev = r.evidence || {};
  const snap = r.courseSnapshot || {};
  const invalid = r.status === "invalid";
  const errored = r.status === "error";
  const built = ev.coursesBuilt ?? 0;
  const admins = ev.currentAdminCount ?? 0;
  const noEmail = r.requesterEmailMissing || !r.requesterEmail;

  const act = async (decision: "approve" | "deny", note: string) => {
    setBusy(decision === "approve" ? "primary" : "secondary"); setErr(null);
    try {
      const res = await resolveCourseAdminRequest(r.id, decision, note || undefined);
      if (res.error) { setErr(res.error); setBusy(null); return; }
      onResolved(r.id, decision, note); // ok OR alreadyResolved — either way it's off the queue
    } catch (e) {
      console.error("[resolveCourseAdminRequest] failed:", e);
      const err = (e ?? {}) as { code?: string; message?: string };
      setErr(`${err.message || "Something went wrong."} · ${(err.code || "unknown").replace(/^functions\//, "")}`);
      setBusy(null);
    }
  };

  const meta = [loc(snap) || "Location unknown", snap.holeCount ? `${snap.holeCount} holes` : null, ev.ownerName ? `built by ${ev.ownerName}` : null].filter(Boolean).join(" · ");

  return (
    <Card accent={invalid ? "bad" : undefined}>
      {errored && (
        <div className="mb-6 rounded-2xl px-5 py-4" style={{ background: "rgba(239,127,127,0.08)" }}>
          <SectionLabel tone="bad">Server processing failed</SectionLabel>
          <p className="mt-2 text-[14px] leading-snug text-[var(--cream)]">The evidence builder crashed on this request, so nothing here is server-verified. Approve is disabled — <b>Deny</b> clears it and the requester can re-file.{r.triggerError ? <> Error: <code className="text-[12px]">{r.triggerError}</code></> : null}</p>
        </div>
      )}
      {invalid && (
        <div className="mb-6 rounded-2xl px-5 py-4" style={{ background: "rgba(239,127,127,0.08)" }}>
          <SectionLabel tone="bad">Failed server validation</SectionLabel>
          <ul className="mt-2 list-disc pl-5 text-[14px] text-[var(--cream)]">{(r.validationErrors || ["Unspecified validation error"]).map((e, i) => <li key={i}>{e}</li>)}</ul>
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
            <Fact icon="🛠️" tone={built > 0 ? "warn" : "neutral"}>
              Courses built: <b className="text-[var(--cream)]">{built}</b>
              <span className="text-[var(--sage)]"> · {ev.alreadyAdmin === true ? "already an admin here" : "not an admin here"}</span>
            </Fact>
            <Fact icon="👥">
              <b className="text-[var(--cream)]">{admins}</b> current admin{admins === 1 ? "" : "s"}{ev.ownerName ? <> · built by <b className="text-[var(--cream)]">{ev.ownerName}</b></> : null}
            </Fact>
            <Fact icon="📅">Requested {fmtAgo(r.createdAt) || "—"}</Fact>
            {ev.alreadyAdmin === true && <Fact icon="⚠️" tone="warn">Already an admin — approving grants nothing</Fact>}
            {noEmail && <Fact icon="⚠️" tone="bad">No email on file — can&apos;t reach out</Fact>}
          </>
        }
        right={
          <ActionRail
            primary={{ label: "Approve", busyLabel: "Approving…", onClick: (n) => act("approve", n), disabled: invalid || errored }}
            secondary={{ label: "Deny", busyLabel: "Denying…", onClick: (n) => act("deny", n) }}
            busy={busy}
            note="Note — attached to the decision"
            error={err}
          />
        }
      />
    </Card>
  );
}

export default function AdminRequestQueue() {
  const [requests, setRequests] = useState<AdminRequest[] | null>(null);
  const [resolved, setResolved] = useState<AdminRequest[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    getAdminAccessRequests().then(setRequests).catch((e) => { console.error(e); setLoadErr(true); setRequests([]); });
    getResolvedAdminRequests().then(setResolved).catch(() => setResolved([]));
  }, []);

  // On resolve, drop it from the open queue AND prepend to history so it moves without a refetch.
  const onResolved = (id: string, decision: "approve" | "deny", note: string) =>
    setRequests((prev) => {
      const done = (prev || []).find((r) => r.id === id);
      if (done) setResolved((h) => [{ ...done, status: decision === "approve" ? "approved" : "denied", reviewedAt: Date.now(), note: note || undefined }, ...h]);
      return (prev || []).filter((r) => r.id !== id);
    });
  const byOldest = (a: AdminRequest, b: AdminRequest) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity);
  const pending = (requests || []).filter((r) => r.status === "pending").sort(byOldest);
  const invalid = (requests || []).filter((r) => r.status === "invalid").sort(byOldest);
  const errored = (requests || []).filter((r) => r.status === "error").sort(byOldest);
  const openCount = pending.length + invalid.length + errored.length;
  const history = resolved.map((r) => ({ id: r.id, title: r.courseSnapshot?.name || r.courseName, sub: `${r.requesterName || "Unknown"}${r.requesterUsername ? ` @${r.requesterUsername}` : ""}`, decision: r.status, at: r.reviewedAt ?? r.createdAt, note: r.note }));

  return (
    <QueuePage title="Admin Requests" blurb={<>Approving adds them to the course&apos;s admins — they can edit its info, holes and layouts everywhere.<br />Denying changes nothing.</>}>
      {requests === null ? <Spinner /> : loadErr ? <LoadError /> : (
        <>
          <div className="mt-8"><Segmented value={tab} onChange={setTab} options={[{ k: "pending", label: "Open", n: openCount }, { k: "history", label: "History", n: resolved.length }]} /></div>
          {tab === "history" ? (
            <HistoryList items={history} />
          ) : openCount === 0 ? (
            <Empty emoji="✅" title="Queue is clear" sub="No pending admin requests right now." />
          ) : (
            <div className="mt-8 space-y-5">
              {pending.length > 0 && <SectionLabel>{pending.length} pending</SectionLabel>}
              {pending.map((r) => <RequestCard key={r.id} r={r} onResolved={onResolved} />)}
              {invalid.length > 0 && (
                <>
                  <SectionLabel tone="bad" className="pt-6">{invalid.length} flagged invalid — needs attention</SectionLabel>
                  {invalid.map((r) => <RequestCard key={r.id} r={r} onResolved={onResolved} />)}
                </>
              )}
              {errored.length > 0 && (
                <>
                  <SectionLabel tone="bad" className="pt-6">{errored.length} failed server processing — deny to clear, requester re-files</SectionLabel>
                  {errored.map((r) => <RequestCard key={r.id} r={r} onResolved={onResolved} />)}
                </>
              )}
            </div>
          )}
        </>
      )}
    </QueuePage>
  );
}
