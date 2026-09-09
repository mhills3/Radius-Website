"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Vid = { id: string; title: string; channel: string; own?: boolean };

// Videos Radius was featured in + our own channel films. Marquee loops seamlessly; click to watch.
const FEATURED: Vid[] = [
  { id: "idApg7z3t-U", title: "Robot vs. Human Caddie Battle at the Hardest Course", channel: "Foundation Disc Golf" },
  { id: "uxOc3k9z9oY", title: "Why I Left UDisc and Built My Own Disc Golf App", channel: "Radius", own: true },
  { id: "ma_kNu_Z6CM", title: "Abandoned Six Flags — Buhr, Barela, Babcock, Gossage, Samson", channel: "Urban Disc Golf" },
  { id: "OB2rUsyAWZo", title: "How They Created a Groundbreaking Disc Golf App", channel: "Funsie Podcast" },
  { id: "ZbZdmr7s9Sk", title: "I Spent 1,000 Hours Building the Smartest Disc Golf App", channel: "Radius", own: true },
];

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

function Card({ v, onClick }: { v: Vid; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group/card w-[300px] shrink-0 text-left sm:w-[340px]">
      <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[var(--bg-mid)] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-black/20 transition-all duration-300 group-hover/card:-translate-y-1.5 group-hover/card:border-[var(--gold)]/40 group-hover/card:shadow-[0_32px_72px_-24px_rgba(246,193,101,0.32)]">
        <div className="relative aspect-video w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb(v.id)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-[600ms] ease-out group-hover/card:scale-[1.07]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
          {/* badge */}
          {v.own ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#f8cf80] via-[#f6c165] to-[#e0a23a] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#141b16] shadow-[0_4px_12px_rgba(246,193,101,0.5)]">★ Radius</span>
          ) : (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cream)] backdrop-blur-md">Featured in</span>
          )}
          {/* play affordance — always present, blooms gold on hover */}
          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-md transition-all duration-300 group-hover/card:scale-110 group-hover/card:bg-[var(--gold)] group-hover/card:text-[#141b16] group-hover/card:ring-[var(--gold)]">
            <svg className="ml-0.5 h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </div>
        <div className="p-4">
          <div className="line-clamp-2 min-h-[2.5rem] text-[13.5px] font-semibold leading-snug text-[var(--cream)]/90 transition-colors group-hover/card:text-[var(--cream)]">{v.title}</div>
          <div className="mt-2.5 flex items-center gap-2 border-t border-white/[0.07] pt-2.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: v.own ? "var(--gold)" : "var(--sage)" }} />
            <span className={`truncate text-[11.5px] font-bold ${v.own ? "text-[var(--gold)]" : "text-[var(--sage)]"}`}>{v.channel}</span>
            <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--sage-dim)] transition-colors group-hover/card:text-[var(--gold)]" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" /></svg>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function FeaturedIn() {
  const [active, setActive] = useState<Vid | null>(null);
  // Duplicate the list so translateX(-50%) lands exactly one set over → seamless loop.
  const loop = [...FEATURED, ...FEATURED];

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <section className="relative overflow-hidden border-y border-white/[0.07] bg-[#0a120e] py-16 sm:py-20">
      {/* faint gold glow so the band reads as its own section, not a continuation of the bento above */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-72 w-[52rem] max-w-[90%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.10),transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="text-center">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Featured in</div>
          <h2 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] text-[var(--cream)] sm:text-4xl">As seen across the sport.</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--text-body)]">Creators, podcasts, and touring pros covering Radius — alongside a few films of our own. Tap any to watch.</p>
        </div>
      </div>

      {/* drifting rail — fades at both edges, pauses on hover */}
      <div className="group mt-10 [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]">
        <div className="flex w-max gap-5 animate-[featMarquee_55s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:[animation:none] motion-reduce:justify-center motion-reduce:flex-wrap">
          {loop.map((v, i) => <Card key={`${v.id}-${i}`} v={v} onClick={() => setActive(v)} />)}
        </div>
      </div>
      <style>{`@keyframes featMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>

      {active && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setActive(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10">
              <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${active.id}?autoplay=1&rel=0`} title={active.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
            </div>
            <div className="mt-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[var(--cream)]">{active.title}</div>
                <div className={`mt-0.5 text-xs font-semibold ${active.own ? "text-[var(--gold)]" : "text-[var(--sage-dim)]"}`}>{active.channel}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={`https://youtu.be/${active.id}`} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-[var(--cream)] transition-colors hover:bg-white/[0.06]">YouTube ↗</a>
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
