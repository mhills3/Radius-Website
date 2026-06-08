"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { isMember, joinCourse, leaveCourse, getMemberCount } from "@/lib/courseCommunity";

export default function CourseGroupBar({ courseId, courseName }: { courseId: string; courseName: string }) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [joined, setJoined] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const isHome = !!profile?.homeCourseName && profile.homeCourseName.trim().toLowerCase() === courseName.trim().toLowerCase();

  useEffect(() => {
    let alive = true;
    getMemberCount(courseId).then((n) => { if (alive) setCount(n); });
    return () => { alive = false; };
  }, [courseId]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      let m = await isMember(user.uid, courseId);
      if (isHome && !m) { await joinCourse(user.uid, courseId); m = true; if (alive) setCount((c) => c + 1); }
      if (alive) setJoined(m);
    })();
    return () => { alive = false; };
  }, [user, courseId, isHome]);

  const toggle = async () => {
    if (!user) { router.push("/login"); return; }
    if (isHome || busy) return;
    const next = !joined;
    setBusy(true); setJoined(next); setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try { next ? await joinCourse(user.uid, courseId) : await leaveCourse(user.uid, courseId); }
    catch { setJoined(!next); setCount((c) => Math.max(0, c + (next ? -1 : 1))); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--bg-deep)] text-xl text-[var(--gold)]">⛳</span>
        <div>
          <div className="font-[family-name:var(--font-heading)] font-bold text-[#16221b]">{courseName} group</div>
          <div className="text-xs text-[#8a968d]">{count} member{count === 1 ? "" : "s"}{isHome ? " · 🏠 your home course" : ""}</div>
        </div>
      </div>
      {isHome ? (
        <span className="rounded-full bg-[#5fcf80]/15 px-4 py-2 text-sm font-bold text-[#1d8f48]">✓ Member</span>
      ) : (
        <button onClick={toggle} disabled={busy} className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${joined ? "border border-black/10 bg-white text-[#16221b] hover:border-[var(--gold)]" : "bg-[var(--gold)] text-[#16221b] hover:bg-[var(--gold-bright)]"} disabled:opacity-60`}>{joined ? "✓ Joined" : "+ Join group"}</button>
      )}
    </div>
  );
}
