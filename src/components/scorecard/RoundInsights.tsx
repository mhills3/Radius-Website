"use client";

import { useMemo, useState } from "react";
import { type DecodedRound } from "@/lib/rounds";
import { rankForIQ, rankLabel, rankProgress } from "@/lib/rank";
import { flightMapImageUrl } from "@/lib/flightMap";
import LevelBadge from "@/components/scorecard/LevelBadge";

// ---- palette (matches app Theme) ----
const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-heading)" } as const;
const ft = (n: number) => `${Math.round(n)} ft`;
const relBadge = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
const relColor = (n: number) => (n < 0 ? "#7fd39a" : n > 0 ? "#eb9166" : "var(--cream)");

const isTrouble = (r: string) => r === "OB" || r === "Miss Left" || r === "Miss Right";
const realThrows = (h: DecodedRound["holes"][number]) => h.throws.filter((t) => t.discName !== "Score" && t.discName !== "Throw");

// ---------- section shell ----------

function Disclosure({ icon, title, defaultOpen, children }: { icon: React.ReactNode; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-white/[0.07]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 py-[15px] text-left">
        <span className="grid h-[18px] w-[18px] shrink-0 place-items-center text-[var(--gold)]">{icon}</span>
        <span className={`${HEAD} flex-1 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--cream)]`}>{title}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3 w-3 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && <div className="pb-3.5">{children}</div>}
    </div>
  );
}

const ic = {
  gauge: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M12 13l4-4M4 18a8 8 0 1 1 16 0" strokeLinecap="round" /></svg>,
  map: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" strokeLinejoin="round" /></svg>,
  trend: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  tee: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  spark: <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z" /></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>,
  cloud: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><circle cx="8" cy="8" r="3" /><path d="M7 18h9a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.3A3.5 3.5 0 0 0 7 18z" strokeLinejoin="round" /></svg>,
};

