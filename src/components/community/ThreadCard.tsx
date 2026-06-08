"use client";

import Link from "next/link";
import { type Thread, type RankInfo, categoryColor } from "@/lib/community";
import { timeAgo } from "@/lib/feed";
import RankPill from "@/components/community/RankPill";

export default function ThreadCard({ thread, rank }: { thread: Thread; rank?: RankInfo; onOpen?: () => void }) {
  const cc = categoryColor(thread.category);
  return (
    <Link href={`/community/thread/${thread.id}`} className="flex w-full gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/[0.12]">
      <div className="flex w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/[0.04] py-2 text-[var(--sage)]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7" /></svg>
        <span className="font-[family-name:var(--font-heading)] text-base font-extrabold text-[var(--cream)]">{thread.score}</span>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 9l-7 7-7-7" /></svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${cc}26`, color: cc }}>{thread.category}</span>
          <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--sage-dim)]">
            <span className="truncate font-semibold text-[var(--text-body)]">{thread.authorName}</span>
            <RankPill rank={rank} />
            <span>· {timeAgo(thread.createdAt)}</span>
          </span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 font-[family-name:var(--font-heading)] text-base font-bold leading-snug text-[var(--cream)]">{thread.title}</h3>
        {thread.preview && <p className="mt-1 line-clamp-2 text-sm text-[var(--text-body)]">{thread.preview}</p>}
        <div className="mt-2.5 flex items-center gap-4 text-xs text-[var(--sage-dim)]">
          <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>{thread.replyCount} repl{thread.replyCount === 1 ? "y" : "ies"}</span>
          <span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>{thread.viewCount}</span>
        </div>
      </div>
    </Link>
  );
}
