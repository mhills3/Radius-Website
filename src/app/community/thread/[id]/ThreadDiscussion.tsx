"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getThreadReplies, addReply, voteThread, voteReply, getThreadUserVotes, type Reply } from "@/lib/community";
import ForumAvatar from "./ForumAvatar";

function timeAgo(ms: number): string {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function VoteBar({ score, myVote, onVote, small }: { score: number; myVote: number; onVote: (dir: 1 | -1) => void; small?: boolean }) {
  const icon = small ? "h-4 w-4" : "h-[18px] w-[18px]";
  const btn = `grid ${small ? "h-6 w-6" : "h-7 w-7"} place-items-center rounded-md transition-colors`;
  return (
    <div className="inline-flex items-center gap-0.5">
      <button onClick={() => onVote(1)} aria-label="Upvote" className={`${btn} ${myVote === 1 ? "text-[var(--gold)]" : "text-[var(--sage)] hover:bg-white/[0.06] hover:text-[var(--cream)]"}`}>
        <svg viewBox="0 0 24 24" fill={myVote === 1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className={icon}><path d="M12 7l6 10H6z" /></svg>
      </button>
      <span className={`min-w-[1.5ch] text-center font-bold ${small ? "text-xs" : "text-sm"}`} style={{ color: score > 0 ? "var(--gold)" : score < 0 ? "#8FBDE3" : "var(--cream)" }}>{score}</span>
      <button onClick={() => onVote(-1)} aria-label="Downvote" className={`${btn} ${myVote === -1 ? "text-[#8FBDE3]" : "text-[var(--sage)] hover:bg-white/[0.06] hover:text-[var(--cream)]"}`}>
        <svg viewBox="0 0 24 24" fill={myVote === -1 ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className={icon}><path d="M12 17l-6-10h12z" /></svg>
      </button>
    </div>
  );
}

export default function ThreadDiscussion({ threadId, initialScore, initialReplyCount, opId }: { threadId: string; initialScore: number; initialReplyCount: number; opId?: string }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [threadScore, setThreadScore] = useState(initialScore);
  const [threadVote, setThreadVote] = useState(0);
  const [replyVotes, setReplyVotes] = useState<Record<string, number>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // reply id, or "root" for a top-level reply
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getThreadReplies(threadId).then(setReplies).catch(() => setReplies([]));
  }, [threadId]);
  useEffect(() => {
    if (!user) return;
    let dead = false;
    getThreadUserVotes(user.uid, threadId).then((v) => { if (!dead) { setThreadVote(v.thread); setReplyVotes(v.replies); } }).catch(() => {});
    return () => { dead = true; };
  }, [user, threadId]);

  const gate = () => { router.push("/login"); return false; };

  const onThreadVote = (dir: 1 | -1) => {
    if (!user) return gate();
    const prev = threadVote;
    const next = prev === dir ? 0 : dir;
    setThreadVote(next);
    setThreadScore((s) => s - prev + next); // net change: remove old vote, apply new
    voteThread(user.uid, threadId, dir).catch(() => { setThreadVote(prev); setThreadScore((s) => s - next + prev); });
  };

  const onReplyVote = (id: string, dir: 1 | -1) => {
    if (!user) return gate();
    const prev = replyVotes[id] || 0;
    const next = prev === dir ? 0 : dir;
    setReplyVotes((m) => ({ ...m, [id]: next }));
    setReplies((rs) => rs?.map((r) => (r.id === id ? { ...r, score: r.score - prev + next } : r)) ?? rs);
    voteReply(user.uid, threadId, id, dir).catch(() => {
      setReplyVotes((m) => ({ ...m, [id]: prev }));
      setReplies((rs) => rs?.map((r) => (r.id === id ? { ...r, score: r.score - next + prev } : r)) ?? rs);
    });
  };

  const submitReply = async (parentReplyId: string | null) => {
    if (!user) return gate();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const r = await addReply(user.uid, threadId, draft.trim(), parentReplyId);
      if (r) { setReplies((rs) => [...(rs ?? []), r]); setDraft(""); setReplyingTo(null); }
    } finally { setBusy(false); }
  };

  // Build the reply tree from parentReplyId.
  const childrenOf = useMemo(() => {
    const m = new Map<string, Reply[]>();
    for (const r of replies ?? []) {
      const key = r.parentReplyId || "root";
      (m.get(key) ?? m.set(key, []).get(key)!).push(r);
    }
    return m;
  }, [replies]);

  const replyBox = (parentId: string | null) => (
    <div className="mt-2 flex items-end gap-2">
      <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} placeholder="Write a reply…" className="max-h-32 min-h-[42px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
      <button onClick={() => submitReply(parentId)} disabled={!draft.trim() || busy} className="shrink-0 rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "…" : "Reply"}</button>
      <button onClick={() => { setReplyingTo(null); setDraft(""); }} className="shrink-0 rounded-full px-2 py-2.5 text-sm font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Cancel</button>
    </div>
  );

  const renderReply = (r: Reply, depth: number) => {
    const kids = childrenOf.get(r.id) ?? [];
    const handle = r.authorHandle;
    return (
      <div key={r.id} className={depth > 0 ? "border-l border-white/[0.08] pl-3 sm:pl-4" : ""}>
        <div className="flex gap-2.5 py-2.5">
          {handle ? <Link href={`/u/${handle}`}><ForumAvatar url={r.authorPhotoUrl} name={r.authorName} authorId={r.authorId} /></Link> : <ForumAvatar url={r.authorPhotoUrl} name={r.authorName} authorId={r.authorId} />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
              {handle ? <Link href={`/u/${handle}`} className="font-bold text-[var(--cream)] hover:underline">{r.authorName}</Link> : <span className="font-bold text-[var(--cream)]">{r.authorName}</span>}
              {opId && r.authorId === opId && <span className="rounded-full bg-[var(--gold)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--gold)]">OP</span>}
              <span className="text-xs text-[var(--sage-dim)]">· {timeAgo(r.createdAt)}</span>
            </div>
            <div className="mt-0.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-[var(--text-body)]">{r.text}</div>
            <div className="mt-1 flex items-center gap-1">
              <VoteBar score={r.score} myVote={replyVotes[r.id] || 0} onVote={(d) => onReplyVote(r.id, d)} small />
              <button onClick={() => { if (!user) return gate(); setReplyingTo((id) => (id === r.id ? null : r.id)); setDraft(""); }} className="ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M9 17l-5-5 5-5M4 12h11a5 5 0 0 1 5 5v1" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Reply
              </button>
            </div>
            {replyingTo === r.id && replyBox(r.id)}
          </div>
        </div>
        {kids.length > 0 && <div className="ml-4 sm:ml-5">{kids.map((k) => renderReply(k, depth + 1))}</div>}
      </div>
    );
  };

  const roots = childrenOf.get("root") ?? [];
  const total = replies?.length ?? initialReplyCount;

  return (
    <>
      {/* Thread action bar — vote, reply count, views */}
      <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-3 text-sm text-[var(--sage)]">
        <VoteBar score={threadScore} myVote={threadVote} onVote={onThreadVote} />
        <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>{total} {total === 1 ? "reply" : "replies"}</span>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">{total} {total === 1 ? "reply" : "replies"}</h2>
          <button onClick={() => { if (!user) return gate(); setReplyingTo((id) => (id === "root" ? null : "root")); setDraft(""); }} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 py-2 text-xs font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="h-3.5 w-3.5"><path d="M12 5v14M5 12h14" /></svg>Add reply
          </button>
        </div>

        {/* Top-level reply composer */}
        {replyingTo === "root" && (
          <div className="mb-4 flex items-start gap-2.5">
            <ForumAvatar url={profile?.profileImageUrl} name={profile?.name || "?"} />
            <div className="min-w-0 flex-1">{replyBox(null)}</div>
          </div>
        )}
        {!user && replyingTo !== "root" && (
          <button onClick={gate} className="mb-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-[var(--sage-dim)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--text-body)]">Add a reply… <span className="font-semibold text-[var(--gold)]">Sign in to join</span></button>
        )}

        {replies === null ? (
          <p className="py-6 text-center text-sm text-[var(--sage-dim)]">Loading replies…</p>
        ) : roots.length === 0 ? (
          <p className="py-6 text-sm text-[var(--sage-dim)]">No replies yet — start the discussion.</p>
        ) : (
          <div className="divide-y divide-white/[0.05]">{roots.map((r) => renderReply(r, 0))}</div>
        )}
      </section>
    </>
  );
}
