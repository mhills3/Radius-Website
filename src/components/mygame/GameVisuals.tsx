"use client";

import { useMemo } from "react";
import type { DecodedRound } from "@/lib/rounds";
import type { RangeSession } from "@/lib/sessions";
import type { DbDisc } from "@/lib/bag";
import { driveDispersion, bagMeasured, holeByHole, latestSGRound, puttGreen } from "@/lib/gameViz";
import LevelBadge from "@/components/scorecard/LevelBadge";
import ProGate from "@/components/ProGate";

const HEAD = "font-[family-name:var(--font-heading)]";
const BODY = "font-[family-name:var(--font-body)]";
const MONO = { fontFamily: "var(--font-heading)" } as const;
const INK = "#F4F1E8", GOLD = "#E8B560", SALMON = "#C87F6A", EB = "#4A5A48", DIM = "#3E4B3F", SAGE = "#8FA08A", GRID = "#1B241E", HAIR = "rgba(244,241,232,0.08)";
const eb = `${HEAD} text-[11px] font-black uppercase tracking-[0.2em]`;
const svgFill = { width: "100%", height: "auto", display: "block" } as const;
const Hair = () => <div style={{ height: 1, background: HAIR }} className="my-11" />;
function Head({ label, sub }: { label: string; sub: string }) {
  return <div className="mb-5"><div className={eb} style={{ color: EB }}>{label}</div><div className={`${BODY} mt-2 text-[13px]`} style={{ color: DIM }}>{sub}</div></div>;
}
function Caption({ children }: { children: React.ReactNode }) {
  return <div className={`${BODY} mt-5 text-[15px] leading-[1.6]`} style={{ color: SAGE }}>{children}</div>;
}

// avg score-to-par → colour (green under, warm over)
function holeColor(v: number): string {
  const t = Math.max(-1, Math.min(1, v));
  if (t <= 0) { const k = -t; return `rgb(${Math.round(42 + k * 65)},${Math.round(58 + k * 80)},${Math.round(44 + k * 50)})`; }
  return `rgb(${Math.round(42 + t * 118)},${Math.round(58 - t * 20)},${Math.round(44 - t * 6)})`;
}
const relLabel = (v: number) => { if (Math.abs(v) < 0.05) return ".0"; const s = v < 0 ? "−" : "+"; return s + Math.abs(v).toFixed(1).replace(/^0/, ""); };

// Illustrative sample data — shown (clearly badged) only when a player hasn't logged enough GPS-tracked
// shots yet, so the visual reads as intended instead of sitting empty. Never presented as real numbers.
const SAMPLE_DISP: ReturnType<typeof driveDispersion> = {
  points: [
    { offset: -18, distance: 355, ob: false }, { offset: 6, distance: 405, ob: false }, { offset: 14, distance: 390, ob: false },
    { offset: 24, distance: 340, ob: false }, { offset: 9, distance: 425, ob: false }, { offset: -7, distance: 380, ob: false },
    { offset: 17, distance: 360, ob: false }, { offset: 34, distance: 325, ob: true }, { offset: 11, distance: 400, ob: false },
    { offset: 21, distance: 370, ob: false }, { offset: -22, distance: 345, ob: true }, { offset: 8, distance: 395, ob: false },
    { offset: 28, distance: 335, ob: false }, { offset: 19, distance: 410, ob: false }, { offset: 5, distance: 385, ob: false },
    { offset: 13, distance: 375, ob: false },
  ],
  avgOffset: 11, count: 16,
};
const SAMPLE_BAG: ReturnType<typeof bagMeasured> = {
  discs: [
    { name: "Putter", distance: 230, stability: 0.5, count: 9 },
    { name: "Midrange", distance: 300, stability: 0.5, count: 11 },
    { name: "Fairway", distance: 355, stability: 1.5, count: 8 },
    { name: "Control", distance: 400, stability: 1.0, count: 7 },
    { name: "Roller", distance: 415, stability: -1.5, count: 4 },
    { name: "Distance", distance: 440, stability: 2.5, count: 6 },
  ],
  gap: { lo: 230, hi: 300 }, minD: 230, maxD: 440,
};
// Wraps a chart drawn from sample data with an unmistakable badge + dim, so it's never mistaken for real.
function SampleWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative" style={{ opacity: 0.92 }}>
      <span className={`${HEAD} absolute right-0 top-0 z-10 rounded-full border px-2 py-[2.5px] text-[8.5px] font-black uppercase tracking-[0.2em]`} style={{ borderColor: "rgba(232,181,96,0.45)", color: GOLD, background: "rgba(20,27,22,0.6)" }}>Sample</span>
      {children}
    </div>
  );
}