export default function RoundInsights({ round, history }: { round: DecodedRound; history?: DecodedRound[] }) {
  const played = useMemo(() => round.holes.filter((h) => h.played), [round]);
  const all = useMemo(() => played.flatMap((h) => realThrows(h).map((t) => ({ t, hole: h }))), [played]);

  // ---- tallies ----
  const tally = useMemo(() => {
    const ob = all.filter((x) => x.t.result === "OB").length;
    const putts = all.filter((x) => x.t.distanceToBasket != null && x.t.distanceToBasket <= 66).length;
    const drives = played.map((h) => realThrows(h)[0]).filter((t) => t && typeof t.distance === "number" && t.distance! > 0) as DecodedRound["holes"][number]["throws"];
    const avgDrive = drives.length ? drives.reduce((s, t) => s + (t.distance ?? 0), 0) / drives.length : null;
    const longest = all.reduce((m, x) => Math.max(m, x.t.distance ?? 0), 0);
    const leftAfter = played.map((h) => realThrows(h)[1]?.distanceToBasket).filter((v): v is number => typeof v === "number");
    const avgLeft = leftAfter.length ? leftAfter.reduce((s, v) => s + v, 0) / leftAfter.length : null;
    const trouble = played.filter((h) => { const tee = realThrows(h)[0]; return tee && isTrouble(tee.result); });
    const scrambled = trouble.filter((h) => h.score - h.par <= 0).length;
    const ts = all.map((x) => x.t.timestamp).filter((v): v is number => typeof v === "number" && v > 0);
    const minutes = ts.length >= 2 ? Math.round((Math.max(...ts) - Math.min(...ts)) / 60000) : null;
    return { ob, putts, avgDrive, longest, avgLeft, trouble: trouble.length, scrambled, minutes };
  }, [all, played]);

  const courseHist = useMemo(() => {
    if (!history) return null;
    const key = round.courseName.trim().toLowerCase();
    const others = history.filter((r) => r.roundId !== round.roundId && r.isComplete && r.holesPlayed > 0 && r.courseName.trim().toLowerCase() === key);
    if (others.length < 2) return null;
    return { avg: others.reduce((s, r) => s + r.relativeToPar, 0) / others.length, count: others.length };
  }, [history, round]);

  const costliest = useMemo(() => {
    const worst = [...played].filter((h) => h.score - h.par > 0).sort((a, b) => (b.score - b.par) - (a.score - a.par))[0];
    if (!worst) return null;
    const tr = realThrows(worst);
    const reason = tr.some((t) => t.result === "OB") ? "an OB drop cost you here" : tr.filter((t) => t.distanceToBasket != null && t.distanceToBasket <= 66).length >= 3 ? "putting let it slip" : "a tough hole";
    return { hole: worst.holeNumber, rel: worst.score - worst.par, par: worst.par, score: worst.score, reason };
  }, [played]);

  const story = useMemo(() => {
    const rel = round.relativeToPar, b = played.filter((h) => h.score - h.par < 0).length;
    const parts: string[] = [];
    parts.push(`You went ${rel === 0 ? "even par" : rel < 0 ? `${Math.abs(rel)} under` : `${rel} over`} across ${played.length} holes${b ? ` with ${b} birdie${b === 1 ? "" : "s"}` : ""}${tally.minutes ? ` in ${tally.minutes} minutes` : ""}.`);
    if (courseHist) { const d = rel - courseHist.avg; parts.push(d < -0.5 ? `That's ${Math.abs(d).toFixed(1)} better than your average here.` : d > 0.5 ? `That's ${d.toFixed(1)} off your average here.` : "Right on your usual number for this course."); }
    if (tally.avgDrive) parts.push(`Your drives averaged ${Math.round(tally.avgDrive)} feet.`);
    if (tally.trouble) parts.push(tally.scrambled === tally.trouble ? `You saved par from trouble every time (${tally.scrambled}/${tally.trouble}).` : `You scrambled ${tally.scrambled} of ${tally.trouble} trouble holes.`);
    if (tally.ob) parts.push(`${tally.ob} throw${tally.ob === 1 ? "" : "s"} went OB.`);
    return parts.join(" ");
  }, [round, played, tally, courseHist]);

  const teeLedger = useMemo(() => played.filter((h) => h.score > 0).map((h) => ({ hole: h.holeNumber, disc: realThrows(h)[0]?.discName, rel: h.score - h.par })).filter((r) => r.disc), [played]);

  const highlights = useMemo(() => {
    const out: { icon: "bolt" | "scope" | "star"; title: string; sub: string }[] = [];
    const lng = all.filter((x) => (x.t.distance ?? 0) >= 60).sort((a, b) => (b.t.distance ?? 0) - (a.t.distance ?? 0))[0];
    if (lng) out.push({ icon: "bolt", title: `Longest throw ${ft(lng.t.distance!)}`, sub: `Hole ${lng.hole.holeNumber}${lng.t.discName ? ` · ${lng.t.discName}` : ""}` });
    const mk = all.filter((x) => x.t.madeIt && (x.t.distanceToBasket ?? 0) >= 15).sort((a, b) => (b.t.distanceToBasket ?? 0) - (a.t.distanceToBasket ?? 0))[0];
    if (mk) out.push({ icon: "scope", title: `Longest make ${ft(mk.t.distanceToBasket!)}`, sub: `Hole ${mk.hole.holeNumber}${mk.t.discName ? ` · ${mk.t.discName}` : ""}` });
    const best = [...played].filter((h) => h.score - h.par < 0).sort((a, b) => (a.score - a.par) - (b.score - b.par))[0];
    if (best) { const d = best.score - best.par; const name = d <= -3 ? "Albatross" : d === -2 ? "Eagle" : "Birdie"; out.push({ icon: "star", title: `Best hole: ${name} on ${best.holeNumber}`, sub: `${best.score} on a par ${best.par}` }); }
    return out.slice(0, 3);
  }, [all, played]);

  const puttMiss = useMemo(() => {
    const misses = all.map((x) => x.t).filter((t) => t.missZone || (t.missX != null && t.missY != null));
    if (!misses.length) return null;
    const grid = Array.from({ length: 9 }, () => 0);
    for (const t of misses) {
      let idx: number;
      if (t.missX != null && t.missY != null) idx = Math.min(2, Math.floor(t.missY * 3)) * 3 + Math.min(2, Math.floor(t.missX * 3));
      else { const [row, col] = (t.missZone ?? "mid-center").split("-"); const ri = row === "high" ? 0 : row === "low" ? 2 : 1; const ci = col === "left" ? 0 : col === "right" ? 2 : 1; idx = ri * 3 + ci; }
      grid[idx]++;
    }
    return { grid, total: misses.length };
  }, [all]);

  const hasIQ = typeof round.iqBefore === "number" && typeof round.iqAfter === "number";
  const cond = [round.weatherSummary, round.temperatureSummary, round.windSummary].filter(Boolean) as string[];
  const gps = all.some((x) => x.t.lat != null && x.t.lng != null);

  return (
    <div className="space-y-5">
      {/* ===== TOP: IQ promotion card (only when the round carries a Game IQ change) ===== */}
      {hasIQ && <RankHero before={round.iqBefore!} after={round.iqAfter!} />}

      {/* ===== What cost you ===== */}
      {costliest && (
        <div className="rounded-2xl border border-[#cc5750]/25 bg-[#cc5750]/[0.06] p-4">
          <div className={`${HEAD} text-[10px] font-black uppercase tracking-[0.14em] text-[#eb9166]`}>What cost you</div>
          <div className="mt-1.5 text-[15px] text-[var(--cream)]"><span className="font-bold">+{costliest.rel} on hole {costliest.hole}</span> — {costliest.reason}. <span className="text-white/50">{costliest.score} on a par {costliest.par}.</span></div>
        </div>
      )}

      {/* ===== collapsibles ===== */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4">
        <Disclosure icon={ic.gauge} title="How it went" defaultOpen>
          <p className="font-[family-name:var(--font-body)] text-[14px] leading-relaxed text-[var(--cream)]/90">{story}</p>
          {(() => {
            const items = [
              tally.minutes != null ? { v: `${tally.minutes}`, l: "Minutes" } : null,
              tally.avgLeft != null ? { v: `${Math.round(tally.avgLeft)}`, l: "Ft left after drive" } : null,
              tally.longest > 0 ? { v: `${Math.round(tally.longest)}`, l: "Longest ft" } : null,
              tally.putts > 0 ? { v: `${tally.putts}`, l: "Putts" } : null,
              tally.ob > 0 ? { v: `${tally.ob}`, l: "OB", red: true } : null,
              tally.trouble > 0 ? { v: `${tally.scrambled}/${tally.trouble}`, l: "Scramble", green: true } : null,
            ].filter(Boolean) as { v: string; l: string; red?: boolean; green?: boolean }[];
            if (!items.length) return null; // no shot data → no empty stat strip (was leaving a gap)
            return (
              <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-4 border-t border-white/[0.07] pt-4">
                {items.map((t, i) => (
                  <div key={i}><div className={`${HEAD} text-[19px] font-bold leading-none`} style={{ ...MONO, color: t.red ? "#eb9166" : t.green ? "#7fd39a" : "var(--cream)" }}>{t.v}</div><div className="mt-1.5 text-[7px] font-bold uppercase tracking-[0.1em] text-white/40">{t.l}</div></div>
                ))}
              </div>
            );
          })()}
        </Disclosure>

        {gps && (
          <Disclosure icon={ic.map} title="Flight map">
            <FlightMap round={round} />
          </Disclosure>
        )}

        {courseHist && (
          <Disclosure icon={ic.trend} title="Vs your course">
            {(() => { const d = round.relativeToPar - courseHist.avg; const better = d < -0.5, worse = d > 0.5; return (
              <div className="flex items-center gap-3">
                <svg viewBox="0 0 24 24" fill="none" stroke={better ? "#7fd39a" : worse ? "#eb9166" : "var(--gold)"} strokeWidth="2" className="h-6 w-6 shrink-0"><circle cx="12" cy="12" r="9" />{better ? <path d="M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /> : worse ? <path d="M8 14l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M8 12h8" strokeLinecap="round" />}</svg>
                <div>
                  <div className="text-[14px] font-bold text-[var(--cream)]">{better ? `${Math.abs(d).toFixed(1)} strokes better than your average here.` : worse ? `${d.toFixed(1)} strokes off your average here.` : "Right on your usual number here."}</div>
                  <div className="mt-0.5 text-[11px] text-white/50">Across {courseHist.count} previous rounds at this course.</div>
                </div>
              </div>
            ); })()}
          </Disclosure>
        )}

        {teeLedger.length > 0 && (
          <Disclosure icon={ic.tee} title="Off the tee">
            <div className="space-y-2">{teeLedger.map((r) => (
              <div key={r.hole} className="flex items-center gap-3">
                <span className={`${HEAD} w-5 shrink-0 text-[11px] font-black text-white/40`} style={MONO}>{r.hole}</span>
                <span className={`${HEAD} flex-1 truncate text-[12px] font-bold text-[var(--cream)]`}>{r.disc}</span>
                <span className={`${HEAD} shrink-0 text-[12px] font-black`} style={{ color: relColor(r.rel) }}>{relBadge(r.rel)}</span>
              </div>
            ))}</div>
          </Disclosure>
        )}

        {highlights.length > 0 && (
          <Disclosure icon={ic.spark} title="Highlights">
            <div className="space-y-3">{highlights.map((h, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--gold)]/12 text-[var(--gold)]">
                  {h.icon === "bolt" ? <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg> : h.icon === "scope" ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2l2.9 6.3L22 9l-5 4.7L18.2 21 12 17.3 5.8 21 7 13.7 2 9l7.1-.7z" /></svg>}
                </span>
                <div className="min-w-0"><div className={`${HEAD} text-[13px] font-bold text-[var(--cream)]`}>{h.title}</div><div className="text-[11px] font-semibold text-white/50">{h.sub}</div></div>
              </div>
            ))}</div>
          </Disclosure>
        )}

        {puttMiss && (
          <Disclosure icon={ic.target} title="Putt miss map">
            <div className="mx-auto grid w-[180px] grid-cols-3 gap-1">
              {puttMiss.grid.map((n, i) => { const share = puttMiss.total ? n / puttMiss.total : 0; return (
                <div key={i} className="grid aspect-square place-items-center rounded-md" style={{ background: n ? `rgba(204,87,80,${0.15 + share * 0.6})` : "rgba(255,255,255,0.03)" }}>
                  {n > 0 && <div className="text-center"><div className={`${HEAD} text-[15px] font-bold text-[var(--cream)]`} style={MONO}>{n}</div><div className="text-[9px] text-white/50" style={MONO}>{Math.round(share * 100)}%</div></div>}
                </div>
              ); })}
            </div>
            <div className="mt-2.5 text-center text-[11px] text-white/40">{puttMiss.total} tapped miss{puttMiss.total === 1 ? "" : "es"} this round</div>
          </Disclosure>
        )}

        {cond.length > 0 && (
          <Disclosure icon={ic.cloud} title="Conditions">
            <div className="grid grid-cols-3 gap-3">
              {round.weatherSummary && <Cell label="Skies" value={round.weatherSummary} tint="var(--gold)" />}
              {round.temperatureSummary && <Cell label="Temp" value={round.temperatureSummary} tint="#e6a06a" />}
              {round.windSummary && <Cell label="Wind" value={round.windSummary} tint="#a8b391" />}
            </div>
          </Disclosure>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="text-center">
      <div className={`${HEAD} text-[13px] font-bold text-[var(--cream)]`} style={{ ...MONO }}>{value}</div>
      <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.1em] text-white/42" style={{ color: tint }}>{label}</div>
    </div>
  );
}

// ---- RankProgressionHero ----
function RankHero({ before, after }: { before: number; after: number }) {
  const rb = rankForIQ(before), ra = rankForIQ(after);
  const delta = before <= 0 ? 0 : after - before;
  const promo = ra.level > rb.level, demo = ra.level < rb.level;
  const label = promo ? "Promotion" : demo ? "Division down" : "Division held";
  const labelColor = promo ? "#5cd98d" : demo ? "#f26b6b" : "rgba(255,255,255,0.5)";
  const prog = rankProgress(after, ra);
  const remaining = ra.nextIQ != null ? Math.max(0, ra.nextIQ - after) : 0;
  const nextRankName = ra.nextIQ != null ? rankLabel(rankForIQ(ra.nextIQ)) : null;
  return (
    <div className="flex items-start gap-4 rounded-2xl border p-4" style={{ borderColor: `${ra.color}55`, background: "rgba(255,255,255,0.03)" }}>
      <LevelBadge iq={after} size={78} />
      <div className="min-w-0 flex-1">
        <div className={`${HEAD} text-[11px] font-black uppercase tracking-[0.16em]`} style={{ color: labelColor }}>{label}</div>
        <div className={`${HEAD} mt-0.5 text-[24px] font-black text-[var(--cream)]`}>{rankLabel(ra).replace(" · ", " ")}</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[13px] font-bold text-white/60" style={MONO}>{after} IQ</span>
          {delta !== 0 && <span className={`${HEAD} rounded-full px-1.5 py-0.5 text-[11px] font-black`} style={{ background: delta > 0 ? "rgba(95,184,122,0.18)" : "rgba(224,71,63,0.18)", color: delta > 0 ? "#7fd39a" : "#f08c8c" }}>{delta > 0 ? "+" : ""}{delta}</span>}
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.12]"><div className="h-full rounded-full" style={{ width: `${prog * 100}%`, background: prog > 0.85 ? "linear-gradient(90deg,#e0a23f,var(--gold))" : `linear-gradient(90deg,${ra.color},var(--gold))` }} /></div>
        <div className="mt-1.5 text-[10px] font-semibold text-white/50">{ra.nextIQ == null ? "Max rank" : nextRankName ? `${remaining} IQ to ${nextRankName}` : "Threshold reached"}</div>
      </div>
    </div>
  );
}

// ---- Flight map: Mapbox satellite tile with each hole's flight path in gold ----
function FlightMap({ round }: { round: DecodedRound }) {
  const url = flightMapImageUrl(round, 640, 380);
  if (!url) return <p className="text-[12px] text-white/40">Not enough GPS-tracked shots to map.</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#141d16]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Flight map" className="block h-auto w-full" />
      <div className="px-3 py-2 text-[10px] text-white/40">Your shots this round · tee → basket</div>
    </div>
  );
}
