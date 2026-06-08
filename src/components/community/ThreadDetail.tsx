"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Thread, type Reply, type RankInfo, getThreadReplies, addReply, categoryColor } from "@/lib/community";
import { timeAgo } from "@/lib/feed";
import RankPill from "@/components/community/RankPill";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

function Avatar({ url, name, size = 32 }: { url?: string; name: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)] ring-1 ring-white/10" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function ThreadDetail({ thread, rank, uid, onClose }: { thread: Thread; rank?: RankInfo; uid?: string; onClose: () => void }) {
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!uid || !text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await addReply(uid, thread.id, text.trim());
      if (r) { setReplies((prev) => [...(prev ?? []), r]); setText(""); }
    } finally { setBusy(false); }
  };
  useEffect(() => {
    getThreadReplies(thread.id).then(setReplies).catch(() => setReplies([]));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [thread.id, onClose]);
  const cc = categoryColor(thread.category);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[6vh]">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-mid)] text-[var(--cream)] shadow-2xl animate-[fadeIn_0.25s_ease]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ background: `${cc}26`, color: cc }}>{thread.category}</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--sage)] hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-white/[0.07] p-5">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-tight tracking-tight">{thread.title}</h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-[var(--sage-dim)]">
              <Avatar url={thread.authorPhotoUrl} name={thread.authorName} size={28} />
              <span className="font-semibold text-[var(--text-body)]">{thread.authorName}</span>
              <RankPill rank={rank} />
              <span>· {timeAgo(thread.createdAt)}</span>
            </div>
            {thread.body && <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-body)]">{thread.body}</p>}
            {thread.linkedCourseName && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--gold-dim)] text-[var(--gold)]">⛳</span>
                <div className="min-w-0 flex-1"><div className="truncate font-bold">{thread.linkedCourseName}</div><div className="text-xs text-[var(--sage-dim)]">Linked round</div></div>
                {thread.scoreToPar != null && <span className="font-[family-name:var(--font-heading)] text-2xl font-extrabold" style={{ color: thread.scoreToPar < 0 ? "#5fcf80" : "#f08c8c" }}>{fmtScore(thread.scoreToPar)}</span>}
              </div>
            )}
            {thread.imageUrl && (
              <div className="mt-3 overflow-hidden rounded-xl bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thread.imageUrl} alt="" className="max-h-[420px] w-full object-cover" />
              </div>
            )}
            <div className="mt-4 flex items-center gap-5 text-sm text-[var(--sage-dim)]">
              <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M5 15l7-7 7 7" /></svg>{thread.score}</span>
              <span>{thread.replyCount} repl{thread.replyCount === 1 ? "y" : "ies"}</span>
              <span>{thread.viewCount} views</span>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Replies</div>
            {replies === null && <p className="text-sm text-[var(--sage-dim)]">Loading…</p>}
            {replies !== null && replies.length === 0 && <p className="text-sm text-[var(--sage-dim)]">No replies yet.</p>}
            <div className="space-y-4">
              {replies?.map((r) => (
                <div key={r.id} className="flex gap-3">
                  <Avatar url={r.authorPhotoUrl} name={r.authorName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="rounded-2xl bg-white/[0.05] px-3.5 py-2.5">
                      <div className="text-sm font-bold text-[var(--cream)]">{r.authorName}{r.authorHandle ? <span className="ml-1.5 text-xs font-normal text-[var(--sage-dim)]">@{r.authorHandle}</span> : null}</div>
                      <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-body)]">{r.text}</div>
                    </div>
                    <div className="mt-1 pl-1 text-xs text-[var(--sage-dim)]">{timeAgo(r.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.07] p-4">
          {uid ? (
            <div className="flex items-end gap-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Add a reply…" className="max-h-32 min-h-[44px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
              <button onClick={submit} disabled={!text.trim() || busy} className="shrink-0 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "…" : "Reply"}</button>
            </div>
          ) : (
            <p className="text-center text-sm text-[var(--sage-dim)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to join the discussion.</p>
          )}
        </div>
      </div>
    </div>
  );
}