export default function GameVisuals({ iq, rankText, meta, insight, rounds, range, catalog, putterNames, pro = true }: {
  iq: number; rankText: string; meta: string; insight: string; rounds: DecodedRound[]; range: RangeSession[]; catalog: DbDisc[]; putterNames: Set<string>; pro?: boolean;
}) {
  const disp = useMemo(() => driveDispersion(rounds, range), [rounds, range]);
  const bag = useMemo(() => bagMeasured(rounds, catalog), [rounds, catalog]);
  const hbh = useMemo(() => holeByHole(rounds), [rounds]);
  const rsg = useMemo(() => latestSGRound(rounds), [rounds]);
  const putts = useMemo(() => puttGreen(rounds, putterNames), [rounds, putterNames]);

  return (
    <div>
      {/* header — gamified emblem + Game IQ */}
      <div className="mb-8 flex items-center gap-5">
        <LevelBadge iq={iq} size={72} />
        <div className="min-w-0 flex-1">
          <div className={eb} style={{ color: EB }}>Game IQ</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span style={{ ...MONO, fontSize: 56, fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: "-0.02em" }}>{iq}</span>
            <span style={{ ...MONO, fontSize: 16, color: SAGE }}>{rankText}</span>
            <span className="ml-auto" style={{ ...MONO, fontSize: 13.5, color: EB }}>{meta}</span>
          </div>
        </div>
      </div>
      <p className={BODY} style={{ color: INK, fontSize: 25, lineHeight: 1.5, maxWidth: 760, marginBottom: 4 }}>{insight}</p>
      <Hair />

      {/* the breakdown/evidence is Pro (the Game IQ number + read above stay free) */}
      <ProGate pro={pro} title="Unlock your evidence" blurb="Your miss pattern, measured bag, strokes gained and putting — the full breakdown is part of Radius Pro." className="!rounded-2xl">
      {/* row 1: dispersion + bag */}
      <div className="flex flex-col gap-14 lg:flex-row">
        <div className="min-w-0 flex-1">
          <Head label="Where your drives land" sub={disp.count >= 4 ? `${disp.count} measured tee shots, relative to the target line` : "How your tee shots scatter around the target line"} />
          {disp.count >= 4 ? <><Dispersion disp={disp} /><Caption>{Math.abs(disp.avgOffset) >= 6 ? <>Your average drive lands <b style={{ color: INK }}>{Math.abs(Math.round(disp.avgOffset))} ft {disp.avgOffset > 0 ? "right" : "left"}</b> of target. That&apos;s a consistent aim bias, not spray.</> : "Your drives sit right on the target line — no aim bias to correct."}</Caption></>
            : <><SampleWrap><Dispersion disp={SAMPLE_DISP} /></SampleWrap><Caption>Sample pattern — play GPS-tracked rounds (or run a measured range session) and your real dispersion replaces this.</Caption></>}
        </div>
        <div className="min-w-0 flex-1">
          <Head label="Your bag, measured" sub="Actual distance and fade, with the gaps" />
          {bag.discs.length >= 3 ? <><BagMap bag={bag} /><Caption>{bag.gap ? <>Nothing covers <b style={{ color: INK }}>{bag.gap.lo}–{bag.gap.hi} ft</b>. That&apos;s a slot you throw around instead of through.</> : "Your distances ladder up cleanly — no obvious gaps in the bag."}</Caption></>
            : <><SampleWrap><BagMap bag={SAMPLE_BAG} /></SampleWrap><Caption>Sample ladder — throw a few GPS-tracked drives and this fills with your real distances and gaps.</Caption></>}
        </div>
      </div>
      <Hair />

      {/* hole by hole */}
      {hbh ? (
        <>
          <Head label="Hole by hole, all rounds" sub={`${hbh.courseName} · average score to par on each hole`} />
          <div className="flex" style={{ gap: 6 }}>
            {hbh.holes.map((h) => { const notable = Math.abs(h.avgRel) >= 0.05; return (
              <div key={h.hole} className="flex flex-1 flex-col items-center justify-center rounded-[5px]" style={{ height: 78, background: holeColor(h.avgRel) }}>
                <span style={{ ...MONO, fontSize: 13, color: notable ? INK : SAGE }}>{h.hole}</span>
                <span style={{ ...MONO, fontSize: 14, fontWeight: 700, marginTop: 4, color: notable ? (h.avgRel < 0 ? "#C9D2C4" : INK) : SAGE }}>{relLabel(h.avgRel)}</span>
              </div>
            ); })}
          </div>
          {hbh.worst && hbh.best && <Caption>Hole {hbh.worst.hole} costs you {hbh.worst.avgRel >= 0.6 ? "a full stroke" : `${relLabel(hbh.worst.avgRel)}`} every time you play it. Hole {hbh.best.hole} gives one back.</Caption>}
          <Hair />
        </>
      ) : null}

      {/* row 2: cumulative SG + putt green */}
      <div className="flex flex-col gap-14 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <Head label="How the round is won or lost" sub={`Cumulative strokes gained · ${rsg ? new Date(rsg.round.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "last round"}`} />
          {rsg ? <><CumulativeSG sg={rsg.sg} /><Caption>{rsg.sg.worst.sg <= -1.2 ? <>You gained steadily except hole {rsg.sg.worst.hole}, where you gave back <b style={{ color: INK }}>{Math.abs(rsg.sg.worst.sg).toFixed(1)} strokes</b> in one hole.</> : rsg.sg.total >= 0 ? "You gained ground on most holes — a clean, positive round." : "The round leaked slowly rather than in one blow-up hole."}</Caption></>
            : <Empty>Play a shot-tracked round and your hole-by-hole strokes-gained line builds here.</Empty>}
        </div>
        <div className="min-w-0 flex-1">
          <Head label="On the green" sub={`${putts.total} makeable putts · made and missed`} />
          {putts.total >= 6 ? <><PuttGreen data={putts} /><Caption>{putts.c1Att && putts.c1Made / putts.c1Att >= 0.75 ? "Inside the circle you're money. Past it, the makes fall off fast." : "The green is where your strokes go — tighten up inside the circle first."}</Caption></>
            : <Empty>Shot-track your putts and your make/miss green plot builds here.</Empty>}
        </div>
      </div>
      </ProGate>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <div className={`${BODY} flex min-h-[240px] items-center text-[14px] leading-[1.6]`} style={{ color: DIM, maxWidth: 320 }}>{children}</div>; }

// ---- 1. dispersion scatter ----
function Dispersion({ disp }: { disp: ReturnType<typeof driveDispersion> }) {
  const W = 300, H = 250;
  const maxOff = Math.max(40, ...disp.points.map((p) => Math.abs(p.offset)));
  const dmin = Math.min(...disp.points.map((p) => p.distance)), dmax = Math.max(...disp.points.map((p) => p.distance));
  const dspan = dmax - dmin || 1;
  const x = (off: number) => 150 + (off / maxOff) * 120;
  const y = (d: number) => 230 - ((d - dmin) / dspan) * 210;
  const avgX = x(disp.avgOffset);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgFill}>
      <line x1="150" y1="10" x2="150" y2="240" stroke={GRID} strokeWidth="1" strokeDasharray="4 6" />
      <ellipse cx="150" cy="125" rx="86" ry="98" fill={GOLD} opacity="0.05" /><ellipse cx="150" cy="125" rx="52" ry="66" fill={GOLD} opacity="0.06" />
      <text x="150" y="248" fill="#2A362D" fontSize="9" style={MONO} textAnchor="middle">TARGET LINE</text>
      {disp.points.map((p, i) => <circle key={i} cx={x(p.offset)} cy={y(p.distance)} r="3.2" fill={p.ob ? SALMON : GOLD} opacity={p.ob ? 0.7 : 0.6} />)}
      <line x1={avgX} y1="10" x2={avgX} y2="240" stroke={INK} strokeWidth="1.4" />
      <text x={avgX + 5} y="24" fill={INK} fontSize="9" style={MONO}>avg</text>
    </svg>
  );
}

