"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import CourseBuilder from "@/components/courses/CourseBuilder";

export default function NewCoursePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || (!user && typeof window !== "undefined")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-[var(--sage)]">
        <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Course building uses a map — desktop only, like sign-in */}
      <div className="px-6 pt-24 text-center md:hidden">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.02em] text-[#16221b]">Build on desktop</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-[#46554c]">Mapping a course with tee &amp; basket pins needs a bigger screen. Open this page on a computer — or map your course right inside the Radius app.</p>
        <Link href="/courses" className="mt-7 inline-block rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-[#16221b]">Back to courses</Link>
      </div>
      <div className="hidden md:block">
        <CourseBuilder uid={user.uid} />
      </div>
    </div>
  );
}
