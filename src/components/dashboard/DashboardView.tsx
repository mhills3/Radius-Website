"use client";

import { useState, useMemo } from "react";
import { type Dashboard } from "@/lib/account";
import { rankForIQ, rankLabel, rankProgress } from "@/lib/rank";
import { IqRing, AreaChart, BarList, CountUp } from "@/components/dashboard/charts";
import LevelBadge from "@/components/rank/LevelBadge";
import RankLibrary from "@/components/rank/RankLibrary";
import Scorecard from "@/components/dashboard/Scorecard";
import RoundsHeatmap from "@/components/dashboard/RoundsHeatmap";
import { getDecodedRounds, type DecodedRound } from "@/lib/rounds";
import ProfileBar from "@/components/profile/ProfileBar";
import RecapCard from "@/components/dashboard/RecapCard";
import { useMetricPref } from "@/lib/useMetricPref";
import { fmtDist } from "@/lib/units";

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "");
const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
// Avg score matches the iOS app exactly: one decimal, "+" prefix when over par ("+2.3", "0.0", "-1.5").
const fmtAvg = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
const scoreColor = (n: number) => (n < 0 ? "text-[#5fcf80]" : n === 0 ? "text-[var(--cream)]" : "text-[#f08c8c]");
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const card = "rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6";

function PR({ icon, label, value, accent = false }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 ${accent ? "border-[var(--gold)]/30 bg-[var(--gold)]/10" : "border-white/[0.07] bg-white/[0.02]"}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-lg">{icon}</span>
      <div className="min-w-0">
        <div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none text-[var(--cream)]">{value}</div>
        <div className="mt-1 text-xs text-[var(--sage-dim)]">{label}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs font-medium text-[var(--sage-dim)]">{label}</div>
      <div className="mt-0.5 font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-tight text-[var(--cream)]">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
    </div>
  );
}

