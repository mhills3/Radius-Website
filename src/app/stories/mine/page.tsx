"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getMyStories, type StoryDoc } from "@/lib/stories";
import WriterGate from "@/components/stories/WriterGate";

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

function Library() {
  const { user } = useAuth();
  const [stories, setStories] = useState<StoryDoc[] | null>(null);

  useEffect(() => {
    if (user) getMyStories(user.uid).then(setStories).catch(() => setStories([]));
  }, [user]);

  const published = stories?.filter((s) => s.status === "published") ?? [];
  const drafts = stories?.filter((s) => s.status === "draft") ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">Writer library</div>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em]">My stories</h1>
        </div>
        <Link href="/stories/write" className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] hover:bg-[var(--gold-bright)]">+ New story</Link>
      </div>

      {stories === null ? (
        <div className="mt-10 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-black/5" />)}</div>
      ) : stories.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-black/10 p-12 text-center text-sm text-[#6b7a70]">No stories yet. <Link href="/stories/write" className="font-bold text-[#9a7a3a] hover:underline">Write your first one →</Link></div>
      ) : (
        <div className="mt-8 space-y-6">
          {drafts.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8a968d]">Drafts</h2>
              <div className="divide-y divide-black/[0.06] rounded-2xl border border-black/8 bg-white">{drafts.map((s) => <Row key={s.id} s={s} />)}</div>
            </section>
          )}
          {published.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#8a968d]">Published</h2>
              <div className="divide-y divide-black/[0.06] rounded-2xl border border-black/8 bg-white">{published.map((s) => <Row key={s.id} s={s} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ s }: { s: StoryDoc }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-[#16221b]">{s.title || "Untitled"}</div>
        <div className="text-xs text-[#8a968d]">{s.category} · {fmtDate(s.updatedAt)} · {s.readMins} min</div>
      </div>
      {s.status === "published" && <Link href={`/stories/${s.slug}`} className="shrink-0 text-xs font-semibold text-[#46554c] hover:text-[#9a7a3a]">View</Link>}
      <Link href={`/stories/edit/${s.id}`} className="shrink-0 rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-bold text-[#16221b] hover:bg-black/[0.08]">Edit</Link>
    </div>
  );
}

export default function MyStoriesPage() {
  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <WriterGate><Library /></WriterGate>
    </div>
  );
}
