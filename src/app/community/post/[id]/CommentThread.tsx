"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { addComment, setReaction, getProfilePhotos } from "@/lib/feed";

// Comment shape shared between the server-seeded list and client-added ones.
type CT = {
  id: string;
  authorName: string;
  authorHandle?: string;
  authorPhotoUrl?: string;
  authorId?: string;
  text: string;
  createdAt: number;
  likeCount?: number;
  parentCommentId?: string | null;
};

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

function Avatar({ url, name, size = 32 }: { url?: string; name: string; size?: number }) {
  // Initial underneath; photo overlays and removes itself on error → clean fallback, no broken icon.
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)] ring-1 ring-white/10" style={{ width: size, height: size }}>
      {(name || "?").charAt(0).toUpperCase()}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />
      )}
    </span>
  );
}

function Row({ c, isReply, onReply }: { c: CT; isReply?: boolean; onReply: (c: CT) => void }) {
  return (
    <div className="flex gap-3">
      <Avatar url={c.authorPhotoUrl} name={c.authorName} size={isReply ? 28 : 32} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-white/[0.05] px-3.5 py-2.5">
          <div className="text-sm font-bold text-[var(--cream)]">{c.authorName}{c.authorHandle ? <span className="ml-1.5 text-xs font-normal text-[var(--sage-dim)]">@{c.authorHandle}</span> : null}</div>
          <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-body)]">{c.text}</div>
        </div>
        <div className="mt-1 flex items-center gap-3 pl-1 text-xs text-[var(--sage-dim)]">
          <span>{fmtDate(c.createdAt)}</span>
          <button onClick={() => onReply(c)} className="font-semibold transition-colors hover:text-[var(--cream)]">Reply</button>
        </div>
      </div>
    </div>
  );
}

export default function CommentThread({ postId, initialComments, likeCount }: { postId: string; initialComments: CT[]; likeCount: number }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [comments, setComments] = useState<CT[]>(initialComments);
  const [text, setText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyTo, setReplyTo] = useState<CT | null>(null);
  const [busy, setBusy] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(likeCount);

  // Backfill avatars: most older comments never stored authorPhotoUrl — resolve from the profile.
  useEffect(() => {
    const missing = comments.filter((c) => !c.authorPhotoUrl && c.authorId).map((c) => c.authorId!);
    if (!missing.length) return;
    let alive = true;
    getProfilePhotos(missing).then((photos) => {
      if (!alive || photos.size === 0) return;
      setComments((prev) => prev.map((c) => (!c.authorPhotoUrl && c.authorId && photos.get(c.authorId) ? { ...c, authorPhotoUrl: photos.get(c.authorId) } : c)));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gate = () => router.push("/login");
  const tops = comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentCommentId === id).sort((a, b) => a.createdAt - b.createdAt);

  const submitTop = async () => {
    if (!user) return gate();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const c = await addComment(user.uid, postId, text.trim());
      if (c) { setComments((p) => [...p, { ...c, authorHandle: c.authorHandle, parentCommentId: null }]); setText(""); }
    } finally { setBusy(false); }
  };

  const startReply = (c: CT) => { if (!user) return gate(); setReplyTo(c); setReplyText(""); };

  const submitReply = async () => {
    if (!user || !replyTo || !replyText.trim() || busy) return;
    // Keep one level: a reply always attaches to the thread's TOP comment.
    const topId = replyTo.parentCommentId ?? replyTo.id;
    setBusy(true);
    try {
      const c = await addComment(user.uid, postId, replyText.trim(), { parentCommentId: topId, parentAuthorId: replyTo.authorId ?? null });
      if (c) { setComments((p) => [...p, { ...c, parentCommentId: topId }]); setReplyText(""); setReplyTo(null); }
    } finally { setBusy(false); }
  };

  const toggleLike = () => {
    if (!user) return gate();
    const was = liked;
    setLiked(!was); setLikes((l) => l + (was ? -1 : 1));
    setReaction(user.uid, postId, "like", was ? "like" : undefined).catch(() => { setLiked(was); setLikes((l) => l + (was ? 1 : -1)); });
  };

  const renderReplyBox = (top: CT) =>
    replyTo && (replyTo.id === top.id || replyTo.parentCommentId === top.id) ? (
      <div className="ml-11 mt-2">
        <div className="mb-1 text-xs text-[var(--sage-dim)]">Replying to <span className="font-semibold text-[var(--text-body)]">{replyTo.authorName}</span> <button onClick={() => setReplyTo(null)} className="ml-1 hover:text-[var(--cream)]">cancel</button></div>
        <div className="flex items-end gap-2">
          <textarea autoFocus value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={1} placeholder="Write a reply…" className="max-h-32 min-h-[42px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
          <button onClick={submitReply} disabled={!replyText.trim() || busy} className="shrink-0 rounded-full bg-[var(--gold)] px-4 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-50">{busy ? "…" : "Reply"}</button>
        </div>
      </div>
    ) : null;

  return (
    <div>
      <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold">{comments.length} {comments.length === 1 ? "comment" : "comments"}</h2>

      <div className="space-y-5">
        {tops.map((top) => {
          const replies = repliesOf(top.id);
          return (
            <div key={top.id}>
              <Row c={top} onReply={startReply} />
              {replies.length > 0 && (
                <div className="ml-11 mt-3 space-y-3 border-l border-white/[0.07] pl-4">
                  {replies.map((r) => <Row key={r.id} c={r} isReply onReply={startReply} />)}
                </div>
              )}
              {renderReplyBox(top)}
            </div>
          );
        })}
        {tops.length === 0 && <p className="text-sm text-[var(--sage-dim)]">No comments yet — be the first.</p>}
      </div>

      {/* like + new top-level comment */}
      <div className="mt-6 flex items-center gap-2 border-t border-white/[0.06] pt-4">
        <button onClick={toggleLike} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${liked ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "bg-white/[0.05] text-[var(--text-body)] hover:bg-white/[0.08]"}`}>
          <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
          {likes > 0 ? likes : "Like"}
        </button>
      </div>

      <div className="mt-3">
        {user ? (
          <div className="flex items-end gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center self-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
              {profile?.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profileImageUrl} alt="" className="h-9 w-9 object-cover" />
              ) : (
                (profile?.name?.[0] ?? "•").toUpperCase()
              )}
            </span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Add a comment…" className="max-h-32 min-h-[46px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
            <button onClick={submitTop} disabled={!text.trim() || busy} className="shrink-0 rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "…" : "Comment"}</button>
          </div>
        ) : (
          <button onClick={gate} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-[var(--sage-dim)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--text-body)]">Add a comment… <span className="font-semibold text-[var(--gold)]">Sign in to join</span></button>
        )}
      </div>
    </div>
  );
}
