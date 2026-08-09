"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllCourses, slugify, type Course } from "@/lib/courses";
import type { CourseTag } from "@/lib/feed";

export default function CourseTagPicker({ onSelect, onClose }: { onSelect: (c: CourseTag) => void; onClose: () => void }) {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { getAllCourses().then(setCourses).catch(() => setCourses([])); }, []);

  const results = useMemo(() => {
    if (!courses) return [];
    const s = q.trim().toLowerCase();
    const list = s ? courses.filter((c) => `${c.name} ${c.city ?? ""} ${c.state ?? ""}`.toLowerCase().includes(s)) : courses;
    return list.slice(0, 40);
  }, [courses, q]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-mid)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-white/10 p-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses to tag…" className="w-full rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:bg-white/[0.1]" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {courses === null ? (
            <div className="p-6 text-center text-sm text-[var(--sage-dim)]">Loading courses…</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--sage-dim)]">No courses match.</div>
          ) : (
            results.map((c) => (
              <button key={c.id} onClick={() => { onSelect({ id: c.id, slug: slugify(c.name, c.id), name: c.name }); onClose(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]">
                <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[radial-gradient(circle_at_30%_25%,rgba(246,193,101,0.3),var(--bg-deep))] font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--cream)]/70">
                  {c.name.charAt(0).toUpperCase()}
                  {c.coverPhotoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverPhotoUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--cream)]">{c.name}</span>
                  <span className="block truncate text-xs text-[var(--sage-dim)]">{[c.city, c.state].filter(Boolean).join(", ")}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-white/10 p-2 text-right">
          <button onClick={onClose} className="rounded-full px-4 py-1.5 text-sm font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Cancel</button>
        </div>
      </div>
    </div>
  );
}
