"use client";

import { useEffect, useState } from "react";
import { getRemovalRequests, resolveCourseRemoval, twoPinMapUrl, type RemovalRequest, type DuplicateCandidate } from "@/lib/courseRemoval";

const HEAD = "font-[family-name:var(--font-heading)]";
const REASON: Record<string, string> = { duplicate: "Duplicate", mistake: "Mistake", closed: "Course closed", wrong_location: "Wrong location", other: "Other" };
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

function DupRow({ d }: { d: DuplicateCandidate }) {
  return (
    <div className="flex items-center gap-3 border-t border-[var(--hair)] py-2.5 first:border-0">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#22302A] text-[11px] font-bold text-[#8FBDE3]">B</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-[var(--cream)]">{d.name}</span>
          {d.sameName && <span className="shrink-0 rounded-full bg-[#8FBDE3]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8FBDE3]">Same name</span>}
        </div>
        <div className="truncate text-[11.5px] text-[var(--sage-dim)]">{loc(d) || "—"}{d.holeCount ? ` · ${d.holeCount} holes` : ""}{d.createdBy ? ` · by ${d.createdBy}` : ""}</div>
      </div>
      {typeof d.milesAway === "number" && <span className="shrink-0 text-xs font-semibold text-[var(--sage)]">{d.milesAway < 1 ? "<1" : Math.round(d.milesAway)} mi</span>}
    </div>
  );
}

function Card({ r, onResolved }: { r: RemovalRequest; onResolved: (id: string) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ev = r.evidence || {};
  const snap = r.courseSnapshot || {};
  const dups = ev.likelyDuplicates || [];
  const invalid = r.status === "invalid";
  const map = twoPinMapUrl(snap, dups[0] ?? null);

  const act = async (decision: "approve" | "deny") => {
    setBusy(decision); setErr(null);
    try {
      const res = await resolveCourseRemoval(r.id, decision, note.trim() || undefined);
      if (res.error) { setErr(res.error); setBusy(null); return; }
      onResolved(r.id); // ok OR alreadyResolved — either way it's off the queue
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong."); setBusy(null);
    }
  };

  const builtTone = ev.requesterBuiltIt === true ? "good" : ev.requesterBuiltIt === false ? "bad" : "neutral";
  const builtText = ev.requesterBuiltIt === true ? "Yes — they built it" : ev.requesterBuiltIt === false ? "No — not the builder" : "Unknown";

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
          <div className="mt-1 text-[13px] text-[var(--sage)]">{loc(snap) || "Location unknown"}{snap.holeCount ? ` · ${snap.holeCount} holes` : ""}{ev.isPublished === false ? " · unpublished" : ev.isPublished ? " · published" : ""}</div>
        </div>
      </div>

      {/* THE THREE DECIDING THINGS */}
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <Decider label="Requester built it?" value={builtText} tone={builtTone} />
        <Decider label="Rounds played" value={`${ev.roundsPlayed ?? 0}`} tone={(ev.roundsPlayed ?? 0) > 0 ? "warn" : "good"} />
        <Decider label="Likely duplicates" value={`${dups.length}`} tone={dups.length > 0 ? "warn" : "neutral"} />
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

      {/* duplicates side by side + map */}
      {dups.length > 0 && (
        <div className="mt-4">
          <div className={`${HEAD} mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sage-dim)]`}>Likely duplicates</div>
          {map && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={map} alt="Course vs. duplicate location" className="mb-3 w-full rounded-xl border border-[var(--hair)]" />
          )}
          <div className="rounded-xl border border-[var(--hair)] bg-white/[0.02] px-4 py-1.5">
            {dups.slice(0, 5).map((d, i) => <DupRow key={d.courseId || i} d={d} />)}
          </div>
          {map && <div className="mt-1.5 text-[11px] text-[var(--sage-dim)]"><span className="text-[var(--gold)]">A</span> = this course · <span className="text-[#8FBDE3]">B</span> = nearest duplicate</div>}
        </div>
      )}

      {/* decision */}
      <div className="mt-5 border-t border-[var(--hair)] pt-4">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — attached to the decision" rows={2} className="w-full resize-none rounded-xl border border-[var(--hair)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]/50" />
        {err && <div className="mt-2 text-[13px] font-semibold text-[#e0873f]">{err}</div>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-[11.5px] leading-snug text-[var(--sage-dim)]">Approving is a <b className="text-[var(--sage)]">soft delete</b> — it sets <code className="text-[var(--cream)]">isDraft</code> + <code className="text-[var(--cream)]">reviewStatus: &ldquo;removed&rdquo;</code>, so the course leaves the map while existing rounds keep resolving. Nothing is destroyed.</p>
          <div className="flex shrink-0 gap-2.5">
            <button onClick={() => act("deny")} disabled={!!busy} className="rounded-full border border-[var(--hair-strong)] px-5 py-2.5 text-[13px] font-bold text-[var(--sage)] transition-colors hover:text-[var(--cream)] disabled:opacity-50">{busy === "deny" ? "Denying…" : "Deny"}</button>
            <button onClick={() => act("approve")} disabled={!!busy} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-[13px] font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">{busy === "approve" ? "Approving…" : "Approve (remove)"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RemovalQueue() {
  const [requests, setRequests] = useState<RemovalRequest[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    getRemovalRequests().then(setRequests).catch(() => { setLoadErr(true); setRequests([]); });
  }, []);

  const onResolved = (id: string) => setRequests((rs) => (rs ? rs.filter((r) => r.id !== id) : rs));

  const pending = (requests || []).filter((r) => r.status === "pending");
  const invalid = (requests || []).filter((r) => r.status === "invalid");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Staff</div>
      <h1 className={`${HEAD} mt-1 text-3xl font-black tracking-[-0.02em] sm:text-4xl`}>Course removals</h1>
      <p className="mt-2 max-w-xl text-[14px] text-[var(--text-body)]">Requests to pull a course from the directory. Each is pre-computed by the backend — review the evidence and approve (soft delete) or deny.</p>

      {requests === null ? (
        <div className="flex min-h-[30vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : loadErr ? (
        <p className="mt-8 text-[14px] text-[#e0873f]">Couldn&apos;t load the queue. Refresh to try again.</p>
      ) : pending.length === 0 && invalid.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--hair)] bg-[var(--bg-mid)] p-10 text-center">
          <div className="text-3xl">✅</div>
          <p className="mt-2 text-[15px] font-semibold text-[var(--cream)]">Queue is clear</p>
          <p className="mt-1 text-[13px] text-[var(--sage-dim)]">No pending removal requests right now.</p>
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
