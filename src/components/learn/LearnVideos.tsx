"use client";

import { useEffect, useState } from "react";

type Tutorial = { id: string; title: string; body: string };

const TUTORIALS: Tutorial[] = [
  { id: "JUt9u6Fcrnc", title: "How to Use the Home Tab", body: "Your dashboard for recent rounds, stats, and quick actions." },
  { id: "WO1zfsUm5hQ", title: "How to Use the Discover Tab", body: "Find courses, players, and the community around you." },
  { id: "qgmhvFEuJfk", title: "Track a Round with Live Play", body: "Score, log shots, and capture data as you play." },
  { id: "UK2VdbCMF-I", title: "How to Use Game Modes", body: "Run different formats with friends — solo, doubles, and more." },
  { id: "ngibwiTZUBA", title: "How to Use the My Game Tab", body: "Target your weak spots with drills and tailored practice." },
  { id: "SHdkJ8qQGU4", title: "How to Build a Course", body: "Map a course hole-by-hole and share it with the community." },
];

export default function LearnVideos() {
  const [active, setActive] = useState<Tutorial | null>(null);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TUTORIALS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setActive(t)}
            className="group overflow-hidden rounded-2xl border border-black/8 bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_-18px_rgba(0,0,0,0.35)]"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-[var(--bg-mid)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${t.id}/maxresdefault.jpg`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`; }}
                alt={t.title}
                loading={i < 3 ? "eager" : "lazy"}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">Tutorial</span>
              <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--gold)] text-[#16221b] opacity-0 shadow-lg transition-all duration-300 group-hover:opacity-100">
                <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-6 w-6"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </div>
            <div className="p-5">
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#46554c]">{t.body}</p>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${active.id}?autoplay=1&rel=0`}
                title={active.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[var(--cream)]">{active.title}</div>
                <div className="text-xs text-[var(--sage-dim)]">{active.body}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={`https://youtu.be/${active.id}`} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:bg-white/[0.06]">YouTube ↗</a>
                <button onClick={() => setActive(null)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[var(--cream)] transition-colors hover:bg-white/20">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
