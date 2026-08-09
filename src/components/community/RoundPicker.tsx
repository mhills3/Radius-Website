"use client";

import { useEffect, useState } from "react";
import { getRecentRounds, type RecentRound } from "@/lib/rounds";
import { getAllCourses, slugify, type Course } from "@/lib/courses";
import type { SharedRound } from "@/lib/feed";

const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export default function RoundPicker({ uid, onSelect, onClose }: { uid: string; onSelect: (r: SharedRound) => void; onClose: () => void }) {
  const [rounds, setRounds] = useState<RecentRound[] | null>(null);
  const [byName, setByName] = useState<Map<string, Course>>(new Map());

  useEffect(() => {
    getRecentRounds(uid, 15).then(setRounds).catch(() => setRounds([]));
    // Resolve each round's course → cover + slug so the shared card has a real visual + link.
    getAllCourses().then((cs) => {
      const m = new Map<string, Course>();
      cs.forEach((c) => { const k = c.name.trim().toLowerCase(); if (!m.has(k)) m.set(k, c); });
      setByName(m);
    }).catch(() => {});
  }, [uid]);

  const pick = (r: RecentRound) => {
    const c = byName.get(r.courseName.trim().toLowerCase());
    onSelect({ courseName: r.courseName, scoreToPar: r.relativeToPar, holesPlayed: r.holesPlayed, birdies: r.birdies, cover: c?.coverPhotoUrl, slug: c ? slugify(c.name, c.id) : undefined, courseId: c?.id });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-mid)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-white/10 px-4 py-3">
          <div className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--cream)]">Share a round</div>
          <div className="text-xs text-[var(--sage-dim)]">Pick one of your recent rounds to post</div>
        </div>
        <div className="max-h-[52vh] overflow-y-auto">
          {rounds === null ? (
            <div className="p-6 text-center text-sm text-[var(--sage-dim)]">Loading your rounds…</div>
          ) : rounds.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--sage-dim)]">No completed rounds yet — play one in the Radius app.</div>
          ) : (
            rounds.map((r) => {
              const c = byName.get(r.courseName.trim().toLowerCase());
              return (
                <button key={r.roundId} onClick={() => pick(r)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]">
                  <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--bg-deep)] text-base text-[var(--gold)]">
                    {c?.coverPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : "⛳"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--cream)]">{r.courseName}</span>
                    <span className="block truncate text-xs text-[var(--sage-dim)]">{fmtDate(r.date)} · {r.holesPlayed} holes{r.birdies > 0 ? ` · ${r.birdies} birdie${r.birdies === 1 ? "" : "s"}` : ""}</span>
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-heading)] text-lg font-extrabold" style={{ color: scoreColor(r.relativeToPar) }}>{fmtScore(r.relativeToPar)}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-white/10 p-2 text-right">
          <button onClick={onClose} className="rounded-full px-4 py-1.5 text-sm font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Cancel</button>
        </div>
      </div>
    </div>
  );
}
