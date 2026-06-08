"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCourseDiscussion, type CoursePost } from "@/lib/courseCommunity";
import { getPostsTaggingCourse, timeAgo, type FeedPost } from "@/lib/feed";
import CourseGroupBar from "./CourseGroupBar";
import CourseDiscussionForm from "./CourseDiscussionForm";

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export default function CourseCommunity({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [posts, setPosts] = useState<CoursePost[] | null>(null);
  const [mentions, setMentions] = useState<FeedPost[]>([]);

  useEffect(() => {
    let alive = true;
    getCourseDiscussion(courseId).then((p) => { if (alive) setPosts(p); }).catch(() => { if (alive) setPosts([]); });
    getPostsTaggingCourse(courseId).then((p) => { if (alive) setMentions(p); }).catch(() => {});
    return () => { alive = false; };
  }, [courseId]);

  return (
    <section className="mt-10">
      <h2 className="mb-1 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-[#16221b]">💬 {courseName} community</h2>
      <p className="mb-4 text-sm text-[#8a968d]">Join the group, ask about conditions, share layouts & tips — your home course auto-joins you.</p>

      <CourseGroupBar courseId={courseId} courseName={courseName} />
      <CourseDiscussionForm courseId={courseId} courseName={courseName} />

      {posts === null ? (
        <div className="mt-5 space-y-3">{[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-black/5" />)}</div>
      ) : posts.length > 0 ? (
        <div className="mt-5 space-y-4">
          {posts.map((p) => (
            <div key={p.id} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.authorPhotoUrl ? <img src={p.authorPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : (p.authorName || "?").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 rounded-2xl border border-black/8 bg-white p-3.5 shadow-sm">
                <div className="text-sm font-bold text-[#16221b]">{p.authorName}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#46554c]">{p.text}</p>
                <div className="mt-1.5 text-xs text-[#8a968d]">{fmtDate(p.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-[#8a968d]">No posts yet — start the conversation about {courseName}.</p>
      )}

      {mentions.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#8a968d]">🗣️ Mentioned in the community feed</h3>
          <div className="space-y-3">
            {mentions.map((m) => (
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
      )}
    </section>
  );
}
