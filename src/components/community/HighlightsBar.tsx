"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
function fmtViews(n?: number): string {
  if (!n || n <= 0) return "";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K views`;
  return `${n} views`;
}

function Card({ v, onClick }: { v: Highlight; onClick: () => void }) {
  const f = v.featured;
  const x = v.exclusive;
  const views = fmtViews(v.views);
  return (
    <button onClick={onClick} className="group relative w-[316px] shrink-0 snap-start text-left transition-transform duration-300 hover:-translate-y-1">
      {/* thumbnail — one radius, no border; scales on hover */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {(f || x) && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#f8cf80] via-[#f6c165] to-[#e0a23a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#141b16] shadow-[0_4px_12px_rgba(246,193,101,0.5)]">
            <span className="text-[11px]">★</span> {f ? "Featured Partner" : "Radius Exclusive"}
          </span>
        )}
        <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white opacity-0 shadow-lg backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
          <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </div>
      <div className="pt-3">
        <div className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-[var(--cream)]/85 transition-colors group-hover:text-[var(--cream)]">{v.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--sage-dim)]">
          <span className={`truncate font-bold ${f || x ? "text-[var(--gold)]" : "text-[var(--sage)]"}`}>{v.channel}</span>
          <span>·</span><span className="shrink-0">{timeAgo(v.published)}</span>
          {views && (<><span>·</span><span className="shrink-0">{views}</span></>)}
        </div>
      </div>
    </button>
  );
}

export default function HighlightsBar() {
  const [videos, setVideos] = useState<Highlight[]>([]);
  const [active, setActive] = useState<Highlight | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => rowRef.current?.scrollBy({ left: dir * 332, behavior: "smooth" });

  useEffect(() => {
    let alive = true;
    fetch("/api/highlights").then((r) => r.json()).then((d) => { if (alive && Array.isArray(d.videos)) setVideos(d.videos); }).catch(() => {});
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
    <section className="mb-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--gold)] opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]" />
            </span>
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-extrabold tracking-[-0.02em] text-[var(--cream)]">Disc Golf Highlights</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--sage-dim)]">The latest from the pros &amp; our partners — refreshed automatically</p>
        </div>
        <a href="https://www.youtube.com/@Urban.DiscGolf" target="_blank" rel="noopener" className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--cream)] sm:inline-flex">
          Watch on YouTube ↗
        </a>
      </div>

      <div className="group/rail relative -mx-2">
        <div ref={rowRef} className="flex snap-x snap-mandatory scroll-px-2 gap-4 overflow-x-auto px-2 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {videos.map((v) => <Card key={v.id} v={v} onClick={() => setActive(v)} />)}
        </div>
        {/* right-edge fade signals the row keeps scrolling (instead of reading as a clipped card) */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-[linear-gradient(to_left,var(--bg-deep),transparent)]" />
        {/* arrow controls — appear on hover */}
        <button onClick={() => scroll(-1)} aria-label="Scroll left" className="absolute left-1 top-[30%] z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-lg text-[var(--cream)] opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 hover:bg-black/80 group-hover/rail:opacity-100 sm:grid">‹</button>
        <button onClick={() => scroll(1)} aria-label="Scroll right" className="absolute right-1 top-[30%] z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-lg text-[var(--cream)] opacity-0 shadow-lg backdrop-blur transition-opacity duration-200 hover:bg-black/80 group-hover/rail:opacity-100 sm:grid">›</button>
      </div>

      {active && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
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
                <div className="flex min-w-0 items-center gap-2">
                  {active.featured && <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--gold)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#16221b]">★ Partner</span>}
                  <div className="truncate text-sm font-bold text-[var(--cream)]">{active.title}</div>
                </div>
                <div className="mt-0.5 text-xs text-[var(--sage-dim)]">{active.channel} · {timeAgo(active.published)}{fmtViews(active.views) ? ` · ${fmtViews(active.views)}` : ""}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={active.url} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:bg-white/[0.06]">YouTube ↗</a>
                <button onClick={() => setActive(null)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-[var(--cream)] transition-colors hover:bg-white/20">Close</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
