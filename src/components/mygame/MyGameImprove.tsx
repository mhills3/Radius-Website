"use client";

import { useEffect, useMemo, useState } from "react";
import { getDecodedRounds, computeCareerStats, computeStrokesGained, rankedCategories, type DecodedRound, type StrokesGained, type RankedCategory } from "@/lib/rounds";
import { getPutterDiscNames } from "@/lib/bag";
import { getPracticeSessions, type PuttingSession, type RangeSession } from "@/lib/sessions";
import SessionReview from "@/components/mygame/SessionReview";

// Editorial treatment: hairline rules instead of cards, one hero number, a benchmark scale.
const HEAD = "font-[family-name:var(--font-heading)]";
const BODY = "font-[family-name:var(--font-body)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const INK = "#F4F1E8", GOLD = "#E8B560", EB = "#4A5A48", DIM = "#3E4B3F", SAGE = "#8FA08A", SAGE2 = "#5E6E5C", HAIR = "#17201A";
const eb = `${HEAD} text-[9px] font-black uppercase tracking-[0.22em]`;
const Hair = () => <div style={{ height: 1, background: HAIR }} />;

// --- putting benchmark tiers (iOS puttingBenchmarkSheet) ---
type Tier = { name: string; start: number; end: number };
const C1_TIERS: Tier[] = [{ name: "Beginner", start: 50, end: 65 }, { name: "Intermediate", start: 65, end: 80 }, { name: "Advanced", start: 80, end: 90 }, { name: "Pro", start: 90, end: 100 }];
const C2_TIERS: Tier[] = [{ name: "Beginner", start: 0, end: 5 }, { name: "Intermediate", start: 5, end: 15 }, { name: "Advanced", start: 15, end: 25 }, { name: "Pro", start: 25, end: 40 }];
function standing(pct: number, tiers: Tier[]): { name: string; caption: string } {
  if (pct < tiers[0].start) return { name: "Developing", caption: `${tiers[0].name} putting starts at ${tiers[0].start}%.` };
  for (let i = tiers.length - 1; i >= 0; i--) if (pct >= tiers[i].start) { const nx = tiers[i + 1]; return { name: tiers[i].name, caption: nx ? `${tiers[i].name} range. ${nx.name} starts at ${nx.start}%.` : `${tiers[i].name} range — top of the ladder.` }; }
  return { name: tiers[0].name, caption: "" };
}

// gradient benchmark bar with a needle at the player's position
function StackBar({ label, pct, tiers, gold }: { label: string; pct: number | null; tiers: Tier[]; gold?: boolean }) {
  const has = pct != null;
  const v = has ? pct * 100 : 0;
  const span = tiers[tiers.length - 1].end - tiers[0].start;
  const tick = Math.max(0, Math.min(100, ((v - tiers[0].start) / span) * 100));
  const st = has ? standing(v, tiers) : null;
  return (
    <div className="mb-6">
      <div className="mb-3.5 flex items-baseline"><span className="flex-1 text-[14px] font-semibold" style={{ color: INK }}>{label}</span><span className={`${HEAD} text-[15px] font-bold`} style={{ ...MONO, color: gold ? GOLD : INK }}>{has ? `${Math.round(v)}%` : "—"}</span></div>
      <div className="relative mb-3" style={{ height: 3, background: HAIR }}>
        <div className="absolute left-0 top-0 h-full w-full" style={{ background: "linear-gradient(90deg,#2A362D,#3E4B3F,#5E6E5C,#8FA08A)" }} />
        {has && <div className="absolute" style={{ left: `${tick}%`, top: -5, width: 2, height: 13, background: INK }} />}
      </div>
      <div className={`${BODY} text-[11.5px]`} style={{ color: SAGE2 }}>{st?.caption ?? "Log more putts to place yourself on the scale."}</div>
    </div>
  );
}

