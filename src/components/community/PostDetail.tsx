"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type FeedPost, type Comment, getComments, addComment, toggleCommentLike, getLikedCommentIds, timeAgo } from "@/lib/feed";
import { getRanksFor, type RankInfo } from "@/lib/community";
import { createNotification } from "@/lib/notifications";
import { type MentionUser } from "@/lib/leaderboard";
import ReactionBar from "@/components/community/ReactionBar";
import UserTagPicker from "@/components/community/UserTagPicker";
import MentionText from "@/components/community/MentionText";
import { useAuth } from "@/components/AuthProvider";
import ImageLightbox from "@/components/community/ImageLightbox";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");

function Avatar({ url, name, size = 36 }: { url?: string; name: string; size?: number }) {
  // Initial sits underneath; the photo overlays it and removes itself on load error, so a missing
  // or broken photo URL falls back cleanly to the letter instead of a broken-image icon.
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)] ring-1 ring-white/10" style={{ width: size, height: size }}>
      {(name || "?").charAt(0).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />}
    </span>
  );
}

export default function PostDetail({ post, uid, myReaction, onReact, onClose, onCommented }: { post: FeedPost; uid?: string; myReaction?: string; onReact: (type: string) => void; onClose: () => void; onCommented?: () => void }) {
  const { profile } = useAuth();
  const [zoom, setZoom] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string; authorId?: string } | null>(null);
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  // Current user-doc identity (photo/username) per author id — fallback for denormalized
  // authorPhotoUrl/authorHandle that older app-written posts and comments never stored.
  const [identities, setIdentities] = useState<Map<string, RankInfo>>(new Map());

  useEffect(() => {
    getComments(post.id).then((list) => {
      setComments(list);
      const ids = [post.authorId, ...list.map((c) => c.authorId)].filter(Boolean) as string[];
      if (ids.length) getRanksFor(ids).then(setIdentities).catch(() => {});
    }).catch(() => setComments([]));
    if (uid) getLikedCommentIds(uid, post.id).then(setLiked).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [post.id, post.authorId, onClose, uid]);

  const likeComment = (c: Comment) => {
    if (!uid) return;
    const isLiked = liked.has(c.id);
    setLiked((s) => { const n = new Set(s); isLiked ? n.delete(c.id) : n.add(c.id); return n; });
    setComments((prev) => prev?.map((x) => (x.id === c.id ? { ...x, likeCount: Math.max(0, (x.likeCount || 0) + (isLiked ? -1 : 1)) } : x)) ?? prev);
    toggleCommentLike(uid, post.id, c.id, isLiked).catch(() => {});
  };

  const topLevel = (comments ?? []).filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parentCommentId === id).sort((a, b) => a.createdAt - b.createdAt);

  const submit = async () => {
    if (!uid || !text.trim() || busy) return;
    setBusy(true);
    try {
      const c = await addComment(uid, post.id, text.trim(), { parentCommentId: replyTo?.id ?? null, mentions });
      if (c) {
        setComments((prev) => [...(prev ?? []), c]);
        setText(""); setMentions([]); onCommented?.();
        if (replyTo) {
          setExpanded((s) => new Set(s).add(replyTo.id));
          if (replyTo.authorId) createNotification({ recipientId: replyTo.authorId, actor: uid, type: "reply", postId: post.id, preview: c.text });
        } else if (post.authorId) {
          createNotification({ recipientId: post.authorId, actor: uid, type: "comment", postId: post.id, preview: c.text });
        }
        setReplyTo(null);
      }
    } finally { setBusy(false); }
  };

  const Bubble = ({ c, isReply }: { c: Comment; isReply?: boolean }) => {
    const who = c.authorId ? identities.get(c.authorId) : undefined;
    const handle = c.authorHandle || who?.username;
    const nameEl = (
      <>{c.authorName}{handle ? <span className="ml-1.5 text-xs font-normal text-[var(--sage-dim)]">@{handle}</span> : null}</>
    );
    return (
    <div className="flex gap-3">
      {handle ? (
        <Link href={c.authorId ? `/u/${handle}?id=${c.authorId}` : `/u/${handle}`} aria-label={`${c.authorName}'s profile`}><Avatar url={c.authorPhotoUrl || who?.photo} name={c.authorName} size={isReply ? 28 : 32} /></Link>
      ) : (
        <Avatar url={c.authorPhotoUrl || who?.photo} name={c.authorName} size={isReply ? 28 : 32} />
      )}
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-white/[0.05] px-3.5 py-2.5">
          <div className="text-sm font-bold text-[var(--cream)]">{handle ? <Link href={c.authorId ? `/u/${handle}?id=${c.authorId}` : `/u/${handle}`} className="hover:underline">{nameEl}</Link> : nameEl}</div>
          <MentionText text={c.text} tagged={c.taggedUsers} className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-body)]" />
          {c.taggedUsers && c.taggedUsers.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-1 text-xs text-[#4d94fa]">{c.taggedUsers.map((u) => <Link key={u.id} href={`/u/${u.username}`} className="hover:underline">@{u.username}</Link>)}</div>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 pl-1 text-xs text-[var(--sage-dim)]">
          <span>{timeAgo(c.createdAt)}</span>
          <button onClick={() => likeComment(c)} disabled={!uid} className={`inline-flex items-center gap-1 font-semibold transition-colors ${liked.has(c.id) ? "text-[#f0584f]" : "text-[var(--sage)] hover:text-[var(--cream)]"} disabled:opacity-60`}>
            <svg viewBox="0 0 24 24" fill={liked.has(c.id) ? "#f0584f" : "none"} stroke={liked.has(c.id) ? "#f0584f" : "currentColor"} strokeWidth="2" className="h-3.5 w-3.5"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            {c.likeCount ? c.likeCount : ""}
          </button>
          {uid && <button onClick={() => { setReplyTo({ id: c.parentCommentId || c.id, authorName: c.authorName, authorId: c.authorId }); }} className="font-semibold text-[var(--sage)] hover:text-[var(--gold)]">Reply</button>}
        </div>
      </div>
    </div>
    );
  };

  const postHandle = post.authorHandle || (post.authorId ? identities.get(post.authorId)?.username : undefined);
  const postAuthorRow = (
    <>
      <Avatar url={post.authorPhotoUrl || (post.authorId ? identities.get(post.authorId)?.photo : undefined)} name={post.authorName} size={40} />
      <div className="min-w-0">
        <div className="truncate text-sm font-bold group-hover/author:underline">{post.authorName}</div>
        <div className="truncate text-xs text-[var(--sage-dim)]">{postHandle ? `@${postHandle} · ` : ""}{timeAgo(post.createdAt)}</div>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[6vh]">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-mid)] text-[var(--cream)] shadow-2xl animate-[fadeIn_0.25s_ease]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
          <span className="text-sm font-bold">Post</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--sage)] hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-white/[0.07] p-5">
            {postHandle ? (
              <Link href={post.authorId ? `/u/${postHandle}?id=${post.authorId}` : `/u/${postHandle}`} className="group/author flex items-center gap-3">{postAuthorRow}</Link>
            ) : (
              <div className="flex items-center gap-3">{postAuthorRow}</div>
            )}
            {post.text && <MentionText text={post.text} tagged={post.taggedUsers} className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-body)]" />}
            {post.linkedCourseName && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--gold-dim)] text-[var(--gold)]">⛳</span>
                <div className="min-w-0 flex-1"><div className="truncate font-bold">{post.linkedCourseName}</div><div className="text-xs text-[var(--sage-dim)]">Round{post.holesPlayed ? ` · ${post.holesPlayed} holes` : ""}</div></div>
                {post.scoreToPar != null && <span className="font-[family-name:var(--font-heading)] text-2xl font-extrabold" style={{ color: scoreColor(post.scoreToPar) }}>{fmtScore(post.scoreToPar)}</span>}
              </div>
            )}
            {post.imageUrl && (
              <button type="button" onClick={() => setZoom(true)} className="mt-3 block w-full cursor-zoom-in overflow-hidden rounded-xl bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.imageUrl} alt="" className="max-h-[420px] w-full object-cover" />
              </button>
            )}
            {zoom && post.imageUrl && <ImageLightbox src={post.imageUrl} onClose={() => setZoom(false)} />}
            <div className="mt-3 flex items-center gap-3 text-sm text-[var(--sage)]">
              <ReactionBar count={post.likeCount} reactions={post.reactions} myReaction={myReaction} onReact={onReact} />
              <span className="inline-flex items-center gap-1.5 px-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>
                {post.commentCount}
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--gold)]">Comments</div>
            {comments === null && <p className="text-sm text-[var(--sage-dim)]">Loading…</p>}
            {comments !== null && topLevel.length === 0 && <p className="text-sm text-[var(--sage-dim)]">No comments yet — be the first.</p>}
            <div className="space-y-5">
              {topLevel.map((c) => {
                const replies = repliesOf(c.id);
                const isOpen = expanded.has(c.id);
                return (
                  <div key={c.id}>
                    <Bubble c={c} />
                    {replies.length > 0 && (
                      <div className="ml-6 mt-3 space-y-3 border-l border-white/10 pl-4">
                        {replies.length === 1 || isOpen ? (
                          <>
                            {replies.map((r) => <Bubble key={r.id} c={r} isReply />)}
                            {replies.length > 1 && <button onClick={() => setExpanded((s) => { const n = new Set(s); n.delete(c.id); return n; })} className="text-xs font-semibold text-[var(--sage-dim)] hover:text-[var(--sage)]">Hide replies</button>}
                          </>
                        ) : (
                          <button onClick={() => setExpanded((s) => new Set(s).add(c.id))} className="flex items-center gap-1.5 text-xs font-bold text-[var(--gold)] hover:underline"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>View {replies.length} replies</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.07] p-4">
          {uid ? (
            <div>
              {replyTo && (
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-[var(--sage)]">↩ Replying to <span className="font-semibold text-[var(--cream)]">{replyTo.authorName}</span><button onClick={() => setReplyTo(null)} className="text-[var(--sage-dim)] hover:text-[var(--cream)]" aria-label="Cancel reply">✕</button></div>
              )}
              {mentions.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">{mentions.map((u) => <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-[#4d94fa]/15 px-2.5 py-1 text-xs font-semibold text-[#4d94fa]">@{u.username}<button onClick={() => setMentions((a) => a.filter((x) => x.id !== u.id))} aria-label="Remove tag">✕</button></span>)}</div>
              )}
              <div className="flex items-end gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center self-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
                  {profile?.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.profileImageUrl} alt="" className="h-9 w-9 object-cover" />
                  ) : (
                    (profile?.name?.[0] ?? "•").toUpperCase()
                  )}
                </span>
                <div className="relative w-full">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={replyTo ? `Reply to ${replyTo.authorName}…` : "Add a comment…"} className="max-h-32 min-h-[44px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] py-2.5 pl-4 pr-11 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
                  <button onClick={() => setPickerOpen(true)} title="Tag people" aria-label="Tag people" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[var(--sage)] transition-colors hover:bg-white/[0.06] hover:text-[var(--cream)]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M16 21a6 6 0 0 0-12 0M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6" /></svg>
                  </button>
                </div>
                <button onClick={submit} disabled={!text.trim() || busy} className="shrink-0 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "…" : replyTo ? "Reply" : "Post"}</button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-[var(--sage-dim)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to comment.</p>
          )}
          {pickerOpen && <UserTagPicker exclude={mentions.map((u) => u.id)} onSelect={(u) => { setMentions((a) => (a.some((x) => x.id === u.id) ? a : [...a, u])); setText((t) => `${t}${t && !/\s$/.test(t) ? " " : ""}@${u.username} `); }} onClose={() => setPickerOpen(false)} />}
        </div>
      </div>
    </div>
  );
}