export default function DashboardView({ data, uid }: { data: Dashboard; uid: string }) {
  const { profile, iqCurrent, iqHistory, rounds, topDiscs, bag, roundMetas, acesCount } = data;
  const [decoded, setDecoded] = useState<DecodedRound[] | null>(null);
  const [openRound, setOpenRound] = useState<DecodedRound | null>(null);
  const metric = useMetricPref();
  const [loadingRound, setLoadingRound] = useState<string | null>(null);
  const [showRanks, setShowRanks] = useState(false);
  const [roundSort, setRoundSort] = useState<"recent" | "az">("recent");
  // full round list (roundMetas now carries roundId) — falls back to the capped recentRounds if no decoded backup
  const allRounds = useMemo(() => {
    const full = roundMetas.filter((m) => m.roundId).map((m) => ({ roundId: m.roundId as string, courseName: m.courseName, date: m.date, scoreToPar: m.scoreToPar, holesPlayed: m.holesPlayed }));
    return full.length ? full : rounds;
  }, [roundMetas, rounds]);
  const sortedRounds = useMemo(() => [...allRounds].sort((a, b) => (roundSort === "az" ? (a.courseName || "").localeCompare(b.courseName || "") : b.date - a.date)), [allRounds, roundSort]);

  const openScorecard = async (roundId: string, courseName: string, date: number) => {
    setLoadingRound(roundId);
    try {
      let list = decoded;
      if (!list) {
        list = await getDecodedRounds(uid);
        setDecoded(list);
      }
      const match =
        list.find((r) => r.roundId === roundId) ||
        list.find((r) => r.courseName === courseName && Math.abs(r.date - date) < 86400000) ||
        list.find((r) => r.courseName === courseName);
      if (match) setOpenRound({ ...match, date: date || match.date });
    } finally {
      setLoadingRound(null);
    }
  };
  const rank = rankForIQ(iqCurrent);
  const progress = rankProgress(iqCurrent, rank);
  const toNext = rank.nextIQ != null ? Math.max(0, rank.nextIQ - iqCurrent) : 0;
  const iqValues = iqHistory.map((p) => p.iq);
  const iqDelta = iqValues.length >= 2 ? iqValues[iqValues.length - 1] - iqValues[0] : 0;

  // Avg/best from the FULL history (roundMetas), not the capped recent list — otherwise the all-time best is wrong.
  const scored = roundMetas.filter((m) => m.scoreToPar != null) as { scoreToPar: number }[];
  const avgScore = scored.length ? scored.reduce((s, r) => s + r.scoreToPar, 0) / scored.length : null;
  const bestScore = scored.length ? Math.min(...scored.map((r) => r.scoreToPar)) : null;
  // Scoring trend = 5 most recent rounds (roundMetas is date-desc), oldest→newest for the chart.
  const scoreSeries = roundMetas.filter((m) => m.scoreToPar != null).slice(0, 5).reverse().map((m) => m.scoreToPar as number);

  const topIQ = iqValues.length ? Math.max(...iqValues) : iqCurrent;
  const now = new Date();
  const thisYear = now.getFullYear();
  const roundsThisYear = roundMetas.filter((m) => new Date(m.date).getFullYear() === thisYear).length;

  // Course stats: count + best (lowest) relative-to-par.
  const courseStats = new Map<string, { count: number; best: number | null }>();
  for (const m of roundMetas) {
    const s = courseStats.get(m.courseName) ?? { count: 0, best: null };
    s.count++;
    if (m.scoreToPar != null && (s.best == null || m.scoreToPar < s.best)) s.best = m.scoreToPar;
    courseStats.set(m.courseName, s);
  }
  const topCourses = [...courseStats.entries()].map(([name, s]) => ({ name, ...s })).sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCourse = topCourses[0]?.count ?? 1;

  // Week streak (consecutive weeks with a round, grace for current week).
  const WEEK = 7 * 86400000;
  const weekKey = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d.getTime();
  };
  const weeks = new Set(roundMetas.map((m) => weekKey(m.date)));
  let streak = 0;
  let w = weekKey(now.getTime());
  if (!weeks.has(w)) w -= WEEK; // grace: count from last week if none yet this week
  while (weeks.has(w)) { streak++; w -= WEEK; }

  // This month vs last.
  const inMonth = (ms: number, mo: number, yr: number) => { const d = new Date(ms); return d.getMonth() === mo && d.getFullYear() === yr; };
  const cntThis = roundMetas.filter((m) => inMonth(m.date, now.getMonth(), thisYear)).length;
  const lastMo = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastMoYr = now.getMonth() === 0 ? thisYear - 1 : thisYear;
  const cntLast = roundMetas.filter((m) => inMonth(m.date, lastMo, lastMoYr)).length;
  const monthDelta = cntThis - cntLast;

  // Achievement badges.
  const distinctCourses = new Set(roundMetas.map((m) => m.courseName)).size;
  const subPar = roundMetas.some((m) => m.scoreToPar != null && m.scoreToPar < 0);
  const totalRounds = profile.roundsPlayed ?? roundMetas.length;
  const longestDrive = profile.maxDistance ?? 0;
  const badges = [
    { icon: "🎯", name: "First Ace", desc: acesCount > 0 ? `${acesCount} logged` : "Hole in one", got: acesCount > 0 },
    { icon: "🔥", name: "Sub-Par Round", desc: "Finish under par", got: subPar },
    { icon: "💎", name: "Pro Tier", desc: "Reach Pro rank", got: iqCurrent >= 75 },
    { icon: "💥", name: "Big Arm", desc: longestDrive >= 400 ? "400 ft drive" : `${Math.round(longestDrive)}/400 ft`, got: longestDrive >= 400 },
    { icon: "🗺️", name: "Explorer", desc: distinctCourses >= 5 ? "5+ courses" : `${distinctCourses}/5 courses`, got: distinctCourses >= 5 },
    { icon: "🏅", name: "50 Rounds", desc: totalRounds >= 50 ? "50 logged" : `${totalRounds}/50`, got: totalRounds >= 50 },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* cover + identity */}
      <div className="relative">
        <div className="relative h-36 w-full overflow-hidden md:h-48">
          {profile.coverPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(246,193,101,0.25),var(--bg-deep))]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--bg-deep)] to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            {/* left: avatar + identity */}
            <div className="-mt-14">
              <div className="h-28 w-28 shrink-0 overflow-hidden rounded-3xl border-4 border-[var(--bg-deep)] bg-[var(--bg-mid)] shadow-xl">
                {profile.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profileImageUrl} alt={profile.name} className="h-full w-full object-cover object-center" />
                ) : (
                  <div className="grid h-full w-full place-items-center font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--cream)]">{(profile.name || "?").charAt(0)}</div>
                )}
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2.5">
                  <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em] text-[var(--cream)]">{profile.name || "Player"}</h1>
                  {profile.proOverride && <span className="rounded-full bg-[var(--gold)] px-2.5 py-0.5 text-[11px] font-bold text-[#16221b]">PRO</span>}
                </div>
                {profile.username && <p className="mt-1.5 text-sm text-[var(--text-body)]">@{profile.username}</p>}
              </div>
            </div>
            {/* right: minimal profile toggle + weekly recap inline lines */}
            <div className="flex flex-col gap-1.5 pb-1.5 sm:items-end">
              <ProfileBar uid={uid} username={profile.username} />
              <RecapCard data={data} />
            </div>
          </div>
        </div>
      </div>

      {/* bento */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Game IQ hero */}
          <div className={`fade-up relative overflow-hidden lg:col-span-2 ${card}`}>
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.15),transparent_70%)]" />
            <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
              <IqRing iq={iqCurrent} progress={progress} label={rankLabel(rank)} color={rank.color} color2={rank.secondary} />
              <div className="min-w-0 flex-1">
                <button onClick={() => setShowRanks(true)} className="group mb-4 flex items-center gap-3 rounded-2xl p-1.5 -m-1.5 text-left transition-colors hover:bg-white/[0.04]">
                  <LevelBadge rank={rank} size={56} />
                  <div>
                    <div className="font-[family-name:var(--font-heading)] text-lg font-bold leading-tight" style={{ color: rank.color }}>{rankLabel(rank)}</div>
                    <div className="text-xs text-[var(--sage-dim)] group-hover:text-[var(--sage)]">Rank {rank.level} of 30 · view tiers</div>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">IQ history</span>
                  {iqDelta !== 0 && (
                    <span className={`text-xs font-bold ${iqDelta > 0 ? "text-[#5fcf80]" : "text-[#f08c8c]"}`}>{iqDelta > 0 ? "▲" : "▼"} {Math.abs(iqDelta)}</span>
                  )}
                </div>
                <AreaChart values={iqValues} stroke={rank.color} />
                <p className="mt-3 text-sm text-[var(--text-body)]">
                  {rank.nextIQ != null ? (
                    <>
                      <span className="font-bold text-[var(--cream)]">{toNext}</span> IQ to <span className="font-semibold text-[var(--gold)]">{rankLabel(rankForIQ(rank.nextIQ))}</span>
                    </>
                  ) : (
                    "Top rank reached — MPO."
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className={`fade-up ${card}`} style={{ animationDelay: "60ms" }}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Stat label="Rounds" value={profile.roundsPlayed ?? rounds.length} />
              <Stat label="Avg score" value={avgScore != null ? fmtAvg(avgScore) : "—"} />
              <Stat label="Best round" value={bestScore != null ? fmtScore(bestScore) : "—"} />
              <Stat label="Max distance" value={profile.maxDistance ? fmtDist(profile.maxDistance, metric) : "—"} />
              <Stat label="Followers" value={profile.followerCount ?? 0} />
              <Stat label="Following" value={profile.followingCount ?? 0} />
            </div>
          </div>

          {/* Highlights / personal records */}
          <div className={`fade-up lg:col-span-3 ${card}`} style={{ animationDelay: "80ms" }}>
            <div className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Highlights</div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <PR icon="🏆" label="Best round" value={bestScore != null ? fmtScore(bestScore) : "—"} accent />
              <PR icon="🚀" label="Longest drive" value={profile.maxDistance ? fmtDist(profile.maxDistance, metric) : "—"} />
              <PR icon="🧠" label="Top Game IQ" value={topIQ ? String(topIQ) : "—"} />
              <PR icon="⛳" label="Total rounds" value={String(profile.roundsPlayed ?? roundMetas.length)} />
            </div>
          </div>

          {/* Rounds heatmap */}
          <div className={`fade-up ${card}`} style={{ animationDelay: "140ms" }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Your rounds</span>
              <span className="text-sm text-[var(--text-body)]"><span className="font-bold text-[var(--cream)]">{roundsThisYear}</span> this year</span>
            </div>
            <p className="mb-4 text-sm text-[var(--text-body)]">Every round you&apos;ve logged, last 6 months.</p>
            {roundMetas.length ? <RoundsHeatmap dates={roundMetas.map((m) => m.date)} /> : <p className="text-sm text-[var(--sage-dim)]">No rounds yet.</p>}
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.06] pt-4 text-sm">
              <div><span className="text-[var(--sage-dim)]">Streak </span><span className="font-bold text-[var(--cream)]">{streak} wk{streak === 1 ? "" : "s"}</span>{streak >= 2 && <span> 🔥</span>}</div>
              <div>
                <span className="text-[var(--sage-dim)]">This month </span>
                <span className="font-bold text-[var(--cream)]">{cntThis}</span>
                {(cntThis > 0 || cntLast > 0) && <span className={`ml-1.5 text-xs font-semibold ${monthDelta >= 0 ? "text-[#5fcf80]" : "text-[#f08c8c]"}`}>{monthDelta >= 0 ? `▲ ${monthDelta}` : `▼ ${Math.abs(monthDelta)}`} vs last</span>}
              </div>
            </div>
          </div>

          {/* Top courses */}
          <div className={`fade-up lg:col-span-2 ${card}`} style={{ animationDelay: "200ms" }}>
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Top courses</div>
            {topCourses.length === 0 ? (
              <p className="text-sm text-[var(--sage-dim)]">No rounds yet.</p>
            ) : (
              <div className="space-y-3">
                {topCourses.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 sm:w-52">
                      <div className="truncate text-sm text-[var(--text-body)]" title={c.name}>{c.name}</div>
                      {c.best != null && <div className="text-[11px] font-semibold" style={{ color: c.best < 0 ? "#5fcf80" : c.best === 0 ? "var(--sage)" : "#f08c8c" }}>best {fmtScore(c.best)}</div>}
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full origin-left rounded-full bg-gradient-to-r from-[#d4a04a] to-[#f8cf80] animate-[growX_0.9s_cubic-bezier(0.22,1,0.36,1)_both]" style={{ width: `${Math.max(8, (c.count / maxCourse) * 100)}%` }} />
                    </div>
                    <span className="w-5 shrink-0 text-right text-sm font-bold text-[var(--cream)]">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Achievements */}
          <div className={`fade-up lg:col-span-3 ${card}`} style={{ animationDelay: "220ms" }}>
            <div className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Achievements</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {badges.map((b) => (
                <div key={b.name} className={`flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center ${b.got ? "border-[var(--gold)]/30 bg-[var(--gold)]/[0.08]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                  <span className={`text-3xl ${b.got ? "" : "opacity-30 grayscale"}`}>{b.icon}</span>
                  <span className={`text-sm font-bold ${b.got ? "text-[var(--cream)]" : "text-[var(--sage-dim)]"}`}>{b.name}</span>
                  <span className="text-[11px] text-[var(--sage-dim)]">{b.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Player profile */}
          <div className={`fade-up ${card}`} style={{ animationDelay: "120ms" }}>
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">About</div>
            {profile.bio && <p className="mb-5 text-sm leading-relaxed text-[var(--text-body)]">{profile.bio}</p>}
            <div className="space-y-2.5">
              {([
                ["Throwing style", cap(profile.throwingStyle)],
                ["Arm speed", cap(profile.armSpeed)],
                ["Hand", profile.throwingHand ? cap(profile.throwingHand) : ""],
                ["Home course", profile.homeCourseName || ""],
              ] as [string, string][])
                .filter(([, v]) => v)
                .map(([label, v]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2.5 last:border-0 last:pb-0">
                    <span className="text-sm text-[var(--sage-dim)]">{label}</span>
                    <span className="truncate text-sm font-semibold text-[var(--cream)]">{v}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Go-to discs */}
          <div className={`fade-up lg:col-span-2 ${card}`} style={{ animationDelay: "180ms" }}>
            <div className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Your go-to discs</div>
            {topDiscs.length ? <BarList items={topDiscs.map((d) => ({ label: d.name, value: d.count }))} /> : <p className="text-sm text-[var(--sage-dim)]">No throw data yet.</p>}
          </div>

          {/* Scoring trend */}
          <div className={`fade-up ${card}`} style={{ animationDelay: "200ms" }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Scoring trend</span>
              {avgScore != null && <span className={`text-sm font-bold ${scoreColor(avgScore)}`}>{fmtAvg(avgScore)} avg</span>}
            </div>
            <AreaChart values={scoreSeries} stroke="#5fcf80" />
            <p className="mt-3 text-sm text-[var(--text-body)]">Relative to par, last {scoreSeries.length} rounds.</p>
          </div>

          {/* Bag — fills the space beside Scoring trend */}
          <div className={`fade-up lg:col-span-2 ${card}`} style={{ animationDelay: "220ms" }}>
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Your bag</span>
              {bag.length > 0 && <span className="text-sm text-[var(--sage-dim)]">{bag.length} discs</span>}
            </div>
            {bag.length === 0 ? (
              <p className="text-sm text-[var(--sage-dim)]">No discs yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {bag.map((d, i) => (
                  <span key={`${d.name}-${i}`} className={`rounded-full px-2.5 py-1 text-xs ${d.hot ? "bg-[var(--gold-dim)] font-semibold text-[var(--gold)] ring-1 ring-[var(--gold)]/30" : "bg-white/[0.05] text-[var(--text-body)]"}`}>{d.name}</span>
                ))}
              </div>
            )}
            {topDiscs.length > 0 && <p className="mt-3 text-xs text-[var(--sage-dim)]">Amber = your most-thrown.</p>}
          </div>

          {/* Recent rounds */}
          <div className={`fade-up lg:col-span-3 ${card} !p-0`} style={{ animationDelay: "240ms" }}>
            <div className="flex items-center justify-between px-6 pt-6">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Rounds <span className="text-[var(--sage)]">· {allRounds.length}</span></span>
              <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-xs">
                <button onClick={() => setRoundSort("recent")} className={`rounded-full px-3 py-1 font-semibold transition-colors ${roundSort === "recent" ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>Recent</button>
                <button onClick={() => setRoundSort("az")} className={`rounded-full px-3 py-1 font-semibold transition-colors ${roundSort === "az" ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>A–Z</button>
              </div>
            </div>
            <div className="mt-3 max-h-[460px] overflow-y-auto">
              {sortedRounds.length === 0 && <p className="px-6 pb-6 text-sm text-[var(--sage-dim)]">No rounds yet.</p>}
              {sortedRounds.map((r) => (
                <button
                  key={r.roundId}
                  onClick={() => openScorecard(r.roundId, r.courseName, r.date)}
                  className="flex w-full items-center justify-between gap-4 border-t border-white/[0.06] px-6 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--cream)]">{r.courseName}</div>
                    <div className="text-sm text-[var(--sage-dim)]">{fmtDate(r.date)}{r.holesPlayed ? ` · ${r.holesPlayed} holes` : ""}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.scoreToPar != null && <span className={`font-[family-name:var(--font-heading)] text-xl font-bold ${scoreColor(r.scoreToPar)}`}>{fmtScore(r.scoreToPar)}</span>}
                    {loadingRound === r.roundId ? (
                      <svg className="h-4 w-4 animate-spin text-[var(--sage-dim)]" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : (
                      <svg className="h-4 w-4 text-[var(--sage-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {openRound && <Scorecard round={openRound} onClose={() => setOpenRound(null)} />}
      {showRanks && <RankLibrary currentTier={rank.tier} onClose={() => setShowRanks(false)} />}
    </div>
  );
}
