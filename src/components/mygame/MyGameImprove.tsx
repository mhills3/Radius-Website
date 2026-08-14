"use client";

import { useEffect, useMemo, useState } from "react";
import { getDecodedRounds, computeCareerStats, computeStrokesGained, rankedCategories, type DecodedRound, type StrokesGained, type RankedCategory } from "@/lib/rounds";
import { getPutterDiscNames } from "@/lib/bag";
import { getPracticeSessions, type PuttingSession, type RangeSession } from "@/lib/sessions";
import SessionReview from "@/components/mygame/SessionReview";
import DrillSheet from "@/components/mygame/DrillSheet";
import { PLAN_DRILLS, PUTTING_DRILLS, C1_TIERS, C2_TIERS, DRIVE_TIERS, skillForLeak, skillLabel, missionFor, dayOfYear, weekKey, type Tier, type PlanDrill, type LeakId, type Skill } from "@/lib/drills";

// Editorial treatment: hairline rules instead of cards, one hero number, a benchmark scale.
const HEAD = "font-[family-name:var(--font-heading)]";
const BODY = "font-[family-name:var(--font-body)]";
const MONO = { fontFamily: "var(--font-heading)" } as const;
const INK = "#F4F1E8", GOLD = "#E8B560", EB = "#4A5A48", DIM = "#3E4B3F", SAGE = "#8FA08A", SAGE2 = "#5E6E5C", GREEN = "#8FBF9A", RED = "#C87F6A";
const HAIR = "rgba(244,241,232,0.08)"; // the site's --hair, so the Improve tab sits on the same green as the rest
const eb = `${HEAD} text-[9px] font-black uppercase tracking-[0.22em]`;
const Hair = () => <div style={{ height: 1, background: HAIR }} />;
const TIER_SHADES = ["#2A362D", "#3E4B3F", "#556B4E", "#6E8560", "#8CA574"];

// ---- benchmark ladder: labelled segment per tier, player's tier highlighted, needle placed within it ----
function fmtEdge(x: number, unit: string) { return unit === "%" ? `${x}%` : `${x}`; }
function StackBar({ label, value, tiers, unit, gold }: { label: string; value: number | null; tiers: Tier[]; unit: string; gold?: boolean }) {
  const has = value != null;
  const v = has ? value! : 0;
  const n = tiers.length;
  let cur = -1, seg = 0, frac = 0;
  if (has) {
    if (v < tiers[0].start) { seg = 0; cur = -1; frac = Math.max(0, v / (tiers[0].start || 1)); }
    else { for (let i = 0; i < n; i++) if (v >= tiers[i].start) { seg = i; cur = i; frac = Math.min(1, (v - tiers[i].start) / (tiers[i].end - tiers[i].start)); } if (v >= tiers[n - 1].end) frac = 1; }
  }
  const needle = ((seg + frac) / n) * 100;
  let caption = "Log more to place yourself on the scale.";
  if (has) {
    if (cur < 0) caption = `Below the scale — ${tiers[0].name} starts at ${fmtEdge(tiers[0].start, unit)}${unit === "%" ? "" : ` ${unit}`}.`;
    else { const nx = tiers[cur + 1]; caption = nx ? `${tiers[cur].name} range. ${nx.name} starts at ${fmtEdge(nx.start, unit)}${unit === "%" ? "" : ` ${unit}`}.` : `${tiers[cur].name} range — top of the ladder.`; }
  }
  return (
    <div className="mb-9">
      <div className="mb-3.5 flex items-baseline">
        <span className="flex-1 text-[16px] font-semibold" style={{ color: INK }}>{label}</span>
        <span className={`${HEAD} text-[18px] font-bold`} style={{ ...MONO, color: gold ? GOLD : INK }}>{has ? (unit === "%" ? `${Math.round(v)}%` : `${Math.round(v)} ${unit}`) : "—"}</span>
      </div>
      <div className="relative flex" style={{ height: 12, gap: 3 }}>
        {tiers.map((t, i) => <div key={t.name} className="flex-1 rounded-[2px]" style={{ background: TIER_SHADES[i], boxShadow: cur === i ? `inset 0 0 0 1.5px ${GOLD}` : "none" }} />)}
        {has && <div className="absolute" style={{ left: `${needle}%`, top: -3, bottom: -3, width: 2, transform: "translateX(-1px)", background: INK, borderRadius: 1 }} />}
      </div>
      <div className="mt-2.5 flex" style={{ gap: 3 }}>
        {tiers.map((t, i) => (
          <div key={t.name} className="flex-1 text-center">
            <div style={{ fontSize: 9.5, letterSpacing: "0.03em", textTransform: "uppercase", fontWeight: 700, color: cur === i ? GOLD : EB }}>{t.name}</div>
            <div style={{ ...MONO, fontSize: 10.5, color: cur === i ? GOLD : DIM, marginTop: 3 }}>{t.start}{i === n - 1 ? "+" : `–${t.end}`}</div>
          </div>
        ))}
      </div>
      <div className={`${BODY} mt-3.5 text-[13px]`} style={{ color: SAGE2 }}>{caption}</div>
    </div>
  );
}