// putting "where it falls off" area chart across the distance bands
function Falloff({ points }: { points: { label: string; pct: number | null; gold?: boolean }[] }) {
  const w = 480, h = 112, padX = 14, padTop = 14, padBot = 12;
  const vals = points.map((p) => p.pct);
  const x = (i: number) => padX + (i / (points.length - 1)) * (w - 2 * padX);
  const y = (v: number) => padTop + (1 - v / 100) * (h - padTop - padBot);
  const known = vals.map((v, i) => (v == null ? null : [x(i), y(v)] as const)).filter(Boolean) as [number, number][];
  if (known.length < 2) return null;
  const line = known.map(([px, py]) => `${px},${py}`).join(" ");
  const area = `M${known[0][0]},${known[0][1]} ${known.map(([px, py]) => `L${px},${py}`).join(" ")} L${known[known.length - 1][0]},${h} L${known[0][0]},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 112 }} className="mb-3">
      <defs><linearGradient id="fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity="0.14" /><stop offset="100%" stopColor={GOLD} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#fo)" />
      <path d={`M${line.split(" ").join(" L")}`} fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => p.pct == null ? null : <circle key={i} cx={x(i)} cy={y(p.pct)} r={i === points.length - 1 ? 4 : 3} fill={i === points.length - 1 ? GOLD : "#0C1310"} stroke={GOLD} strokeWidth="1.5" />)}
    </svg>
  );
}

type Focus = { kind: "putting" | "tee" | "approach" | "short"; heroValue: string; heroUnit: string; prose: string; fallLabel: string; falloff: { label: string; pct: number | null; gold?: boolean }[] | null; readout: { value: string; label: string; gold?: boolean }[]; plan: { title: string; sub: string }[] };

function buildFocus(leak: RankedCategory | undefined, sg: StrokesGained, c2Pct: number | null): Focus | null {
  if (!leak) return null;
  const pb = sg.puttBands;
  const bandPct = (i: number) => (pb[i]?.attempts >= 5 ? Math.round((pb[i].made / pb[i].attempts) * 100) : null);
  const c1xAtt = (pb[1]?.attempts ?? 0) + (pb[2]?.attempts ?? 0);
  const c1xVal = c1xAtt >= 5 ? Math.round(((pb[1].made + pb[2].made) / c1xAtt) * 100) : sg.c1xPct;
  const c2Val = pb[3]?.attempts >= 5 ? Math.round((pb[3].made / pb[3].attempts) * 100) : (c2Pct != null ? Math.round(c2Pct * 100) : 0);
  if (leak.id === "putting") {
    return {
      kind: "putting", heroValue: `${c2Val}`, heroUnit: "%",
      prose: `Your make rate from Circle 2. Inside 33 feet you're at ${sg.c1xPct}% and holding your own. Everything you give back on the green happens past the circle.`,
      fallLabel: "Where it falls off",
      falloff: [{ label: "15 ft", pct: bandPct(0) }, { label: "33 ft", pct: c1xVal }, { label: "66 ft", pct: c2Val, gold: true }],
      readout: [{ value: bandPct(0) == null ? "—" : `${bandPct(0)}%`, label: "15 ft" }, { value: `${c1xVal}%`, label: "33 ft" }, { value: `${c2Val}%`, label: "66 ft", gold: true }],
      plan: [{ title: "C2 Ladder", sub: "15 min · 30 putts from 35, 45, 55" }, { title: "Pressure Ladder", sub: "15 min · restart on any miss" }, { title: "C2 Money Putts", sub: "10 min · make 5 of 10 from 35 ft" }],
    };
  }
  if (leak.id === "tee") {
    return {
      kind: "tee", heroValue: `${sg.teeFairwayPct}`, heroUnit: "%",
      prose: `Your fairway rate off the tee. ${sg.teeObPct}% of your drives finish OB — every one of those is a stroke handed back before the hole even starts.`,
      fallLabel: "Where it leaks", falloff: null,
      readout: [{ value: `${sg.teeFairwayPct}%`, label: "Fairway" }, { value: `${sg.teeObPct}%`, label: "OB", gold: sg.teeObPct >= 8 }, { value: `${sg.driveAvg} ft`, label: "Avg drive" }],
      plan: [{ title: "Single Line", sub: "15 min · 20 drives at one fairway line" }, { title: "Tunnel Control", sub: "15 min · shape both ways through a gap" }, { title: "OB Discipline", sub: "10 min · club down, land in play 8 of 10" }],
    };
  }
  if (leak.id === "approach") {
    const readout = sg.proxBands.filter((b) => b.count >= 5).slice(0, 3).map((b, i, arr) => ({ value: `${b.avg} ft`, label: b.label.replace(" ft", ""), gold: i === arr.length - 1 }));
    return {
      kind: "approach", heroValue: `${sg.proximityAvgFt}`, heroUnit: "ft",
      prose: `Your average leave on approach. Tighter leaves turn these into the makeable putts you already convert — shrink the leave and the putts make themselves.`,
      fallLabel: "Leave by distance", falloff: null,
      readout: readout.length ? readout : [{ value: `${sg.proximityAvgFt} ft`, label: "Avg leave" }],
      plan: [{ title: "Circle Approach", sub: "15 min · land inside 30 ft from 250" }, { title: "Upshot Ladder", sub: "15 min · 80 / 120 / 160 ft touch shots" }, { title: "Parked Reps", sub: "10 min · park 3 of 10 from 150" }],
    };
  }
  return {
    kind: "short", heroValue: `${sg.scramblePct}`, heroUnit: "%",
    prose: `Your save rate from trouble. Winning these exchanges — a stray drive that still finishes par — is the fastest cut to your scoring average.`,
    fallLabel: "Where it leaks", falloff: null,
    readout: [{ value: `${sg.scramblePct}%`, label: "Scramble", gold: true }, { value: `${sg.scrambled}`, label: "Saved" }, { value: `${sg.scrambleOpps}`, label: "Chances" }],
    plan: [{ title: "Up & Down", sub: "15 min · save from 10 trouble spots" }, { title: "Parking Lot", sub: "15 min · park short approaches inside 15 ft" }, { title: "Two-Putt Max", sub: "10 min · never 3-putt from the fringe" }],
  };
}

