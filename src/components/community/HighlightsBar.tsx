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
    <button
      onClick={onClick}
      className={`group relative w-[316px] shrink-0 overflow-hidden rounded-2xl text-left transition-all duration-300 hover:-translate-y-1 ${
        f
          ? "ring-[3px] ring-[var(--gold)] shadow-[0_0_20px_-2px_rgba(246,193,101,0.6),0_18px_42px_-18px_rgba(246,193,101,0.65)]"
          : x
          ? "ring-[3px] ring-[#5fcf80] shadow-[0_0_20px_-2px_rgba(95,207,128,0.6),0_18px_42px_-18px_rgba(95,207,128,0.65)]"
          : "bg-white/[0.02] ring-1 ring-white/[0.08] hover:bg-white/[0.05] hover:ring-white/20 hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.8)]"
      }`}
      style={f ? { background: "linear-gradient(180deg, rgba(246,193,101,0.12), rgba(246,193,101,0.02))" } : x ? { background: "linear-gradient(180deg, rgba(95,207,128,0.12), rgba(95,207,128,0.02))" } : undefined}
    >
      <div className="relative aspect-video w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.thumb} alt="" loading="lazy" className="h-full w-full scale-[1.06] object-cover transition-transform duration-500 group-hover:scale-[1.12]" />
        <div className={`absolute inset-0 bg-gradient-to-t from-black/55 to-transparent transition-opacity ${f || x ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
        {f && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#f8cf80] via-[#f6c165] to-[#e0a23a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#16221b] shadow-[0_4px_12px_rgba(246,193,101,0.5)] ring-1 ring-white/50">
            <span className="text-[11px]">★</span> Featured Partner
          </span>
        )}
        {x && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#8fe0a8] via-[#5fcf80] to-[#3aa85e] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#16221b] shadow-[0_4px_12px_rgba(95,207,128,0.5)] ring-1 ring-white/50">
            <span className="text-[11px]">★</span> Radius Exclusive
          </span>
        )}
        <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white opacity-0 shadow-lg backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
          <svg className="ml-0.5 h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </div>
      <div className="p-3">
        <div className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-[var(--cream)]">{v.title}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[var(--sage-dim)]">
          <span className={`truncate font-bold ${f ? "text-[var(--gold)]" : x ? "text-[#5fcf80]" : "text-[var(--sage)]"}`}>{v.channel}</span>
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff5a5a] opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff5a5a] shadow-[0_0_8px_#ff5a5a]" />
            </span>
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-extrabold tracking-[-0.02em] text-[var(--cream)]">Disc Golf Highlights</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--sage-dim)]">The latest from the pros &amp; our partners — refreshed automatically</p>
        </div>
        <a href="https://www.youtube.com/@Urban.DiscGolf" target="_blank" rel="noopener" className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:border-[var(--gold)]/40 hover:text-[var(--cream)] sm:inline-flex">
          Watch on YouTube ↗
        </a>
      </div>

      <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-4 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((v) => <Card key={v.id} v={v} onClick={() => setActive(v)} />)}
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
        </div>
      )}
    </section>
  );
}
