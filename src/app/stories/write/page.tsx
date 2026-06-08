"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import StoryEditor from "@/components/stories/StoryEditor";
import WriterGate from "@/components/stories/WriterGate";

export default function WritePage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !profile?.writer) router.replace("/stories"); }, [loading, profile, router]);
  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <WriterGate>
        <StoryEditor />
      </WriterGate>
    </div>
  );
}
