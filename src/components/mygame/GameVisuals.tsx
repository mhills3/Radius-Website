"use client";

import { useMemo } from "react";
import type { DecodedRound } from "@/lib/rounds";
import type { RangeSession } from "@/lib/sessions";
import type { DbDisc } from "@/lib/bag";
import { driveDispersion, bagMeasured, holeByHole, latestSGRound, puttGreen } from "@/lib/gameViz";

const HEAD = "font-[family-name:var(--font-heading)]";
const BODY = "font-[family-name:var(--font-body)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const INK = "#F4F1E8", GOLD = "#E8B560", SALMON = "#C87F6A", EB = "#4A5A48", DIM = "#3E4B3F", SAGE = "#8FA08A", GRID = "#1B241E", HAIR = "rgba(244,241,232,0.08)";
const eb = `${HEAD} text-[9px] font-black uppercase tracking-[0.22em]`;
const Hair = () => <div style={{ height: 1, background: HAIR }} className="my-8" />;
function Head({ label, sub }: { label: string; sub: string }) {
  return <div className="mb-4"><div className={eb} style={{ color: EB }}>{label}</div><div className={`${BODY} mt-1.5 text-[10.5px]`} style={{ color: DIM }}>{sub}</div></div>;
}
function Caption({ children }: { children: React.ReactNode }) {
  return <div className={`${BODY} mt-3.5 text-[12.5px] leading-[1.6]`} style={{ color: SAGE }}>{children}</div>;
}

// avg score-to-par → colour (green under, warm over)
function holeColor(v: number): string {
  const t = Math.max(-1, Math.min(1, v));
  if (t <= 0) { const k = -t; return `rgb(${Math.round(42 + k * 65)},${Math.round(58 + k * 80)},${Math.round(44 + k * 50)})`; }
  return `rgb(${Math.round(42 + t * 118)},${Math.round(58 - t * 20)},${Math.round(44 - t * 6)})`;
}
const relLabel = (v: number) => { if (Math.abs(v) < 0.05) return ".0"; const s = v < 0 ? "−" : "+"; return s + Math.abs(v).toFixed(1).replace(/^0/, ""); };

