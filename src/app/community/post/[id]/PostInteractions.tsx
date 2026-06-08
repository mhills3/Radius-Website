"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { addComment, setReaction } from "@/lib/feed";

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

export default function PostInteractions({ postId, likeCount }: { postId: string; likeCount: number }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<{ id: string; name: string; handle?: string; text: string; createdAt: number }[]>([]);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(likeCount);

  const gate = () => router.push("/login");

  const submit = async () => {
    if (!user) return gate();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const c = await addComment(user.uid, postId, text.trim());
      if (c) { setAdded((a) => [...a, { id: c.id, name: c.authorName, handle: c.authorHandle, text: c.text, createdAt: c.createdAt }]); setText(""); }
    } finally { setBusy(false); }
  };
  const toggleLike = () => {
    if (!user) return gate();
    const was = liked;
    setLiked(!was); setLikes((l) => l + (was ? -1 : 1));
    setReaction(user.uid, postId, "like", was ? "like" : undefined).catch(() => { setLiked(was); setLikes((l) => l + (was ? 1 : -1)); });
  };

  return (
    <div className="mt-4">
      {/* new comments the visitor adds this session */}
      {added.length > 0 && (
        <div className="mb-4 space-y-4">
          {added.map((c) => (
            <div key={c.id} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)] ring-1 ring-white/10">
                {profile?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profileImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (c.name || "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="rounded-2xl bg-white/[0.05] px-3.5 py-2.5">
                  <div className="text-sm font-bold text-[var(--cream)]">{c.name}{c.handle ? <span className="ml-1.5 text-xs font-normal text-[var(--sage-dim)]">@{c.handle}</span> : null}</div>
                  <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-body)]">{c.text}</div>
                </div>
                <div className="mt-1 pl-1 text-xs text-[var(--sage-dim)]">{fmtDate(c.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* like + comment composer */}
      <div className="flex items-center gap-2 border-t border-white/[0.06] pt-4">
        <button onClick={toggleLike} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${liked ? "bg-[var(--gold-dim)] text-[var(--gold)]" : "bg-white/[0.05] text-[var(--text-body)] hover:bg-white/[0.08]"}`}>
          <svg viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
          {likes > 0 ? likes : "Like"}
        </button>
      </div>

      <div className="mt-3">
        {user ? (
          <div className="flex items-end gap-3">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Add a comment…" className="max-h-32 min-h-[46px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
            <button onClick={submit} disabled={!text.trim() || busy} className="shrink-0 rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "…" : "Comment"}</button>
          </div>
        ) : (
          <button onClick={gate} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-[var(--sage-dim)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--text-body)]">Add a comment… <span className="font-semibold text-[var(--gold)]">Sign in to join</span></button>
        )}
      </div>
    </div>
  );
}
