"use client";

import { useEffect, useState } from "react";
import type { Highlight } from "@/lib/youtube";

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  const d = Math.floor(s / 86400);
  if (d >= 365) return `${Math.floor(d / 365)}y ago`;
  if (d >= 30) return `${Math.floor(d / 30)}mo ago`;
  if (d >= 1) return `${d}d ago`;
  const h = Math.floor(s / 3600);
  if (h >= 1) return `${h}h ago`;
  return `${Math.max(1, Math.floor(s / 60))}m ago`;
}

export default function HighlightsBar() {
  const [videos, setVideos] = useState<Highlight[]>([]);
  const [active, setActive] = useState<Highlight | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/highlights")
      .then((r) => r.json())
      .then((d) => { if (alive && Array.isArray(d.videos)) setVideos(d.videos); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  if (videos.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff5a5a] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff5a5a]" />
          </span>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Disc golf highlights</h2>
        </div>
        <span className="text-xs text-[var(--sage-dim)]">Newest from across the sport</span>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((v) => (
          <button
            key={v.id}
            onClick={() => setActive(v)}
            className={`group relative shrink-0 overflow-hidden rounded-2xl text-left transition-transform hover:-translate-y-0.5 ${v.featured ? "w-[300px] ring-2 ring-[var(--gold)]" : "w-[224px] ring-1 ring-white/[0.08]"}`}
          >
            <div className="relative aspect-video w-full overflow-hidden bg-[var(--bg-mid)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {/* play glyph */}
              <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                <svg className="ml-0.5 h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </span>
              {v.featured && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#16221b]">★ Featured Partner</span>
              )}
            </div>
            <div className={`${v.featured ? "bg-[var(--gold)]/[0.08]" : "bg-white/[0.03]"} p-3`}>
              <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cream)]">{v.title}</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--sage-dim)]">
                <span className={`truncate font-semibold ${v.featured ? "text-[var(--gold)]" : "text-[var(--sage)]"}`}>{v.channel}</span>
                <span>·</span>
                <span className="shrink-0">{timeAgo(v.published)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setActive(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
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
                <div className="text-xs text-[var(--sage-dim)]">{active.channel} · {timeAgo(active.published)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={active.url} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:bg-white/[0.06]">YouTube ↗</a>
                <button onClick={() => setActive(null)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[var(--cream)] transition-colors hover:bg-white/20">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
