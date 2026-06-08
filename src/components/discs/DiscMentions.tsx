"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPostsTaggingDisc, timeAgo, type FeedPost } from "@/lib/feed";

export default function DiscMentions({ slug }: { slug: string }) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  useEffect(() => {
    let alive = true;
    getPostsTaggingDisc(slug).then((p) => { if (alive) setPosts(p); }).catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  if (!posts.length) return null;
  return (
    <div className="mt-8">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#8a968d]">🗣️ Mentioned in the community feed</h3>
      <div className="space-y-3">
        {posts.map((m) => (
          <Link key={m.id} href={`/community/post/${m.id}`} className="flex gap-3 rounded-2xl border border-black/8 bg-white p-3.5 shadow-sm transition-colors hover:border-[var(--gold)]">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.authorPhotoUrl ? <img src={m.authorPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : (m.authorName || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-[#16221b]">{m.authorName} <span className="font-normal text-[#8a968d]">· {timeAgo(m.createdAt)}</span></div>
              <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-[#46554c]">{m.text}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