// ---- 2. bag distance × fade ----
function BagMap({ bag }: { bag: ReturnType<typeof bagMeasured> }) {
  const lo = Math.min(120, bag.minD - 20), hi = Math.max(340, bag.maxD + 20), span = hi - lo;
  const x = (d: number) => 34 + ((d - lo) / span) * 258;
  const stabs = bag.discs.map((d) => d.stability); const smin = Math.min(-1, ...stabs), smax = Math.max(3, ...stabs), sspan = smax - smin || 1;
  const y = (s: number) => 26 + ((s - smin) / sspan) * 196;
  const col = (s: number) => (s < -0.5 ? "#7A8FA8" : s <= 1.5 ? "#3EA88F" : "#B5544A");
  return (
    <svg viewBox="0 0 300 250" style={svgFill}>
      <line x1="34" y1="228" x2="292" y2="228" stroke={GRID} strokeWidth="1" /><line x1="34" y1="10" x2="34" y2="228" stroke={GRID} strokeWidth="1" />
      <text x="34" y="244" fill="#2A362D" fontSize="8.5" style={MONO}>{Math.round(lo)}</text>
      <text x="278" y="244" fill="#2A362D" fontSize="8.5" style={MONO}>{Math.round(hi)} ft</text>
      <text x="6" y="26" fill="#2A362D" fontSize="8.5" style={MONO}>over</text><text x="4" y="220" fill="#2A362D" fontSize="8.5" style={MONO}>under</text>
      {bag.gap && <><rect x={x(bag.gap.lo)} y="26" width={x(bag.gap.hi) - x(bag.gap.lo)} height="196" fill={SALMON} opacity="0.07" /><text x={(x(bag.gap.lo) + x(bag.gap.hi)) / 2} y="122" fill={SALMON} fontSize="9" style={MONO} textAnchor="middle" opacity="0.8">gap</text></>}
      {bag.discs.map((d) => <g key={d.name}><circle cx={x(d.distance)} cy={y(d.stability)} r="8" fill={col(d.stability)} /><text x={x(d.distance)} y={y(d.stability) + 20} fill="#5E6E5C" fontSize="8" style={{ fontFamily: "Sora,sans-serif" }} textAnchor="middle">{d.name.length > 8 ? d.name.slice(0, 7) + "…" : d.name}</text></g>)}
    </svg>
  );
}

