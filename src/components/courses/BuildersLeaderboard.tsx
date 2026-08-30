"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTopBuilders, type Builder } from "@/lib/courses";
import { getRanksFor, type RankInfo } from "@/lib/community";

const HEAD = "font-[family-name:var(--font-heading)]";
const LEGEND = 100; // 100+ courses built → Legend treatment (matches the courses widget)

// Podium medals — gold / silver / bronze.
const MEDALS: Record<number, { label: string; icon: string; color: string; soft: string }> = {
  1: { label: "1st", icon: "🏆", color: "#f6c165", soft: "rgba(246,193,101,0.12)" },
  2: { label: "2nd", icon: "🥈", color: "#cfd6e0", soft: "rgba(207,214,224,0.09)" },
  3: { label: "3rd", icon: "🥉", color: "#dca06e", soft: "rgba(220,160,110,0.10)" },
};

function LegendMark({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="Legend"><path d="M5 19h14l1.5-10-4.5 3.5L12 6l-4 6.5L3.5 9 5 19z" /></svg>;
}

export default function BuildersLeaderboard() {
  const [builders, setBuilders] = useState<Builder[] | null>(null);
  const [ranks, setRanks] = useState<Map<string, RankInfo>>(new Map());

  useEffect(() => {
    getTopBuilders(25)
      .then((b) => { setBuilders(b); getRanksFor(b.map((x) => x.id).filter(Boolean)).then(setRanks).catch(() => {}); })
      .catch(() => setBuilders([]));
  }, []);

  const rankOf = (b: Builder) => (b.id ? ranks.get(b.id) : undefined);
  const photoOf = (b: Builder) => rankOf(b)?.photo;
  const profileHref = (b: Builder) => (b.username ? `/u/${b.username}` : undefined);

  function TierChip({ b }: { b: Builder }) {
    const r = rankOf(b);
    if (!r?.tier) return null;
    return <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${r.color ?? "#8a968d"}22`, color: r.color ?? "#8a968d" }}>{r.tier}</span>;
  }

  function Avatar({ b, className = "", ringColor }: { b: Builder; className?: string; ringColor?: string }) {
    const photo = photoOf(b);
    const legend = b.count >= LEGEND;
    // Legend avatars have a GOLD fill, so the fallback initial must be dark to stay visible.
    const bg = legend ? "bg-gradient-to-br from-[var(--gold-bright)] to-[var(--gold)] text-[#141B16]" : "bg-[var(--gold)]/15 text-[var(--gold)]";
    const ringCls = ringColor ? "" : legend ? "ring-2 ring-[var(--gold)]/40" : "ring-1 ring-white/10";
    return (
      <span
        className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-bold ${bg} ${ringCls} ${className}`}
        style={ringColor ? { boxShadow: `0 0 0 3px ${ringColor}, 0 0 28px -8px ${ringColor}` } : undefined}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          b.name.charAt(0).toUpperCase()
        )}
      </span>
    );
  }

  const top3 = builders?.slice(0, 3) ?? [];
  const rest = builders?.slice(3) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <Link href="/courses" className="text-[12px] font-semibold text-[var(--sage)] transition-colors hover:text-[var(--gold)]">← Courses</Link>
      <div className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]"><LegendMark className="h-3.5 w-3.5" /> Course builders</div>
      <h1 className={`${HEAD} mt-2 text-4xl font-black tracking-[-0.03em] sm:text-5xl`}>Top 25 builders</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text-body)]">The players putting disc golf on the map — literally. Ranked by the number of courses they&apos;ve mapped and shared with the community. <span className="font-semibold text-[var(--cream)]">100+ earns Legend.</span></p>

      {builders === null ? (
        <div className="mt-16 flex justify-center text-[var(--sage)]"><svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : builders.length === 0 ? (
        <p className="mt-12 text-center text-[var(--sage-dim)]">No builders yet.</p>
      ) : (
        <>
          {/* podium — top 3 */}
          {top3.length >= 3 && (
            <div className="mt-12 grid grid-cols-3 items-end gap-3 sm:gap-5">
              {[top3[1], top3[0], top3[2]].map((b, order) => {
                const place = order === 0 ? 2 : order === 1 ? 1 : 3;
                const m = MEDALS[place];
                const first = place === 1;
                const legend = b.count >= LEGEND;
                const Wrap: React.ElementType = profileHref(b) ? Link : "div";
                return (
                  <Wrap
                    key={b.id + place}
                    {...(profileHref(b) ? { href: profileHref(b)! } : {})}
                    className={`group relative flex flex-col items-center overflow-hidden rounded-3xl border p-4 text-center transition-transform hover:-translate-y-1 sm:p-6 ${first ? "-mt-3 sm:-mt-9" : ""}`}
                    style={{ borderColor: `${m.color}5c`, background: `linear-gradient(180deg, ${m.soft}, rgba(255,255,255,0.014) 62%)`, boxShadow: first ? `0 0 64px -18px ${m.color}` : `0 0 42px -24px ${m.color}` }}
                  >
                    {/* medal shimmer strip along the top */}
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${m.color}, transparent)` }} />
                    <div className={`${HEAD} inline-flex items-center gap-1.5 text-[13px] font-black`} style={{ color: m.color }}><span className="text-[15px]">{m.icon}</span> {m.label}</div>
                    <Avatar b={b} ringColor={m.color} className={first ? "mt-3.5 h-[86px] w-[86px] text-2xl sm:h-24 sm:w-24 sm:text-3xl" : "mt-3.5 h-16 w-16 text-xl sm:h-[76px] sm:w-[76px] sm:text-2xl"} />
                    <div className="mt-3.5 flex items-center gap-1">
                      {legend && <LegendMark className="h-3.5 w-3.5 shrink-0 text-[var(--gold-bright)]" />}
                      <span className={`${HEAD} truncate text-[15px] font-bold sm:text-base ${legend ? "bg-gradient-to-r from-[#f0c377] to-[#f7dca0] bg-clip-text text-transparent" : "text-[var(--cream)]"}`}>{b.name}</span>
                    </div>
                    {b.username && <div className="truncate text-[11px] text-[var(--sage-dim)]">@{b.username}</div>}
                    <div className="mt-2.5 flex items-baseline gap-1">
                      <span style={{ color: m.color, fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" }} className="text-2xl font-black sm:text-[28px]">{b.count}</span>
                      <span className="text-[11px] font-semibold text-[var(--sage-dim)]">courses</span>
                    </div>
                  </Wrap>
                );
              })}
            </div>
          )}

          {/* ranks 4–25 */}
          <div className="mt-8 divide-y divide-[var(--hair)] border-t border-[var(--hair)]">
            {rest.map((b, i) => {
              const place = i + 4;
              const legend = b.count >= LEGEND;
              const Wrap: React.ElementType = profileHref(b) ? Link : "div";
              return (
                <Wrap key={b.id + place} {...(profileHref(b) ? { href: profileHref(b)! } : {})} className="group flex items-center gap-4 py-3.5 transition-colors hover:bg-white/[0.02]">
                  <span style={{ fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" }} className="w-6 shrink-0 text-center text-[15px] font-bold text-[var(--sage-dim)]">{place}</span>
                  <Avatar b={b} className="h-11 w-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {legend && <LegendMark className="h-3.5 w-3.5 shrink-0 text-[var(--gold-bright)]" />}
                      <span className={`${HEAD} truncate text-[15px] font-bold ${legend ? "bg-gradient-to-r from-[#f0c377] to-[#f7dca0] bg-clip-text text-transparent" : "text-[var(--cream)] group-hover:text-[var(--gold)]"}`}>{b.name}</span>
                      <TierChip b={b} />
                    </div>
                    {b.username && <div className="truncate text-[12px] text-[var(--sage-dim)]">@{b.username}</div>}
                  </div>
                  <div className="flex shrink-0 items-baseline gap-1">
                    <span style={{ fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" }} className={`text-lg font-black ${legend ? "text-[var(--gold-bright)]" : "text-[var(--cream)]"}`}>{b.count}</span>
                    <span className="hidden text-[11px] font-semibold text-[var(--sage-dim)] sm:inline">courses</span>
                  </div>
                </Wrap>
              );
            })}
          </div>

          <div className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center">
            <div className={`${HEAD} text-lg font-bold text-[var(--cream)]`}>Want your name on this list?</div>
            <p className="mx-auto mt-1.5 max-w-md text-[14px] text-[var(--text-body)]">Map a course in the Radius app and it&apos;s live for everyone. Every course you build climbs the board.</p>
            <Link href="/courses" className="mt-5 inline-block rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)]">Explore courses</Link>
          </div>
        </>
      )}
    </div>
  );
}
