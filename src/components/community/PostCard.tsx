"use client";

import Link from "next/link";
import { useState } from "react";
import ImageLightbox from "@/components/community/ImageLightbox";
import RoundScorecardModal from "@/components/scorecard/RoundScorecardModal";
import { type FeedPost, timeAgo } from "@/lib/feed";
import { type RankInfo } from "@/lib/community";
import RankPill from "@/components/community/RankPill";
import ReactionBar from "@/components/community/ReactionBar";
import MentionText from "@/components/community/MentionText";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");

function Avatar({ url, name, size = 32 }: { url?: string; name: string; size?: number }) {
  // Initial sits underneath; the photo overlays it and removes itself on load error, so a broken
  // photo URL falls back cleanly to the letter instead of a broken-image icon.
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10" style={{ width: size, height: size }}>
      {(name || "?").charAt(0).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />}
    </span>
  );
}

export default function PostCard({ post, rank, myReaction, onReact, onOpen }: { post: FeedPost; rank?: RankInfo; myReaction?: string; onReact: (type: string) => void; onOpen: () => void }) {
  const [zoom, setZoom] = useState(false);
  const [scorecard, setScorecard] = useState(false);
  const hasScorecard = !!(post.holeScores && post.holeScores.length && post.holePars && post.holePars.length);

  // Radius milestone/announcement — real post, but wears a distinct gold identity (trophy + badge)
  // instead of a user author row. Still fully likeable + commentable.
  if (post.isSystem) {
    return (
      <article className="border-b border-white/[0.055] border-l-2 border-l-[var(--gold)]/45 py-3.5 pl-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--gold)] text-base text-[#141b16]">🏆</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[var(--cream)]">Radius</span>
              <span className="rounded-full bg-[var(--gold)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--gold)]">Announcement</span>
            </div>
            <div className="text-[11px] text-[var(--sage-dim)]">Community highlight · {timeAgo(post.createdAt)}</div>
          </div>
        </div>
        {post.text && <MentionText text={post.text} tagged={post.taggedUsers} className="mt-2 whitespace-pre-wrap text-[15px] leading-snug text-[var(--cream)]" />}
        <div className="mt-1.5 flex items-center gap-0.5 text-[13px]">
          <ReactionBar count={post.likeCount} reactions={post.reactions} myReaction={myReaction} onReact={onReact} />
          <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-[var(--sage)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>
            {post.commentCount > 0 ? post.commentCount : "Comment"}
          </button>
        </div>
      </article>
    );
  }

  // Author identity is clickable — link by handle (denormalized on the post, else the author's
  // current user doc via rank); avatar falls back to the current profile photo the same way.
  const handle = post.authorHandle || rank?.username;
  const authorRow = (
    <>
      <Avatar url={post.authorPhotoUrl || rank?.photo} name={post.authorName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold text-[var(--cream)] group-hover/author:underline">{post.authorName}</span>
          <RankPill rank={rank} />
        </div>
        <div className="truncate text-xs text-[var(--sage-dim)]">{handle ? `@${handle} · ` : ""}{timeAgo(post.createdAt)}</div>
      </div>
    </>
  );
  return (
    <article className="border-b border-white/[0.055] py-3.5">
      {handle ? (
        <Link href={post.authorId ? `/u/${handle}?id=${post.authorId}` : `/u/${handle}`} onClick={(e) => e.stopPropagation()} className="group/author flex items-center gap-2.5">{authorRow}</Link>
      ) : (
        <div className="flex items-center gap-2.5">{authorRow}</div>
      )}

      {post.text && <MentionText text={post.text} tagged={post.taggedUsers} className="mt-2 whitespace-pre-wrap text-[15px] leading-snug text-[var(--text-body)]" />}

      {post.linkedCourseName && (() => {
        const slug = post.linkedCourseSlug || post.taggedCourseSlug;
        return (
          <div className="relative mt-2">
            <Link href={slug ? `/courses/${slug}` : "#"} onClick={(e) => { if (!slug) e.preventDefault(); e.stopPropagation(); }} className="group/round block overflow-hidden rounded-xl">
              <div className="relative h-32 w-full overflow-hidden bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.35),var(--bg-deep))]">
                {post.linkedCourseCover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.linkedCourseCover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover/round:scale-[1.05]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">⛳ Round</span>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-[family-name:var(--font-heading)] text-[15px] font-extrabold text-white drop-shadow">{post.linkedCourseName}</div>
                    <div className="text-xs text-white/85 drop-shadow">{post.holesPlayed ? `${post.holesPlayed} holes` : "Round"}{post.linkedBirdies ? ` · ${post.linkedBirdies} birdie${post.linkedBirdies === 1 ? "" : "s"}` : ""}</div>
                  </div>
                  {post.scoreToPar != null && <span className="shrink-0 font-[family-name:var(--font-heading)] text-3xl font-black leading-none drop-shadow" style={{ color: scoreColor(post.scoreToPar) }}>{fmtScore(post.scoreToPar)}</span>}
                </div>
              </div>
            </Link>
            {hasScorecard && (
              <button onClick={(e) => { e.stopPropagation(); setScorecard(true); }} className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-black/75">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
                View scorecard
              </button>
            )}
          </div>
        );
      })()}
      {scorecard && hasScorecard && (
        <RoundScorecardModal courseName={post.linkedCourseName ?? "Round"} cover={post.linkedCourseCover} date={post.createdAt} holeScores={post.holeScores!} holePars={post.holePars!} onClose={() => setScorecard(false)} />
      )}

      {post.taggedDiscName && (
        post.taggedDiscSlug ? (
          <Link href={`/discs/${post.taggedDiscSlug}`} onClick={(e) => e.stopPropagation()} className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-2.5 py-1 text-[13px] font-medium text-[var(--text-body)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">🥏 {post.taggedDiscName}{post.taggedDiscBrand ? <span className="text-[var(--sage-dim)]">· {post.taggedDiscBrand}</span> : null}</Link>
        ) : (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-2.5 py-1 text-[13px] font-medium text-[var(--text-body)]">🥏 {post.taggedDiscName}{post.taggedDiscBrand ? <span className="text-[var(--sage-dim)]">· {post.taggedDiscBrand}</span> : null}</div>
        )
      )}

      {post.taggedCourseName && post.taggedCourseSlug && (
        <Link href={`/courses/${post.taggedCourseSlug}`} onClick={(e) => e.stopPropagation()} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/12 px-2.5 py-1 text-[13px] font-semibold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20">⛳ {post.taggedCourseName}</Link>
      )}

      {post.taggedUsers && post.taggedUsers.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] text-[var(--sage)]">
          <span>with</span>
          {post.taggedUsers.map((u, i) => (
            <span key={u.id}>
              <Link href={`/u/${u.username}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-[#4d94fa] hover:underline">@{u.username}</Link>{i < post.taggedUsers!.length - 1 ? "," : ""}
            </span>
          ))}
        </div>
      )}

      {post.imageUrl && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setZoom(true); }} className="mt-2 block w-full cursor-zoom-in overflow-hidden rounded-lg bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" loading="lazy" decoding="async" className="max-h-[420px] w-full object-cover" />
        </button>
      )}
      {zoom && post.imageUrl && <ImageLightbox src={post.imageUrl} onClose={() => setZoom(false)} />}

      <div className="mt-1.5 flex items-center gap-0.5 text-[13px]">
        <ReactionBar count={post.likeCount} reactions={post.reactions} myReaction={myReaction} onReact={onReact} />
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-[var(--sage)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>
          {post.commentCount > 0 ? post.commentCount : "Comment"}
        </button>
      </div>
    </article>
  );
}