export default function MyGameImprove({ uid }: { uid: string }) {
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [putterNames, setPutterNames] = useState<Set<string>>(new Set());
  const [putting, setPutting] = useState<PuttingSession[]>([]);
  const [range, setRange] = useState<RangeSession[]>([]);
  const [review, setReview] = useState<"putting" | "range" | null>(null);

  useEffect(() => {
    let alive = true;
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getPutterDiscNames().then((s) => alive && setPutterNames(s)).catch(() => {});
    getPracticeSessions(uid).then((s) => { if (alive) { setPutting(s.putting); setRange(s.range); } }).catch(() => {});
    return () => { alive = false; };
  }, [uid]);

  const career = useMemo(() => (rounds ? computeCareerStats(rounds, putterNames) : null), [rounds, putterNames]);
  const sg = useMemo(() => (rounds ? computeStrokesGained(rounds, putterNames) : null), [rounds, putterNames]);
  const leak = useMemo(() => (sg ? rankedCategories(sg).filter((c) => c.eligible)[0] : undefined), [sg]);
  const focus = useMemo(() => (sg && career ? buildFocus(leak, sg, career.c2.pct) : null), [leak, sg, career]);

  // practice → on-course transfer (Circle 2, like-for-like)
  const practiceC2 = useMemo(() => {
    const p = putting.flatMap((s) => s.putts).filter((x) => x.distanceFeet > 33 && x.distanceFeet <= 66);
    return p.length >= 5 ? p.filter((x) => x.made).length / p.length : null;
  }, [putting]);
  const onCourseC2 = career?.c2.pct ?? null;
  const weekStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() - 6 * 86400000; }, []);
  const planDone = useMemo(() => Math.min(focus?.plan.length ?? 0, putting.filter((s) => s.date >= weekStart).length), [putting, weekStart, focus]);

  if (!rounds) return <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="rounded-[18px] px-1 py-2 sm:px-6 sm:py-6" style={{ background: "#0C1310" }}>
      <div className="flex flex-col gap-12 lg:flex-row">
        {/* ===== LEFT: This week's focus ===== */}
        <div className="min-w-0 flex-1">
          <div className={eb} style={{ color: EB }}>This week&apos;s focus</div>
          {focus ? (
            <>
              <div className="mb-3.5 mt-5 flex items-start gap-4">
                <span style={{ ...MONO, fontSize: 72, fontWeight: 700, color: INK, lineHeight: 0.76, letterSpacing: "-0.055em" }}>{focus.heroValue}</span>
                <span style={{ ...MONO, fontSize: 26, fontWeight: 500, color: DIM, paddingTop: 6 }}>{focus.heroUnit}</span>
              </div>
              <p className={BODY} style={{ color: SAGE, fontSize: 14.5, lineHeight: 1.65, maxWidth: 480, marginBottom: 34 }}>{focus.prose}</p>

              <Hair />
              <div className={`${eb} mb-5 mt-6`} style={{ color: EB }}>{focus.fallLabel}</div>
              {focus.falloff && <Falloff points={focus.falloff} />}
              <div className="mb-8 flex">
                {focus.readout.map((r, i) => (
                  <div key={i} className="flex-1" style={{ textAlign: i === 0 ? "left" : i === focus.readout.length - 1 ? "right" : "center" }}>
                    <div style={{ ...MONO, fontSize: 13, color: r.gold ? GOLD : INK }}>{r.value}</div>
                    <div style={{ ...MONO, fontSize: 9, color: DIM, marginTop: 5 }}>{r.label}</div>
                  </div>
                ))}
              </div>

              <Hair />
              <div className="mb-5 mt-6 flex items-baseline">
                <div className={`${eb} flex-1`} style={{ color: EB }}>Your plan</div>
                <span style={{ ...MONO, fontSize: 10.5, color: DIM }}>{planDone} / {focus.plan.length}</span>
              </div>
              {focus.plan.map((d, i) => (
                <div key={d.title} className="flex items-center py-[17px]" style={{ borderBottom: i < focus.plan.length - 1 ? `1px solid ${HAIR}` : "none" }}>
                  <div className="flex-1">
                    <div style={{ color: INK, fontSize: 15.5, fontWeight: 600, marginBottom: 6 }}>{d.title}</div>
                    <div style={{ ...MONO, fontSize: 10.5, color: DIM }}>{d.sub}</div>
                  </div>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="#22302A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </div>
              ))}
            </>
          ) : (
            <p className={`${BODY} mt-5`} style={{ color: SAGE, fontSize: 14.5, lineHeight: 1.65, maxWidth: 480 }}>Track a few shot-tracked rounds in the Radius app and your weekly focus — the one thing costing you the most — builds itself here.</p>
          )}
        </div>

        {/* ===== RIGHT: stack up · transfer · practice ===== */}
        <div className="w-full shrink-0 lg:w-[360px]">
          <div className={`${eb} mb-5`} style={{ color: EB }}>How you stack up</div>
          <StackBar label="Circle 1" pct={career?.c1.pct ?? null} tiers={C1_TIERS} />
          <StackBar label="Circle 2" pct={career?.c2.pct ?? null} tiers={C2_TIERS} gold />
          <div className="mb-7 flex items-center gap-4"><span style={{ ...MONO, fontSize: 9, color: DIM }}>BEGINNER</span><div className="flex-1" /><span style={{ ...MONO, fontSize: 9, color: DIM }}>PRO</span></div>

          <Hair />
          <div className={`${eb} mb-5 mt-6`} style={{ color: EB }}>Is it transferring</div>
          {practiceC2 != null && onCourseC2 != null ? (
            <>
              <div className="mb-4 flex items-end">
                <div className="flex-1">
                  <div className="flex items-baseline gap-0.5"><span style={{ ...MONO, fontSize: 32, fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: "-0.04em" }}>{Math.round(practiceC2 * 100)}</span><span style={{ fontSize: 15, color: DIM }}>%</span></div>
                  <div style={{ fontSize: 8.5, letterSpacing: "0.16em", color: DIM, marginTop: 9 }}>IN PRACTICE</div>
                </div>
                <svg viewBox="0 0 64 32" style={{ width: 64, height: 32, marginBottom: 15 }}><line x1="4" y1={practiceC2 >= onCourseC2 ? 8 : 24} x2="60" y2={practiceC2 >= onCourseC2 ? 24 : 8} stroke="#22302A" strokeWidth="1.4" strokeLinecap="round" /></svg>
                <div className="flex-1 text-right">
                  <div className="flex items-baseline justify-end gap-0.5"><span style={{ ...MONO, fontSize: 32, fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: "-0.04em" }}>{Math.round(onCourseC2 * 100)}</span><span style={{ fontSize: 15, color: DIM }}>%</span></div>
                  <div style={{ fontSize: 8.5, letterSpacing: "0.16em", color: DIM, marginTop: 9 }}>ON COURSE</div>
                </div>
              </div>
              <p className={BODY} style={{ color: SAGE2, fontSize: 12.5, lineHeight: 1.65, marginBottom: 28 }}>{practiceC2 - onCourseC2 > 0.1 ? "You make them on the practice basket but not in a round. That's a pressure gap, not a technique gap." : "Your practice numbers are tracking your on-course numbers — the reps are transferring."}</p>
            </>
          ) : (
            <p className={BODY} style={{ color: SAGE2, fontSize: 12.5, lineHeight: 1.65, marginBottom: 28 }}>Log a putting session in the app and we&apos;ll compare your practice make rate to what actually holds up on the course.</p>
          )}

          <Hair />
          <div className={`${eb} mb-4 mt-6`} style={{ color: EB }}>Practice</div>
          <button onClick={() => setReview("putting")} className="flex w-full items-center pb-[15px]" style={{ borderBottom: `1px solid ${HAIR}`, marginBottom: 15 }}>
            <div className="flex-1 text-left"><div style={{ color: INK, fontSize: 13.5, fontWeight: 600 }}>Putting</div><div style={{ ...MONO, fontSize: 10, color: DIM, marginTop: 5 }}>{putting.length ? `${putting.length} session${putting.length === 1 ? "" : "s"} · structured C1 / C2 sets` : "Structured C1 / C2 sets"}</div></div>
            <span className={BODY} style={{ color: GOLD, fontSize: 11.5 }}>Review ↗</span>
          </button>
          <button onClick={() => setReview("range")} className="flex w-full items-center">
            <div className="flex-1 text-left"><div style={{ color: INK, fontSize: 13.5, fontWeight: 600 }}>Driving range</div><div style={{ ...MONO, fontSize: 10, color: DIM, marginTop: 5 }}>{range.length ? `${range.length} session${range.length === 1 ? "" : "s"} · measured distance and shape` : "Measured distance and shape"}</div></div>
            <span className={BODY} style={{ color: GOLD, fontSize: 11.5 }}>Review ↗</span>
          </button>
        </div>
      </div>

      {review && <SessionReview type={review} putting={putting} range={range} onClose={() => setReview(null)} />}
    </div>
  );
}