// ---- 4. cumulative strokes gained ----
function CumulativeSG({ sg }: { sg: NonNullable<ReturnType<typeof latestSGRound>>["sg"] }) {
  const W = 460, H = 150, x0 = 20, x1 = 440, mid = 75;
  const n = sg.cumulative.length;
  const cap = Math.max(3, ...sg.cumulative.map((c) => Math.abs(c.val)));
  const x = (i: number) => x0 + (i / (n - 1)) * (x1 - x0);
  const y = (v: number) => mid - (v / cap) * 55;
  const line = sg.cumulative.map((c, i) => `${x(i)},${y(c.val)}`).join(" ");
  const area = `M${x(0)},${mid} ${sg.cumulative.map((c, i) => `L${x(i)},${y(c.val)}`).join(" ")} L${x(n - 1)},${mid} Z`;
  const worstI = sg.perHole.findIndex((p) => p.hole === sg.worst.hole);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={svgFill}>
        <line x1="10" y1={mid} x2="452" y2={mid} stroke={GRID} strokeWidth="1" />
        <text x="6" y="20" fill="#2A362D" fontSize="8.5" style={MONO}>+{Math.round(cap)}</text><text x="6" y="140" fill="#2A362D" fontSize="8.5" style={MONO}>{"−"}{Math.round(cap)}</text>
        <defs><linearGradient id="sgUp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SAGE} stopOpacity="0.16" /><stop offset="100%" stopColor={SAGE} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#sgUp)" />
        <polyline points={line} fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {worstI >= 0 && <><circle cx={x(worstI)} cy={y(sg.cumulative[worstI].val)} r="4.5" fill={SALMON} /><text x={x(worstI)} y={y(sg.cumulative[worstI].val) + 20} fill={SALMON} fontSize="9" style={MONO} textAnchor="middle">hole {sg.worst.hole}</text></>}
        <circle cx={x(n - 1)} cy={y(sg.cumulative[n - 1].val)} r="4" fill={GOLD} />
      </svg>
      <div className="mt-1.5 flex"><span className="flex-1" style={{ ...MONO, fontSize: 9, color: "#2A362D" }}>HOLE {sg.perHole[0].hole}</span><span style={{ ...MONO, fontSize: 9, color: "#2A362D" }}>HOLE {sg.perHole[n - 1].hole}</span></div>
    </div>
  );
}