export default function GameVisuals({ iq, rankText, meta, insight, rounds, range, catalog, putterNames }: {
  iq: number; rankText: string; meta: string; insight: string; rounds: DecodedRound[]; range: RangeSession[]; catalog: DbDisc[]; putterNames: Set<string>;
}) {
  const disp = useMemo(() => driveDispersion(rounds, range), [rounds, range]);
  const bag = useMemo(() => bagMeasured(rounds, catalog), [rounds, catalog]);
  const hbh = useMemo(() => holeByHole(rounds), [rounds]);
  const rsg = useMemo(() => latestSGRound(rounds), [rounds]);
  const putts = useMemo(() => puttGreen(rounds, putterNames), [rounds, putterNames]);

  return (
    <div>
      {/* header — Game IQ */}
      <div className="mb-6">
        <div className={eb} style={{ color: EB }}>Game IQ</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span style={{ ...MONO, fontSize: 38, fontWeight: 700, color: INK, lineHeight: 1, letterSpacing: "-0.02em" }}>{iq}</span>
          <span style={{ ...MONO, fontSize: 12.5, color: SAGE }}>{rankText}</span>
          <span className="ml-auto" style={{ ...MONO, fontSize: 11, color: EB }}>{meta}</span>
        </div>
      </div>
      <p className={BODY} style={{ color: INK, fontSize: 20, lineHeight: 1.5, maxWidth: 640, marginBottom: 4 }}>{insight}</p>
      <Hair />

      {/* row 1: dispersion + bag */}
      <div className="flex flex-col gap-11 lg:flex-row">
        <div className="min-w-0 flex-1">
          <Head label="Where your drives land" sub={`${disp.count} measured tee shots, relative to the target line`} />
          {disp.count >= 4 ? <><Dispersion disp={disp} /><Caption>{Math.abs(disp.avgOffset) >= 6 ? <>Your average drive lands <b style={{ color: INK }}>{Math.abs(Math.round(disp.avgOffset))} ft {disp.avgOffset > 0 ? "right" : "left"}</b> of target. That&apos;s a consistent aim bias, not spray.</> : "Your drives sit right on the target line — no aim bias to correct."}</Caption></>
            : <Empty>Play GPS-tracked rounds (or run a measured range session) and your drive dispersion plots here.</Empty>}
        </div>
        <div className="min-w-0 flex-1">
          <Head label="Your bag, measured" sub="Actual distance and fade, with the gaps" />
          {bag.discs.length >= 3 ? <><BagMap bag={bag} /><Caption>{bag.gap ? <>Nothing covers <b style={{ color: INK }}>{bag.gap.lo}–{bag.gap.hi} ft</b>. That&apos;s a slot you throw around instead of through.</> : "Your distances ladder up cleanly — no obvious gaps in the bag."}</Caption></>
            : <Empty>Throw a few more discs off the tee and your measured distance ladder builds here.</Empty>}
        </div>
      </div>
      <Hair />

      {/* hole by hole */}
      {hbh ? (
        <>
          <Head label="Hole by hole, all rounds" sub={`${hbh.courseName} · average score to par on each hole`} />
          <div className="flex" style={{ gap: 5 }}>
            {hbh.holes.map((h) => { const notable = Math.abs(h.avgRel) >= 0.05; return (
              <div key={h.hole} className="flex flex-1 flex-col items-center justify-center rounded-[4px]" style={{ height: 56, background: holeColor(h.avgRel) }}>
                <span style={{ ...MONO, fontSize: 10, color: notable ? INK : SAGE }}>{h.hole}</span>
                <span style={{ ...MONO, fontSize: 11, fontWeight: 700, marginTop: 3, color: notable ? (h.avgRel < 0 ? "#C9D2C4" : INK) : SAGE }}>{relLabel(h.avgRel)}</span>
              </div>
            ); })}
          </div>
          {hbh.worst && hbh.best && <Caption>Hole {hbh.worst.hole} costs you {hbh.worst.avgRel >= 0.6 ? "a full stroke" : `${relLabel(hbh.worst.avgRel)}`} every time you play it. Hole {hbh.best.hole} gives one back.</Caption>}
          <Hair />
        </>
      ) : null}

      {/* row 2: cumulative SG + putt green */}
      <div className="flex flex-col gap-11 lg:flex-row">
        <div className="min-w-0" style={{ flex: 1.3 }}>
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
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) { return <div className={`${BODY} flex min-h-[180px] items-center text-[12.5px] leading-[1.6]`} style={{ color: DIM, maxWidth: 320 }}>{children}</div>; }

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
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 250 }}>
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
    <svg viewBox="0 0 300 250" style={{ width: "100%", height: 250 }}>
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
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 150 }}>
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

// ---- 5. putt green ----
function PuttGreen({ data }: { data: ReturnType<typeof puttGreen> }) {
  const cx = 130, cy = 168, C1 = 66, C2 = 128; // px radii for 33 / 66 ft
  const pos = (d: number, a: number) => { const r = Math.min(C2, (d / 66) * C2); return [cx + Math.sin(a) * r, cy - Math.abs(Math.cos(a)) * r] as const; };
  return (
    <svg viewBox="0 0 260 190" style={{ width: "100%", height: 190 }}>
      <circle cx={cx} cy={cy} r={C2} fill="none" stroke={GRID} strokeWidth="1" /><circle cx={cx} cy={cy} r={C1} fill="none" stroke="#22302A" strokeWidth="1" />
      <text x={cx + 66} y="60" fill="#2A362D" fontSize="8.5" style={MONO}>C2</text><text x={cx + 20} y="108" fill="#2A362D" fontSize="8.5" style={MONO}>C1</text>
      <g stroke={GOLD} strokeWidth="1.6" fill="none"><line x1={cx} y1={cy - 14} x2={cx} y2={cy + 14} /><path d={`M${cx - 9} ${cy - 6} L${cx + 9} ${cy - 6} L${cx + 7} ${cy + 4} L${cx - 7} ${cy + 4} Z`} /><ellipse cx={cx} cy={cy - 6} rx="9" ry="2.6" /></g>
      {data.points.map((p, i) => { const [px, py] = pos(p.distance, p.angle); return p.made
        ? <circle key={i} cx={px} cy={py} r="3.1" fill={GOLD} opacity="0.9" />
        : <circle key={i} cx={px} cy={py} r="3.1" fill="none" stroke={SALMON} strokeWidth="1.5" />; })}
    </svg>
  );
}