// putting "where it falls off" area chart across the distance bands
function Falloff({ points }: { points: { label: string; pct: number | null; gold?: boolean }[] }) {
  const w = 480, h = 112, padX = 14, padTop = 14, padBot = 12;
  const x = (i: number) => padX + (i / (points.length - 1)) * (w - 2 * padX);
  const y = (v: number) => padTop + (1 - v / 100) * (h - padTop - padBot);
  const known = points.map((p, i) => (p.pct == null ? null : [x(i), y(p.pct)] as const)).filter(Boolean) as [number, number][];
  if (known.length < 2) return null;
  const line = known.map(([px, py]) => `${px},${py}`).join(" ");
  const area = `M${known[0][0]},${known[0][1]} ${known.map(([px, py]) => `L${px},${py}`).join(" ")} L${known[known.length - 1][0]},${h} L${known[0][0]},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 112 }} className="mb-3">
      <defs><linearGradient id="fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity="0.14" /><stop offset="100%" stopColor={GOLD} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#fo)" />
      <path d={`M${line.split(" ").join(" L")}`} fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => p.pct == null ? null : <circle key={i} cx={x(i)} cy={y(p.pct)} r={i === points.length - 1 ? 4 : 3} fill={i === points.length - 1 ? GOLD : "#141B16"} stroke={GOLD} strokeWidth="1.5" />)}
    </svg>
  );
}

// focus-metric progress across recent rounds — the "is it improving?" read
function Trend({ series, unit, lowerBetter }: { series: { date: number; val: number }[]; unit: string; lowerBetter: boolean }) {
  if (series.length < 3) return null;
  const w = 300, h = 46, sp = 4;
  const vals = series.map((s) => s.val);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i: number) => (i / (series.length - 1)) * w;
  const y = (v: number) => sp + (1 - (v - min) / span) * (h - 2 * sp);
  const line = series.map((s, i) => `${x(i)},${y(s.val)}`).join(" ");
  const area = `M0,${h} ${series.map((s, i) => `L${x(i)},${y(s.val)}`).join(" ")} L${w},${h} Z`;
  const first = vals[0], last = vals[vals.length - 1], delta = last - first;
  const improving = lowerBetter ? delta < 0 : delta > 0;
  const flat = Math.abs(delta) < (unit === "ft" ? 1 : 1);
  const col = flat ? DIM : improving ? GREEN : RED;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={eb} style={{ color: EB }}>Your trend</span>
        {!flat && <span className="text-[11px] font-bold" style={{ color: col }}>{delta > 0 ? "▲" : "▼"}{Math.abs(Math.round(delta))}{unit === "%" ? "%" : ` ${unit}`}</span>}
        <span className="text-[10px]" style={{ ...MONO, color: DIM }}>last {series.length} rounds</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h }} className="block">
        <defs><linearGradient id="fo-trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.18" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#fo-trend)" />
        <polyline points={line} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={x(series.length - 1)} cy={y(last)} r="3.5" fill={col} />
      </svg>
    </div>
  );
}

// ---- putting benchmark tiers for the "how you stack up" ladders (iOS puttingBenchmarkSheet) ----
type Focus = { kind: "putting" | "tee" | "approach" | "short"; headline: string; heroValue: string; heroUnit: string; prose: string; fallLabel: string; falloff: { label: string; pct: number | null; gold?: boolean }[] | null; readout: { value: string; label: string; gold?: boolean }[] };

function buildFocus(leak: RankedCategory | undefined, sg: StrokesGained, c2Pct: number | null): Focus | null {
  if (!leak) return null;
  const pb = sg.puttBands;
  const bandPct = (i: number) => (pb[i]?.attempts >= 5 ? Math.round((pb[i].made / pb[i].attempts) * 100) : null);
  const c1xAtt = (pb[1]?.attempts ?? 0) + (pb[2]?.attempts ?? 0);
  const c1xVal = c1xAtt >= 5 ? Math.round(((pb[1].made + pb[2].made) / c1xAtt) * 100) : sg.c1xPct;
  const c2Val = pb[3]?.attempts >= 5 ? Math.round((pb[3].made / pb[3].attempts) * 100) : (c2Pct != null ? Math.round(c2Pct * 100) : 0);
  if (leak.id === "putting") {
    return {
      kind: "putting", headline: "Everything past 33 feet.", heroValue: `${c2Val}`, heroUnit: "%",
      prose: `Inside the circle you're at ${sg.c1xPct}% and holding your own. Everything you give back on the green happens past it — closing that C2 gap is worth more than anything else in your game right now.`,
      fallLabel: "Where it falls off",
      falloff: [{ label: "15 ft", pct: bandPct(0) }, { label: "33 ft", pct: c1xVal }, { label: "66 ft", pct: c2Val, gold: true }],
      readout: [{ value: bandPct(0) == null ? "—" : `${bandPct(0)}%`, label: "15 ft" }, { value: `${c1xVal}%`, label: "33 ft" }, { value: `${c2Val}%`, label: "66 ft", gold: true }],
    };
  }
  if (leak.id === "tee") {
    return {
      kind: "tee", headline: "The tee shot.", heroValue: `${sg.teeFairwayPct}`, heroUnit: "%",
      prose: `You hit ${sg.teeFairwayPct}% of fairways, but ${sg.teeObPct}% of drives finish OB — strokes handed back before the hole even starts. Tighten the line and every stat downstream gets easier.`,
      fallLabel: "Where it leaks", falloff: null,
      readout: [{ value: `${sg.teeFairwayPct}%`, label: "Fairway" }, { value: `${sg.teeObPct}%`, label: "OB", gold: sg.teeObPct >= 8 }, { value: `${sg.driveAvg} ft`, label: "Avg drive" }],
    };
  }
  if (leak.id === "approach") {
    const readout = sg.proxBands.filter((b) => b.count >= 5).slice(0, 3).map((b, i, arr) => ({ value: `${b.avg} ft`, label: b.label.replace(" ft", ""), gold: i === arr.length - 1 }));
    return {
      kind: "approach", headline: "The approach game.", heroValue: `${sg.proximityAvgFt}`, heroUnit: "ft",
      prose: `Approaches are leaving ${sg.proximityAvgFt}-foot putts — that's a real putt, not a tap-in. Land them ten feet tighter and they turn into the C1 looks you already make.`,
      fallLabel: "Leave by distance", falloff: null,
      readout: readout.length ? readout : [{ value: `${sg.proximityAvgFt} ft`, label: "Avg leave" }],
    };
  }
  return {
    kind: "short", headline: "Around the green.", heroValue: `${sg.scramblePct}`, heroUnit: "%",
    prose: `Trouble is turning into bogeys — you save ${sg.scramblePct}%. Winning those exchanges — a stray drive that still finishes par — is the fastest cut to your scoring average.`,
    fallLabel: "Where it leaks", falloff: null,
    readout: [{ value: `${sg.scramblePct}%`, label: "Scramble", gold: true }, { value: `${sg.scrambled}`, label: "Saved" }, { value: `${sg.scrambleOpps}`, label: "Chances" }],
  };
}

