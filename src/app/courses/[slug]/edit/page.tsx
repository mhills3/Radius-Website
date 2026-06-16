"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import CourseBuilder from "@/components/courses/CourseBuilder";
import { idFromSlug, getCourseByShortId, getCourseForEdit, type EditCourse } from "@/lib/courses";

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params?.slug || "");
  const { user, loading } = useAuth();
  const [state, setState] = useState<"loading" | "ready" | "denied" | "notfound">("loading");
  const [course, setCourse] = useState<EditCourse | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    (async () => {
      const shortId = idFromSlug(slug);
      if (!shortId) { setState("notfound"); return; }
      const c = await getCourseByShortId(shortId);
      if (!c) { setState("notfound"); return; }
      const ec = await getCourseForEdit(user.uid, c.id);
      if (!ec) { setState("denied"); return; }
      setCourse(ec); setState("ready");
    })();
  }, [loading, user, slug, router]);

  if (loading || (user && state === "loading")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--cream)] text-[var(--sage)]">
        <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    );
  }
  if (!user) return null;

  if (state === "notfound" || state === "denied") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--cream)] px-6 text-center text-[#16221b]">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.02em]">{state === "denied" ? "That's not your course" : "Course not found"}</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-[#46554c]">{state === "denied" ? "You can only edit courses you created." : "We couldn't find that course to edit."}</p>
        <Link href="/courses/mine" className="mt-7 rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-[#16221b]">Back to my courses</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="px-6 pt-24 text-center md:hidden">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.02em] text-[#16221b]">Edit on desktop</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-[#46554c]">Editing a course&apos;s map needs a bigger screen. Open this page on a computer — or edit in the Radius app.</p>
        <Link href="/courses/mine" className="mt-7 inline-block rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-[#16221b]">Back to my courses</Link>
      </div>
      <div className="hidden md:block">{course && <CourseBuilder uid={user.uid} initial={course} />}</div>
    </div>
  );
}