// The app's real disc-golf basket (public/basket-icon.svg), tinted and scaled to sit at the pin.
function BasketMark({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
  const sc = size / 160;
  return (
    <g transform={`translate(${x - 80 * sc} ${y - 66 * sc}) scale(${sc})`} fill={color}>
      <path d="M85.4,47.93h13.64c.55,0,.99.48,1.05.95l.03,4.86c0,.5-.24,1.04-.56,1.43-.4,4.82-.99,9.53-2.11,14.28-1.62,6.26-3.54,11.15-7.55,16.31l14.51.05c.33,0,.84.18.99.38.18.22.33.89.22,1.2l-4.27,12.06c-.49.9-1.43,1.29-2.51,1.29l-16.77.03.42,25.26c-1.69.17-3.02.15-4.82.07l.28-25.32-16.99-.02c-.94,0-1.79-.44-2.27-1.16l-4.3-12.2c-.09-.24,0-.9.13-1.1.17-.23.68-.48,1.07-.48l14.39-.05c-4.76-6.2-6.76-12.58-8.31-20.1-.55-3.49-.93-7.01-1.2-10.46-.19-.23-.62-.73-.62-.98v-5.13c0-.64.43-1.16,1.09-1.16h17.99M81.05,47.93h4.35M81.05,46.84v1.09M78.96,49.95l-.03-14.44c0-.67.29-1.19.81-1.26.8-.11,1.33.28,1.33,1.03v14.69M78.94,47.93v-1.09M73.47,85.6c-1.51-2.69-2.53-5.24-3.31-8.17-1.93-7.26-2.7-14.59-2.72-22.17l-5.15-.03c.55,10.14,2.93,22.66,9.99,30.42l1.19-.05ZM73.87,55.25h-4.71c-.02,6.98.77,13.67,2.31,20.4.82,3.58,2.1,6.86,3.96,10l1.4-.06c-2.87-9.89-2.89-20.25-2.96-30.34ZM77.99,83.52l.16-28.28h-2.58c-.04,4.65.05,9.03.31,13.66.43,4.99.81,9.89,2.11,14.63h0ZM83.68,74.41c.63-6.42.89-12.65.86-19.14h-2.67l.11,28.73c1.01-3.15,1.25-6.31,1.7-9.59ZM84.71,85.53c2.26-3.72,3.48-7.6,4.33-11.74,1.27-6.14,1.74-12.2,1.83-18.53l-4.64-.02c.01,7.7-.31,15.3-1.37,22.97-.36,2.61-.95,4.92-1.71,7.42.44.07,1.22.08,1.55-.1h0ZM87.74,85.52c7.09-7.86,9.35-20.13,10-30.28h-5.13c-.31,9.78-1.19,21.81-6.04,30.36.19.1.97.15,1.17-.09h0ZM77.85,87.47l-1.15.09,1.2,1.58-.06-1.68h.01ZM66.38,92.5l-1.39-4.87-8.48.02,1.79,4.85h8.08ZM77.83,91.02c-2.54-.5-4.48-1.63-6-3.4l-5.19.02,1.31,4.89,9.96.09c.03-.58.02-1.19-.08-1.59ZM83.31,87.62l-1.17-.08-.04,1.53,1.22-1.45h-.01ZM92.05,92.54l1.38-4.88-5.15-.05c-1.68,1.74-3.73,2.84-6.21,3.36l.03,1.63,9.94-.06h.01ZM101.76,92.5l1.7-4.85h-8.42l-1.39,4.85h8.11ZM68.01,98.26l-1.05-3.92-8.03.02,1.47,3.87,7.6.03h.01ZM77.97,98.25l-.03-3.92h-9.45l.98,3.94s8.5-.02,8.5-.02ZM90.6,98.27l.97-3.93-9.52-.02v3.94h8.54s0,0,0,0ZM99.92,97.44l1.07-3.1h-7.94l-1.04,3.91h7.08c.28,0,.72-.52.82-.81h.01Z" />
      <path d="M81.88,47.41h19.52c.49,0,.89.4.89.89v6.72c0,.49-.4.89-.89.89h-42.32c-.49,0-.89-.4-.89-.9v-6.72c0-.49.4-.89.89-.89h22.81" />
      <polygon points="94.05 37.68 80.02 42.21 79.97 34.23 94.05 37.68" />
    </g>
  );
}

// ---- 5. putt green — perspective fan around the basket, made vs missed, with C1/C2 make rates ----
function PuttGreen({ data }: { data: ReturnType<typeof puttGreen> }) {
  const W = 340, H = 156, cx = 170, cy = 140, RX = 165, RY = 122, FAN = (78 * Math.PI) / 180;
  const c1x = 100, c1y = 74; // C1 (33 ft) ellipse radii
  const c1Pct = data.c1Att ? Math.round((data.c1Made / data.c1Att) * 100) : null;
  const c2Pct = data.c2Att ? Math.round((data.c2Made / data.c2Att) * 100) : null;
  // even, low-discrepancy fan placement so same-distance putts spread across the green (no arcs)
  const place = (p: { distance: number }, i: number) => {
    const f = Math.min(1, p.distance / 66);
    const frac = ((i + 0.5) * 0.6180339887) % 1;
    const theta = (frac * 2 - 1) * FAN;
    const jit = 1 + (((i * 37) % 11) / 11 - 0.5) * 0.05;
    return [cx + Math.sin(theta) * RX * f * jit, cy - Math.cos(theta) * RY * f * jit] as const;
  };
  const arc = (rx: number, ry: number) => `M${cx - rx},${cy} A${rx},${ry} 0 0 1 ${cx + rx},${cy}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={svgFill}>
      {/* green rings */}
      <path d={arc(RX, RY)} fill="none" stroke={GRID} strokeWidth="1.2" />
      <path d={arc(c1x, c1y)} fill="none" stroke="#243029" strokeWidth="1.2" />
      <text x={cx + RX * 0.62} y={cy - RY * 0.66} fill="#39493C" fontSize="9" style={MONO}>C2{c2Pct != null ? ` · ${c2Pct}%` : ""}</text>
      <text x={cx + c1x * 0.5} y={cy - c1y * 0.72} fill="#4A5A48" fontSize="9" style={MONO}>C1{c1Pct != null ? ` · ${c1Pct}%` : ""}</text>
      {/* missed first (under), then made on top */}
      {data.points.map((p, i) => p.made ? null : (() => { const [px, py] = place(p, i); return <circle key={`m${i}`} cx={px} cy={py} r="4" fill="none" stroke={SALMON} strokeWidth="1.5" opacity="0.75" />; })())}
      {data.points.map((p, i) => p.made ? (() => { const [px, py] = place(p, i); return <circle key={`k${i}`} cx={px} cy={py} r="4" fill={GOLD} opacity="0.92" />; })() : null)}
      <BasketMark x={cx} y={cy} size={92} color={GOLD} />
      {/* legend */}
      <g transform={`translate(8 ${H - 8})`} style={MONO}>
        <circle cx="5" cy="-4" r="4" fill={GOLD} opacity="0.92" /><text x="14" y="-1" fill={SAGE} fontSize="9">made</text>
        <circle cx="58" cy="-4" r="4" fill="none" stroke={SALMON} strokeWidth="1.5" opacity="0.75" /><text x="67" y="-1" fill={SAGE} fontSize="9">missed</text>
      </g>
    </svg>
  );
}
