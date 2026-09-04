"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminAccessRequests, resolveCourseAdminRequest, type AdminRequest } from "@/lib/courseAdmin";

const HEAD = "font-[family-name:var(--font-heading)]";
const REASON: Record<string, string> = {
  maintainer: "Maintains the course",
  designer: "Designed / installed it",
  club: "Club or parks staff",
  inactive_mapper: "Mapper inactive",
  other: "Other",
};
const loc = (c?: { city?: string; state?: string }) => [c?.city, c?.state].filter(Boolean).join(", ");

function Decider({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const color = tone === "good" ? "#5fcf80" : tone === "bad" ? "#e0873f" : tone === "warn" ? "#E8B560" : "var(--cream)";
  return (
    <div className="flex-1 rounded-xl border border-[var(--hair)] bg-white/[0.02] px-4 py-3">
      <div className={`${HEAD} text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sage-dim)]`}>{label}</div>
      <div className={`${HEAD} mt-1.5 text-[17px] font-bold`} style={{ color }}>{value}</div>
    </div>
  );
}

function Card({ r, onResolved }: { r: AdminRequest; onResolved: (id: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ev = r.evidence || {};
  const snap = r.courseSnapshot || {};
  const invalid = r.status === "invalid";

  const act = async (decision: "approve" | "deny") => {
    setBusy(decision); setErr(null);
    try {
      const res = await resolveCourseAdminRequest(r.id, decision, note.trim() || undefined);
      if (res.error) { setErr(res.error); setBusy(null); return; }
      onResolved(r.id); // ok OR alreadyResolved — either way it's off the queue
    } catch (e) {
      console.error("[resolveCourseAdminRequest] failed:", e);
      const err = (e ?? {}) as { code?: string; message?: string };
      setErr(`${err.message || "Something went wrong."} · ${(err.code || "unknown").replace(/^functions\//, "")}`);
      setBusy(null);
    }
  };

  return (
    <div className={`rounded-2xl border bg-[var(--bg-mid)] p-5 shadow-sm ${invalid ? "border-[#e0873f]/40" : "border-[var(--hair)]"}`}>
      {invalid && (
        <div className="mb-4 rounded-xl border border-[#e0873f]/30 bg-[#e0873f]/[0.08] px-4 py-3">
          <div className={`${HEAD} text-[11px] font-black uppercase tracking-[0.16em] text-[#e0873f]`}>Failed server validation</div>
          <ul className="mt-1.5 list-disc pl-5 text-[13px] text-[var(--cream)]">{(r.validationErrors || ["Unspecified validation error"]).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`${HEAD} truncate text-[20px] font-extrabold text-[var(--cream)]`}>{snap.name || r.courseName}</h3>
            {r.reasonKey && <span className="shrink-0 rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--gold)]">{REASON[r.reasonKey] || r.reasonKey}</span>}
          </div>
          <div className="mt-1 text-[13px] text-[var(--sage)]">{loc(snap) || "Location unknown"}{snap.holeCount ? ` · ${snap.holeCount} holes` : ""}{ev.ownerName ? ` · built by ${ev.ownerName}` : ""}</div>
        </div>
      </div>

      {/* THE THREE DECIDING THINGS */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <Decider label="Already an admin?" value={ev.alreadyAdmin === true ? "Yes — nothing to grant" : "No"} tone={ev.alreadyAdmin === true ? "warn" : "good"} />
        <Decider label="Courses they've built" value={`${ev.coursesBuilt ?? 0}`} tone={(ev.coursesBuilt ?? 0) > 0 ? "good" : "neutral"} />
        <Decider label="Current admins" value={`${ev.currentAdminCount ?? 0}`} tone="neutral" />
      </div>

      {/* requester + email (prominent — Ben needs to reach out) */}
      <div className="mt-4 rounded-xl border border-[var(--hair)] bg-white/[0.02] px-4 py-3">
        <div className={`${HEAD} text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sage-dim)]`}>Requester</div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[15px] font-bold text-[var(--cream)]">{r.requesterName || "Unknown"}</span>
          {r.requesterUsername && <span className="text-[13px] text-[var(--sage-dim)]">@{r.requesterUsername}</span>}
        </div>
        {r.requesterEmailMissing || !r.requesterEmail
          ? <div className="mt-1 text-[13px] font-semibold text-[#e0873f]">⚠ No email on file — can&apos;t reach out</div>
          : <a href={`mailto:${r.requesterEmail}`} className="mt-1 block text-[15px] font-bold text-[var(--gold)] hover:underline">{r.requesterEmail}</a>}
      </div>

      {/* their reason */}
      {r.detail && <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-body)]">&ldquo;{r.detail}&rdquo;</p>}

      {/* decision */}
      <div className="mt-5 border-t border-[var(--hair)] pt-4">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — attached to the decision" rows={2} className="w-full resize-none rounded-xl border border-[var(--hair)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50" />
        {err && (
          <div className="mt-3 rounded-xl border border-[#e0873f]/40 bg-[#e0873f]/[0.08] px-4 py-3">
            <div className="text-[13px] font-semibold text-[#e0873f]">{err}</div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-[11.5px] leading-snug text-[var(--sage-dim)]">Approving adds them to this course&apos;s <code className="text-[var(--cream)]">adminIds</code> — they can edit its info, holes and layouts on every platform. Denying changes nothing.</p>
          <div className="flex gap-2.5">
            <button onClick={() => act("deny")} disabled={!!busy} className="rounded-full border border-[var(--hair)] px-5 py-2.5 text-[13px] font-bold text-[var(--cream)] transition-colors hover:border-[#e0873f]/60 hover:text-[#e0873f] disabled:opacity-50">{busy === "deny" ? "Denying…" : "Deny"}</button>
            <button onClick={() => act("approve")} disabled={!!busy || invalid} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-[13px] font-bold text-[#141B16] transition-colors hover:bg-[#f0cc80] disabled:opacity-50">{busy === "approve" ? "Approving…" : "Approve"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminRequestQueue() {
  const [requests, setRequests] = useState<AdminRequest[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    getAdminAccessRequests().then(setRequests).catch((e) => { console.error(e); setLoadErr(true); setRequests([]); });
  }, []);

  const onResolved = (id: string) => setRequests((prev) => (prev || []).filter((r) => r.id !== id));
  const pending = (requests || []).filter((r) => r.status === "pending");
  const invalid = (requests || []).filter((r) => r.status === "invalid");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/admin" className="text-[12px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">← Admin</Link>
      <div className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Admin requests</h1>
      <p className="mt-2 max-w-xl text-[14px] text-[var(--text-body)]">Players asking for edit rights on a course — maintainers, designers, club folks. Approve to add them to the course&apos;s admins; deny to change nothing.</p>

      {requests === null ? (
        <div className="flex min-h-[30vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : loadErr ? (
        <p className="mt-8 text-[14px] text-[#e0873f]">Couldn&apos;t load the queue. Refresh to try again.</p>
      ) : pending.length === 0 && invalid.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--hair)] bg-[var(--bg-mid)] p-10 text-center">
          <div className="text-3xl">✅</div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--cream)]">Queue is clear</p>
          <p className="mt-1 text-[13px] text-[var(--sage-dim)]">No pending admin requests right now.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {pending.length > 0 && (
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">{pending.length} pending</div>
          )}
          {pending.map((r) => <Card key={r.id} r={r} onResolved={onResolved} />)}

          {invalid.length > 0 && (
            <>
              <div className="pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-[#e0873f]">{invalid.length} flagged invalid — needs attention</div>
              {invalid.map((r) => <Card key={r.id} r={r} onResolved={onResolved} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
