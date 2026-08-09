"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getDashboard, type Dashboard } from "@/lib/account";
import { getPostsByAuthor, type FeedPost } from "@/lib/feed";
import PostCard from "@/components/community/PostCard";
import { type RankInfo } from "@/lib/community";
import { getBagNames, getDiscCatalog, getCustomDiscs, normCat } from "@/lib/bag";
import { buildDiscs, customToDiscData, type DiscData } from "@/lib/discs";
import { slugify } from "@/lib/courses";
import { rankForIQ, rankLabel, rankProgress } from "@/lib/rank";
import { IqRing } from "@/components/dashboard/charts";
import DiscGraphic from "@/components/bag/DiscGraphic";
import LevelBadge from "@/components/rank/LevelBadge";
import FollowButton from "@/components/profile/FollowButton";
import BagCompare from "@/components/profile/BagCompare";

const fnum = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const CAT_ORDER: { key: string; label: string }[] = [{ key: "PUTTER", label: "Putters" }, { key: "MIDRANGE", label: "Midranges" }, { key: "FAIRWAY", label: "Fairway drivers" }, { key: "DISTANCE", label: "Distance drivers" }];

const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export default function ProfileView({ canonicalId, identity }: { canonicalId: string; identity: { name: string; username: string; photo?: string; bio?: string; homeCourseName?: string; homeCourseId?: string } }) {
  const { user: viewer } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [bag, setBag] = useState<DiscData[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard(canonicalId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    getPostsByAuthor(canonicalId, 20).then(setPosts).catch(() => setPosts([]));
    Promise.all([getBagNames(canonicalId), getDiscCatalog(), getCustomDiscs(canonicalId)])
      .then(([names, rows, custom]) => {
        const byName = new Map(buildDiscs(rows).map((d) => [d.name.toLowerCase(), d]));
        // Custom discs override the catalog by name (iOS allAvailableDiscs); custom-only discs resolve too.
        const customMap = new Map(custom.map((c) => [c.name.toLowerCase(), customToDiscData(c)]));
        const seen = new Set<string>();
        const out: DiscData[] = [];
        for (const n of names) { const k = n.trim().toLowerCase(); const d = customMap.get(k) ?? byName.get(k); if (d && !seen.has(d.slug)) { seen.add(d.slug); out.push(d); } }
        setBag(out);
      })
      .catch(() => setBag([]));
  }, [canonicalId]);

  const bagByCat = useMemo(() => CAT_ORDER.map((c) => ({ ...c, discs: bag.filter((d) => normCat(d.category) === c.key) })).filter((g) => g.discs.length), [bag]);

  const iq = data?.iqCurrent ?? 0;
  const rank = useMemo(() => rankForIQ(iq), [iq]);
  const metas = data?.roundMetas ?? [];
  const aces = data?.acesCount ?? 0;
  const courses = useMemo(() => new Set(metas.map((m) => (m.courseName || "").trim()).filter((c) => c && c !== "Unknown course")).size, [metas]);
  const best = useMemo(() => metas.reduce<number | null>((b, m) => (typeof m.scoreToPar === "number" && (b == null || m.scoreToPar < b) ? m.scoreToPar : b), null), [metas]);
  const recent = useMemo(() => [...metas].sort((a, b) => b.date - a.date).slice(0, 6), [metas]);
  const scored = useMemo(() => metas.filter((m) => typeof m.scoreToPar === "number") as { scoreToPar: number }[], [metas]);
  const avgScore = scored.length ? Math.round(scored.reduce((s, m) => s + m.scoreToPar, 0) / scored.length) : null;
  const totalHoles = useMemo(() => metas.reduce((s, m) => s + (m.holesPlayed || 0), 0), [metas]);
  const thisYear = useMemo(() => { const y = new Date().getFullYear(); return metas.filter((m) => m.date && new Date(m.date).getFullYear() === y).length; }, [metas]);
  const mostPlayed = useMemo(() => {
    const c: Record<string, number> = {};
    metas.forEach((m) => { const n = (m.courseName || "").trim(); if (n && n !== "Unknown course") c[n] = (c[n] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0] as [string, number] | undefined;
  }, [metas]);

  const badges = [
    { label: "First Ace", icon: "🎯", on: aces >= 1 },
    { label: "Ace Machine", icon: "🔥", on: aces >= 5 },
    { label: "Sub-Par Round", icon: "🐦", on: best != null && best < 0 },
    { label: "50-Round Club", icon: "🏅", on: metas.length >= 50 },
    { label: "Century", icon: "💯", on: metas.length >= 100 },
    { label: "Explorer", icon: "🗺️", on: courses >= 10 },
  ];

  const card = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* ===== HERO — stories-style colored topo cover (tinted by rank) ===== */}
      <div className="relative overflow-hidden border-b border-white/[0.06]" style={{ background: `linear-gradient(140deg, ${rank.color}, var(--bg-deep) 58%)` }}>
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.09 }} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(15,24,19,0.35),rgba(15,24,19,0.1)_45%,var(--bg-deep))]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-7 pt-24">
          <button onClick={() => { if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) window.history.back(); else window.location.assign("/community"); }} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gold)] hover:underline">← Back</button>
          <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-3xl font-bold text-[var(--cream)] ring-2 ring-[var(--gold)]/40">
              {identity.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={identity.photo} alt="" className="h-full w-full object-cover" />
              ) : (identity.name || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em] md:text-5xl">{identity.name}</h1>
              <div className="text-[var(--sage-dim)]">@{identity.username}</div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold" style={{ background: `${rank.color}22`, color: rank.color }}>{rankLabel(rank)} · {iq || "—"} IQ</span>
                {identity.homeCourseName && (
                  identity.homeCourseId
                    ? <Link href={`/courses/${slugify(identity.homeCourseName, identity.homeCourseId)}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-sm font-semibold text-[var(--cream)] transition-colors hover:border-[var(--gold)]/50">🏠 {identity.homeCourseName}</Link>
                    : <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-sm font-semibold text-[var(--cream)]">🏠 {identity.homeCourseName}</span>
                )}
              </div>
              {identity.bio && <p className="mt-2 max-w-md text-sm text-[var(--text-body)]">{identity.bio}</p>}
              <div className="mt-3 flex justify-center sm:justify-start"><FollowButton targetCanonical={canonicalId} /></div>
            </div>
            <div className="shrink-0"><LevelBadge rank={rank} size={88} /></div>
          </div>

          {/* glass stat bar */}
          <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-3 rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-3.5 backdrop-blur-md sm:flex sm:flex-wrap sm:gap-x-8">
            <HeroStat label="Rounds" value={metas.length} />
            <HeroStat label="Aces" value={aces} />
            <HeroStat label="Courses" value={courses} />
            <HeroStat label="Best" value={best != null ? fmt(best) : "—"} color={best != null ? scoreColor(best) : undefined} />
            <HeroStat label="Avg" value={avgScore != null ? fmt(avgScore) : "—"} />
            <HeroStat label="Game IQ" value={iq || "—"} />
          </div>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="mx-auto grid max-w-6xl items-start gap-8 px-6 py-8 lg:grid-cols-[1fr_336px]">
        <main className="min-w-0 space-y-6">
          {loading ? (
            <>{[0, 1, 2].map((i) => <div key={i} className={`h-40 animate-pulse ${card}`} />)}</>
          ) : (
            <>
              {/* Game IQ feature */}
              <div className={`${card} flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center`}>
                <IqRing iq={iq} progress={rankProgress(iq, rank)} label={rankLabel(rank)} color={rank.color} color2={rank.secondary} />
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Game IQ</div>
                  <div className="mt-0.5 font-[family-name:var(--font-heading)] text-2xl font-extrabold">{rankLabel(rank)}</div>
                  <p className="mt-1 text-sm text-[var(--text-body)]">Radius rates every round by how well you scored, putted, and avoided trouble — rolled into one number.</p>
                </div>
              </div>

              {/* Posts — makes the profile feel like a social feed */}
              {posts.length > 0 && (
                <div className={`${card} overflow-hidden`}>
                  <div className="px-5 pt-5 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Posts</div>
                  <div className="px-5">
                    {posts.map((p) => (
                      <PostCard key={p.id} post={p} rank={{ name: identity.name, photo: identity.photo, username: identity.username, tier: rank.tier, color: rank.color, iq } as RankInfo} myReaction={undefined} onReact={() => router.push(`/community/post/${p.id}`)} onOpen={() => router.push(`/community/post/${p.id}`)} />
                    ))}
                  </div>
                </div>
              )}

              {/* In the bag */}
              {bag.length > 0 && (
                <div className={`${card} p-5`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">In the bag</div>
                    <span className="text-xs text-[var(--sage-dim)]">{bag.length} discs</span>
                  </div>
                  <div className="space-y-4">
                    {bagByCat.map((g) => (
                      <div key={g.key}>
                        <div className="mb-2 text-xs font-bold text-[var(--sage)]">{g.label} · {g.discs.length}</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {g.discs.map((d) => (
                            <Link key={d.slug} href={`/discs/${d.slug}`} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-[var(--gold)]/40">
                              <span className="shrink-0"><DiscGraphic color={d.color || "#9aa6b2"} speed={d.speed} size={40} /></span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-[var(--cream)]">{d.name}</div>
                                <div className="truncate text-[11px] text-[var(--sage-dim)]">{d.manufacturer} · {d.speed}/{d.glide}/{fnum(d.turn)}/{fnum(d.fade)}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compare bags */}
              {bag.length > 0 && <BagCompare canonicalId={canonicalId} theirBag={bag} theirName={identity.name} username={identity.username} />}

              {/* Recent rounds */}
              <div className={`${card} p-5`}>
                <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Recent rounds</div>
                {recent.length === 0 ? <p className="text-sm text-[var(--sage-dim)]">No rounds yet.</p> : (
                  <div className="divide-y divide-white/[0.06]">
                    {recent.map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0"><div className="truncate text-sm font-semibold text-[var(--cream)]">{m.courseName}</div><div className="text-xs text-[var(--sage-dim)]">{fmtDate(m.date)}{m.holesPlayed ? ` · ${m.holesPlayed} holes` : ""}</div></div>
                        {m.scoreToPar != null && <span className="font-[family-name:var(--font-heading)] text-lg font-extrabold" style={{ color: scoreColor(m.scoreToPar) }}>{fmt(m.scoreToPar)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Achievements */}
              <div className={`${card} p-5`}>
                <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Achievements</div>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {badges.map((b) => (
                    <div key={b.label} className={`flex flex-col items-center gap-1 rounded-xl p-3 text-center ${b.on ? "bg-[var(--gold-dim)]" : "bg-white/[0.02] opacity-40"}`}>
                      <span className="text-2xl" style={{ filter: b.on ? "none" : "grayscale(1)" }}>{b.icon}</span>
                      <span className="text-[10px] font-semibold leading-tight text-[var(--text-body)]">{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>

        {/* ===== STICKY SIDEBAR ===== */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className={`${card} p-5`}>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Player insights</div>
            <dl className="space-y-2.5 text-sm">
              <Row k="Avg score" v={avgScore != null ? fmt(avgScore) : "—"} />
              <Row k="Best round" v={best != null ? fmt(best) : "—"} c={best != null ? scoreColor(best) : undefined} />
              <Row k="Holes played" v={totalHoles || "—"} />
              <Row k="Rounds this year" v={thisYear || "—"} />
              {mostPlayed && <Row k="Home turf" v={mostPlayed[0]} small />}
            </dl>
          </div>

          {data && data.topDiscs.length > 0 && (
            <div className={`${card} p-5`}>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Go-to discs</div>
              <div className="flex flex-wrap gap-2">
                {data.topDiscs.slice(0, 10).map((d) => (
                  <span key={d.name} className="rounded-full bg-white/[0.05] px-3 py-1.5 text-sm font-medium text-[var(--text-body)]">{d.name} <span className="text-[var(--sage-dim)]">{d.count}</span></span>
                ))}
              </div>
            </div>
          )}

          {!viewer && (
            <div className="rounded-2xl bg-[var(--bg-mid)] p-5 text-center">
              <div className="font-[family-name:var(--font-heading)] text-lg font-bold">Build your own profile</div>
              <p className="mt-1 text-sm text-[var(--text-body)]">Track rounds, climb the ranks & show off your game.</p>
              <Link href="/login" className="mt-3 block rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b] hover:bg-[var(--gold-bright)]">Join free</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function HeroStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none" style={color ? { color } : undefined}>{value}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{label}</div></div>;
}
function Row({ k, v, c, small }: { k: string; v: string | number; c?: string; small?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><dt className="shrink-0 text-[var(--sage-dim)]">{k}</dt><dd className={`min-w-0 truncate text-right font-bold ${small ? "text-xs" : ""}`} style={c ? { color: c } : undefined}>{v}</dd></div>;
}
