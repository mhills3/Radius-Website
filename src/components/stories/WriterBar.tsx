"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function WriterBar() {
  const { profile } = useAuth();
  if (!profile?.writer) return null;
  return (
    <div className="flex items-center gap-2">
      <Link href="/stories/mine" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[#16221b] shadow-sm hover:border-[var(--gold)]">My stories</Link>
      <Link href="/stories/write" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-[#16221b] shadow-sm hover:bg-[var(--gold-bright)]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
        Write a story
      </Link>
    </div>
  );
}