export default function MyGameImprove({ uid }: { uid: string }) {
  const [rounds, setRounds] = useState<DecodedRound[] | null>(null);
  const [putterNames, setPutterNames] = useState<Set<string>>(new Set());
  const [putting, setPutting] = useState<PuttingSession[]>([]);
  const [range, setRange] = useState<RangeSession[]>([]);
  const [review, setReview] = useState<"putting" | "range" | null>(null);
  const [openDrill, setOpenDrill] = useState<PlanDrill | null>(null);
  // personal, web-side progress tracking (localStorage) — the app owns the real training-streak model
  const [today, setToday] = useState<{ doy: number; wk: string } | null>(null);
  const [planDone, setPlanDone] = useState<Set<string>>(new Set());
  const [moveDone, setMoveDone] = useState(false);

  useEffect(() => {
    let alive = true;
    getDecodedRounds(uid).then((r) => alive && setRounds(r)).catch(() => alive && setRounds([]));
    getPutterDiscNames().then((s) => alive && setPutterNames(s)).catch(() => {});
    getPracticeSessions(uid).then((s) => { if (alive) { setPutting(s.putting); setRange(s.range); } }).catch(() => {});
    return () => { alive = false; };
  }, [uid]);

  // client-only: resolve today's date + load saved checks
  useEffect(() => {
    const now = new Date();
    const doy = dayOfYear(now), wk = weekKey(now);
    setToday({ doy, wk });
    try {
      const pd = JSON.parse(localStorage.getItem(`radius:improve:plan:${uid}:${wk}`) || "[]");
      setPlanDone(new Set(Array.isArray(pd) ? (pd as string[]) : []));
      setMoveDone(localStorage.getItem(`radius:improve:move:${uid}:${doy}`) === "1");
    } catch { /* ignore */ }
  }, [uid]);

  const career = useMemo(() => (rounds ? computeCareerStats(rounds, putterNames) : null), [rounds, putterNames]);
  const sg = useMemo(() => (rounds ? computeStrokesGained(rounds, putterNames) : null), [rounds, putterNames]);
  const leak = useMemo(() => (sg ? rankedCategories(sg).filter((c) => c.eligible)[0] : undefined), [sg]);
  const focus = useMemo(() => (sg && career ? buildFocus(leak, sg, career.c2.pct) : null), [leak, sg, career]);

  const skill: Skill = leak ? skillForLeak(leak.id as LeakId) : "Putting";
  const plan = PLAN_DRILLS[skill];
  const mission = today ? missionFor(skill, today.doy) : null;
  const planDoneCount = plan.filter((d) => planDone.has(d.title)).length;

  const togglePlan = (title: string) => setPlanDone((prev) => {
    const next = new Set(prev);
    if (next.has(title)) next.delete(title); else next.add(title);
    if (today) try { localStorage.setItem(`radius:improve:plan:${uid}:${today.wk}`, JSON.stringify([...next])); } catch { /* ignore */ }
    return next;
  });
  const toggleMove = () => setMoveDone((v) => {
    const nv = !v;
    if (today) try { localStorage.setItem(`radius:improve:move:${uid}:${today.doy}`, nv ? "1" : "0"); } catch { /* ignore */ }
    return nv;
  });

  // per-round focus metric → the trend line
  const focusTrend = useMemo(() => {
    if (!rounds || !leak) return [];
    const comp = rounds.filter((r) => r.isComplete).sort((a, b) => a.date - b.date);
    const out: { date: number; val: number }[] = [];
    for (const r of comp) {
      const s = computeStrokesGained([r], putterNames);
      let val: number | null = null;
      if (leak.id === "putting") { const att = s.puttBands[1].attempts + s.puttBands[2].attempts; if (att >= 4) val = s.c1xPct; }
      else if (leak.id === "tee") { if (s.teeAttempts >= 3) val = s.teeFairwayPct; }
      else if (leak.id === "approach") { if (s.approachCount >= 3) val = s.proximityAvgFt; }
      else if (leak.id === "short") { if (s.scrambleOpps >= 2) val = s.scramblePct; }
      if (val != null) out.push({ date: r.date, val });
    }
    return out.slice(-12);
  }, [rounds, leak, putterNames]);
  const trendUnit = focus?.heroUnit ?? "%";
  const lowerBetter = leak?.id === "approach";

  // practice → on-course transfer (Circle 2, like-for-like), iOS improveProofSection
  const practiceC2 = useMemo(() => {
    const p = putting.flatMap((s) => s.putts).filter((x) => x.distanceFeet > 33 && x.distanceFeet <= 66);
    return { att: p.length, pct: p.length ? p.filter((x) => x.made).length / p.length : null };
  }, [putting]);
  const onCourseC2 = career?.c2 ?? { att: 0, pct: null };
  const sessions = putting.length + range.length;
  const transfer = useMemo(() => {
    const pPct = practiceC2.pct, cPct = onCourseC2.pct;
    if (sessions === 0) return "Log a putting session in the app and we'll compare your practice make rate to what holds up on the course.";
    if (sessions < 5 || onCourseC2.att < 20 || practiceC2.att < 20) return `${sessions} session${sessions === 1 ? "" : "s"} in. Not enough on-course data yet to tell if it's transferring.`;
    if (pPct == null || cPct == null) return `${sessions} sessions in. Keep logging to see if it's transferring.`;
    if (cPct >= pPct - 0.05) return "It's transferring — your on-course C2 is tracking your practice numbers.";
    return `Practice is ahead of the course — ${Math.round(pPct * 100)}% in practice vs ${Math.round(cPct * 100)}% in rounds. Keep taking the reps to the card.`;
  }, [sessions, practiceC2, onCourseC2]);

  if (!rounds) return <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]"><svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <>
      <div className="flex flex-col gap-12 lg:flex-row">
        {/* ===== LEFT: focus · today's move · plan ===== */}
        <div className="min-w-0 flex-1">
          <div className={eb} style={{ color: EB }}>This week&apos;s focus</div>
          {focus ? (
            <>
              <div className={`${HEAD} mb-4 mt-5 text-[26px] font-extrabold leading-tight`} style={{ color: INK }}>{focus.headline}</div>
              <div className="mb-3.5 flex items-start gap-4">
                <span style={{ ...MONO, fontSize: 72, fontWeight: 700, color: INK, lineHeight: 0.76, letterSpacing: "-0.055em" }}>{focus.heroValue}</span>
                <span style={{ ...MONO, fontSize: 26, fontWeight: 500, color: DIM, paddingTop: 6 }}>{focus.heroUnit}</span>
              </div>
              <p className={BODY} style={{ color: SAGE, fontSize: 14.5, lineHeight: 1.65, maxWidth: 480, marginBottom: 30 }}>{focus.prose}</p>

              {focusTrend.length >= 3 && <><div className="mb-8"><Trend series={focusTrend} unit={trendUnit} lowerBetter={lowerBetter} /></div></>}

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

              {/* today's move */}
              {mission && (
                <>
                  <Hair />
                  <div className={`${eb} mb-4 mt-6`} style={{ color: EB }}>Today&apos;s move</div>
                  <div className="rounded-xl border p-4" style={{ borderColor: moveDone ? "rgba(143,191,154,0.4)" : HAIR, background: moveDone ? "rgba(143,191,154,0.06)" : "transparent" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div style={{ color: INK, fontSize: 16, fontWeight: 700 }}>{mission.title}</div>
                        <div className={`${BODY} mt-1.5`} style={{ color: SAGE, fontSize: 13, lineHeight: 1.5 }}>{mission.goal}</div>
                      </div>
                      <span className={`${HEAD} shrink-0 rounded-full px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide`} style={{ background: "rgba(232,181,96,0.14)", color: GOLD }}>{skillLabel(skill)}</span>
                    </div>
                    <button onClick={toggleMove} className={`${HEAD} mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-bold transition-colors`}
                      style={moveDone ? { background: "rgba(143,191,154,0.14)", color: GREEN } : { background: GOLD, color: "#141B16" }}>
                      {moveDone ? <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20 6L9 17l-5-5" /></svg>Done today</> : "Mark complete"}
                    </button>
                  </div>
                </>
              )}

              {/* this week's plan */}
              <Hair />
              <div className="mb-5 mt-6 flex items-baseline">
                <div className={`${eb} flex-1`} style={{ color: EB }}>This week&apos;s plan</div>
                <span style={{ ...MONO, fontSize: 10.5, color: DIM }}>{planDoneCount} of {plan.length}</span>
              </div>
              {plan.map((d, i) => {
                const done = planDone.has(d.title);
                return (
                  <div key={d.title} className="flex items-center py-[15px]" style={{ borderBottom: i < plan.length - 1 ? `1px solid ${HAIR}` : "none" }}>
                    <button onClick={() => togglePlan(d.title)} className="mr-3.5 grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors" style={{ border: `1.5px solid ${done ? GREEN : "#2E3A2F"}`, background: done ? "rgba(143,191,154,0.14)" : "transparent" }} aria-label={done ? "Mark not done" : "Mark done"}>
                      {done && <svg viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M20 6L9 17l-5-5" /></svg>}
                    </button>
                    <button onClick={() => setOpenDrill(d)} className="min-w-0 flex-1 text-left">
                      <div style={{ color: done ? SAGE2 : INK, fontSize: 15.5, fontWeight: 600, marginBottom: 6, textDecoration: done ? "line-through" : "none" }}>{d.title}</div>
                      <div style={{ ...MONO, fontSize: 10.5, color: DIM }}>{d.minutes} min · {d.goal}</div>
                    </button>
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#22302A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  </div>
                );
              })}
            </>
          ) : (
            <p className={`${BODY} mt-5`} style={{ color: SAGE, fontSize: 14.5, lineHeight: 1.65, maxWidth: 480 }}>Track a few shot-tracked rounds in the Radius app and your weekly focus — the one thing costing you the most — builds itself here, with a plan to fix it.</p>
          )}
        </div>

        {/* ===== RIGHT: stack up · transfer · practice ===== */}
        <div className="w-full shrink-0 lg:w-[420px]">
          <div className={`${eb} mb-6 text-[10px]`} style={{ color: EB }}>How you stack up</div>
          <StackBar label="Circle 1 putting" value={career?.c1.pct != null ? career.c1.pct * 100 : null} tiers={C1_TIERS} unit="%" />
          <StackBar label="Circle 2 putting" value={career?.c2.pct != null ? career.c2.pct * 100 : null} tiers={C2_TIERS} unit="%" gold />
          <StackBar label="Drive distance" value={career?.avgDriveFt ?? null} tiers={DRIVE_TIERS} unit="ft" />

          <Hair />
          <div className={`${eb} mb-6 mt-7 text-[10px]`} style={{ color: EB }}>Is it working</div>
          <div className="mb-5 flex">
            {[{ v: onCourseC2.pct != null ? `${Math.round(onCourseC2.pct * 100)}%` : "—", l: "C2 on course" }, { v: practiceC2.pct != null ? `${Math.round(practiceC2.pct * 100)}%` : "—", l: "C2 in practice", gold: true }, { v: `${sessions}`, l: "Sessions" }].map((s, i, arr) => (
              <div key={i} className="flex-1" style={{ textAlign: i === 0 ? "left" : i === arr.length - 1 ? "right" : "center" }}>
                <div style={{ ...MONO, fontSize: 34, fontWeight: 700, color: s.gold ? GOLD : INK, lineHeight: 1, letterSpacing: "-0.03em" }}>{s.v}</div>
                <div style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: DIM, marginTop: 11 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <p className={BODY} style={{ color: SAGE2, fontSize: 14, lineHeight: 1.65, marginBottom: 34 }}>{transfer}</p>

          <Hair />
          <div className={`${eb} mb-5 mt-7 text-[10px]`} style={{ color: EB }}>Practice</div>
          <button onClick={() => setReview("putting")} className="flex w-full items-center pb-[18px]" style={{ borderBottom: `1px solid ${HAIR}`, marginBottom: 18 }}>
            <div className="flex-1 text-left"><div style={{ color: INK, fontSize: 16, fontWeight: 600 }}>Putting</div><div style={{ ...MONO, fontSize: 11.5, color: DIM, marginTop: 6 }}>{putting.length ? `${putting.length} session${putting.length === 1 ? "" : "s"} · structured C1 / C2 sets` : "Structured C1 / C2 sets"}</div></div>
            <span className={BODY} style={{ color: GOLD, fontSize: 13.5 }}>Review ↗</span>
          </button>
          <button onClick={() => setReview("range")} className="flex w-full items-center" style={{ borderBottom: `1px solid ${HAIR}`, paddingBottom: 18, marginBottom: 22 }}>
            <div className="flex-1 text-left"><div style={{ color: INK, fontSize: 16, fontWeight: 600 }}>Driving range</div><div style={{ ...MONO, fontSize: 11.5, color: DIM, marginTop: 6 }}>{range.length ? `${range.length} session${range.length === 1 ? "" : "s"} · measured distance and shape` : "Measured distance and shape"}</div></div>
            <span className={BODY} style={{ color: GOLD, fontSize: 13.5 }}>Review ↗</span>
          </button>

          {/* putting drill reference — the app's GPS trainer set */}
          <div className={`${eb} mb-1 text-[10px]`} style={{ color: EB }}>Putting drills in the app</div>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
            {PUTTING_DRILLS.map((d) => (
              <div key={d.name} title={d.detail}>
                <div style={{ color: INK, fontSize: 14.5, fontWeight: 600 }}>{d.name}</div>
                <div style={{ ...MONO, fontSize: 10.5, color: DIM, marginTop: 3 }}>{d.band}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {review && <SessionReview type={review} putting={putting} range={range} onClose={() => setReview(null)} />}
      {openDrill && <DrillSheet drill={openDrill} skillName={skillLabel(skill)} done={planDone.has(openDrill.title)} onToggle={() => togglePlan(openDrill.title)} onClose={() => setOpenDrill(null)} />}
    </>
  );
}
