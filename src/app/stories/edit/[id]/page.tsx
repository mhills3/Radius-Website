"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getStory, type StoryDoc } from "@/lib/stories";
import StoryEditor from "@/components/stories/StoryEditor";
import WriterGate from "@/components/stories/WriterGate";

export default function EditStoryPage() {
  const params = useParams();
  const id = params.id as string;
  const [story, setStory] = useState<StoryDoc | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    getStory(id).then((s) => { if (s) { setStory(s); setState("ready"); } else setState("missing"); }).catch(() => setState("missing"));
  }, [id]);

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <WriterGate>
        {state === "loading" && <div className="flex min-h-[50vh] items-center justify-center text-[#6b7a70]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}
        {state === "missing" && <div className="mx-auto max-w-md px-6 py-24 text-center"><h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">Story not found</h1><Link href="/stories/mine" className="mt-3 inline-block text-sm font-bold text-[#9a7a3a] hover:underline">← My stories</Link></div>}
        {state === "ready" && story && <StoryEditor existing={story} />}
      </WriterGate>
    </div>
  );
}
