"use client";

import Link from "next/link";
import { type FeedPost, timeAgo } from "@/lib/feed";
import { type RankInfo } from "@/lib/community";
import RankPill from "@/components/community/RankPill";
import ReactionBar from "@/components/community/ReactionBar";
import MentionText from "@/components/community/MentionText";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");

function Avatar({ url, name, size = 40 }: { url?: string; name: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export default function PostCard({ post, rank, myReaction, onReact, onOpen }: { post: FeedPost; rank?: RankInfo; myReaction?: string; onReact: (type: string) => void; onOpen: () => void }) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition-colors hover:border-white/[0.12]">
      <div className="flex items-center gap-3">
        <Avatar url={post.authorPhotoUrl} name={post.authorName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-[var(--cream)]">{post.authorName}</span>
            <RankPill rank={rank} />
          </div>
          <div className="truncate text-xs text-[var(--sage-dim)]">{post.authorHandle ? `@${post.authorHandle} · ` : ""}{timeAgo(post.createdAt)}</div>
        </div>
      </div>

      {post.text && <MentionText text={post.text} tagged={post.taggedUsers} className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--text-body)]" />}

      {post.linkedCourseName && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--gold-dim)] text-lg text-[var(--gold)]">⛳</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold text-[var(--cream)]">{post.linkedCourseName}</div>
            <div className="text-xs text-[var(--sage-dim)]">Round{post.holesPlayed ? ` · ${post.holesPlayed} holes` : ""}</div>
          </div>
          {post.scoreToPar != null && <span className="font-[family-name:var(--font-heading)] text-2xl font-extrabold" style={{ color: scoreColor(post.scoreToPar) }}>{fmtScore(post.scoreToPar)}</span>}
        </div>
      )}

      {post.taggedDiscName && (
        post.taggedDiscSlug ? (
          <Link href={`/discs/${post.taggedDiscSlug}`} onClick={(e) => e.stopPropagation()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-[var(--text-body)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">🥏 {post.taggedDiscName}{post.taggedDiscBrand ? <span className="text-[var(--sage-dim)]">· {post.taggedDiscBrand}</span> : null}</Link>
        ) : (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-[var(--text-body)]">🥏 {post.taggedDiscName}{post.taggedDiscBrand ? <span className="text-[var(--sage-dim)]">· {post.taggedDiscBrand}</span> : null}</div>
        )
      )}

      {post.taggedCourseName && post.taggedCourseSlug && (
        <Link href={`/courses/${post.taggedCourseSlug}`} onClick={(e) => e.stopPropagation()} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/12 px-3 py-1.5 text-sm font-semibold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20">⛳ {post.taggedCourseName}</Link>
      )}

      {post.taggedUsers && post.taggedUsers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-[var(--sage)]">
          <span>with</span>
          {post.taggedUsers.map((u, i) => (
            <span key={u.id}>
              <Link href={`/u/${u.username}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-[#4d94fa] hover:underline">@{u.username}</Link>{i < post.taggedUsers!.length - 1 ? "," : ""}
            </span>
          ))}
        </div>
      )}

      {post.imageUrl && (
        <div className="mt-3 overflow-hidden rounded-xl bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="" loading="lazy" decoding="async" className="max-h-[520px] w-full object-cover" />
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 border-t border-white/[0.06] pt-2.5 text-sm">
        <ReactionBar count={post.likeCount} reactions={post.reactions} myReaction={myReaction} onReact={onReact} />
        <button onClick={onOpen} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[var(--sage)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>
          {post.commentCount > 0 ? `${post.commentCount}` : "Comment"}
        </button>
        <Link href={`/community/post/${post.id}`} aria-label="Open post" className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[var(--sage)] transition-colors hover:bg-white/[0.05] hover:text-[var(--cream)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v13" /></svg>
        </Link>
      </div>
    </article>
  );
}
