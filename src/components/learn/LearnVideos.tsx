"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Tutorial = { id: string; title: string; body: string; shot: string };

const TUTORIALS: Tutorial[] = [
  { id: "JUt9u6Fcrnc", title: "How to Use the Home Tab", body: "Your dashboard for recent rounds, stats, and quick actions.", shot: "/screens/home.png" },
  { id: "WO1zfsUm5hQ", title: "How to Use the Discover Tab", body: "Find courses, players, and the community around you.", shot: "/screens/discover.png" },
  { id: "qgmhvFEuJfk", title: "Track a Round with Live Play", body: "Score, log shots, and capture data as you play.", shot: "/screens/holemap.png" },
  { id: "UK2VdbCMF-I", title: "How to Use Game Modes", body: "Run different formats with friends — solo, doubles, and more.", shot: "/screens/gamemodes.png" },
  { id: "ngibwiTZUBA", title: "How to Use the My Game Tab", body: "Target your weak spots with drills and tailored practice.", shot: "/screens/mygame.png" },
  { id: "SHdkJ8qQGU4", title: "How to Build a Course", body: "Map a course hole-by-hole and share it with the community.", shot: "/screens/courses.png" },
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
            {/* branded thumbnail */}
            <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-[var(--bg-deep)] via-[var(--bg-mid)] to-[var(--bg-deep)]">
              {/* topo texture */}
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden
                style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", maskPosition: "center", WebkitMaskPosition: "center", backgroundColor: "var(--cream)", opacity: 0.07 }}
              />
              {/* gold glow behind the device */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.22),transparent_66%)]" />

              <span className="absolute left-3 top-3 z-20 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--cream)] ring-1 ring-white/10 backdrop-blur">Tutorial</span>

              {/* app screen as a tilted phone, bleeding off the bottom */}
              <div className="absolute left-1/2 top-5 z-0 w-[34%] -translate-x-1/2 -rotate-[5deg] overflow-hidden rounded-[1.15rem] ring-1 ring-white/15 shadow-[0_22px_48px_-14px_rgba(0,0,0,0.75)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:-rotate-[3deg]">
                <div className="relative aspect-[9/19]">
                  <Image src={t.shot} alt={t.title} fill sizes="180px" loading={i < 3 ? "eager" : "lazy"} className="object-cover object-top" />
                </div>
              </div>

              {/* play button */}
              <span className="absolute left-1/2 top-1/2 z-10 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--gold)] text-[#16221b] shadow-[0_8px_24px_-6px_rgba(246,193,101,0.8)] ring-4 ring-[var(--gold)]/20 transition-transform duration-300 group-hover:scale-110">
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
