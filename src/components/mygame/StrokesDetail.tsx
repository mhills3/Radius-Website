"use client";

import { useEffect } from "react";
import type { StrokesGained, PuttBand } from "@/lib/rounds";

const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const GOLD = "#E8B560", GREEN = "#8FBF9A";

export type StrokesCategory = "putting" | "tee" | "approach";

function DetailHero({ title, value, unit, sub }: { title: string; value: string; unit?: string; sub?: string }) {
  return (
    <div>
      <div className={`${HEAD} text-[18px] font-black text-[var(--cream)]`}>{title}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`${HEAD} text-[44px] font-black leading-none tracking-[-0.02em] text-[var(--cream)]`} style={MONO}>{value}</span>
        {unit && <span className="text-[15px] font-medium text-white/55" style={MONO}>{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-white/45" style={MONO}>{sub}</div>}
    </div>
  );
}
const DetailSection = ({ children }: { children: string }) => <div className={`${HEAD} text-[10px] font-black uppercase tracking-[0.12em] text-white/50`}>{children}</div>;
const DetailCard = ({ children }: { children: React.ReactNode }) => <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">{children}</div>;
function DetailTile({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="flex-1 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-3.5">
      <div className="flex items-baseline gap-1"><span className={`${HEAD} text-[22px] font-bold text-[var(--cream)]`} style={MONO}>{value}</span>{unit && <span className="text-[11px] text-white/45" style={MONO}>{unit}</span>}</div>
      <div className={`${HEAD} mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/40`}>{label}</div>
    </div>
  );
}

// Make-rate-by-distance curve (iOS PuttCurveChart): gold line across the 4 bands, gap where < 5 attempts.
function PuttCurveChart({ bands }: { bands: PuttBand[] }) {
  const w = 300, h = 150, padX = 6, padTop = 16, padBot = 22;
  const pts = bands.map((b) => (b.attempts >= 5 ? Math.round((b.made / b.attempts) * 100) : null));
  const x = (i: number) => padX + (i / (bands.length - 1)) * (w - 2 * padX);
  const y = (v: number) => padTop + (1 - v / 100) * (h - padTop - padBot);
  // build segments over non-null runs
  const segs: string[] = [];
  let run: string[] = [];
  pts.forEach((v, i) => { if (v == null) { if (run.length > 1) segs.push(run.join(" ")); run = []; } else run.push(`${x(i)},${y(v)}`); });
  if (run.length > 1) segs.push(run.join(" "));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="block">
      {[25, 50, 75, 100].map((g) => <line key={g} x1={padX} y1={y(g)} x2={w - padX} y2={y(g)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />)}
      {segs.map((s, i) => <polyline key={i} points={s} fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
      {pts.map((v, i) => v == null ? null : (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="4.5" fill={GOLD} />
          <text x={x(i)} y={v < 50 ? y(v) - 9 : y(v) + 16} textAnchor="middle" style={{ ...MONO, fontSize: 11, fontWeight: 700, fill: "var(--cream)" }}>{v}%</text>
        </g>
      ))}
      {bands.map((b, i) => <text key={b.label} x={x(i)} y={h - 5} textAnchor="middle" style={{ ...MONO, fontSize: 10, fill: "rgba(255,255,255,0.4)" }}>{b.label}</text>)}
    </svg>
  );
}

const spelledBand = ["from 15 to 22 ft", "from 22 to 33 ft", "from 33 ft to C2"];
function steepestDrop(bands: PuttBand[]): string | null {
  const p = bands.map((b) => (b.attempts >= 5 ? b.made / b.attempts : null));
  let worst = -1, drop = 0;
  for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i]; if (a != null && b != null && a - b > drop) { drop = a - b; worst = i - 1; } }
  return worst >= 0 ? `Your curve drops off hardest ${spelledBand[worst]}.` : null;
}

// tee dispersion from L/R miss counts
function Dispersion({ left, right }: { left: number; right: number }) {
  const total = left + right;
  const bias = total ? (right - left) / total : 0; // -1 left .. +1 right
  const w = Math.abs(bias) * 46;
  const dom = Math.abs(bias) < 0.15 ? "center" : bias > 0 ? "right" : "left";
  return (
    <div>
      <div className="relative h-2 rounded-full bg-white/[0.06]">
        <span className="absolute left-1/2 top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded bg-white/25" />
        <span className="absolute top-0 h-full rounded-full" style={{ left: bias >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, background: GOLD }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-white/40" style={MONO}><span>left</span><span>right</span></div>
      <div className="mt-2 text-[13px] text-[var(--cream)]">{total < 4 ? "Log a few more tee misses to read your dispersion." : dom === "center" ? "Tight and centered — your line off the tee holds up." : `Your misses lean ${dom} (${dom === "right" ? right : left} of ${total}) — aim the line, not the power.`}</div>
    </div>
  );
}

export default function StrokesDetail({ cat, sg, missLeft, missRight, onClose }: { cat: StrokesCategory; sg: StrokesGained; missLeft: number; missRight: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const worstProx = Math.max(0, ...sg.proxBands.filter((b) => b.count >= 5).map((b) => b.avg));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#111813] animate-[fadeIn_0.25s_ease]">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/30 text-[var(--sage)] transition-colors hover:text-[var(--cream)]">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="space-y-5 overflow-y-auto p-6">
          {cat === "putting" && (
            <>
              <DetailHero title="Putting" value={`${sg.c1xPct}%`} unit="C1X make rate" sub={`${sg.puttAttemptsTotal} putts · ${sg.roundsWithShotData} rounds`} />
              <div>
                <DetailSection>Make rate by distance</DetailSection>
                <div className="mt-3"><DetailCard><PuttCurveChart bands={sg.puttBands} /></DetailCard></div>
                {steepestDrop(sg.puttBands) && <p className="mt-3 text-[13px] leading-relaxed text-[var(--cream)]">{steepestDrop(sg.puttBands)}</p>}
              </div>
              <MissZones zones={sg.missZones} />
            </>
          )}

          {cat === "tee" && (
            <>
              <DetailHero title="Off the tee" value={`${sg.teeFairwayPct}%`} unit="fairway hit" sub={`${sg.teeObPct}% OB · ${sg.teeAttempts} tee shots`} />
              {sg.driveCount >= 5 && (
                <div className="flex gap-3">
                  <DetailTile value={`${sg.driveAvg}`} unit="ft" label="Average" />
                  <DetailTile value={`${sg.driveMax}`} unit="ft" label="Longest" />
                </div>
              )}
              <div>
                <DetailSection>Dispersion</DetailSection>
                <div className="mt-3"><DetailCard><Dispersion left={missLeft} right={missRight} /></DetailCard></div>
              </div>
              {sg.teeDiscs.length > 0 && (
                <div>
                  <DetailSection>Distance by disc</DetailSection>
                  <div className="mt-3"><DetailCard>
                    <div className="space-y-2.5">
                      {sg.teeDiscs.slice(0, 6).map((d) => (
                        <div key={d.name} className="flex items-center justify-between gap-3">
                          <span className={`${HEAD} truncate text-[14px] font-bold text-[var(--cream)]`}>{d.name}</span>
                          <span className="shrink-0 text-[12px] text-white/55" style={MONO}>{d.avg ? `${d.avg} ft · ` : ""}{d.inPlayPct}% in play</span>
                        </div>
                      ))}
                    </div>
                  </DetailCard></div>
                </div>
              )}
            </>
          )}

          {cat === "approach" && (
            <>
              <DetailHero title="Approach" value={`${sg.proximityAvgFt} ft`} unit="avg leave" sub={`${sg.approachCount} approaches measured`} />
              <div>
                <div className="flex items-baseline justify-between">
                  <DetailSection>Average leave by distance</DetailSection>
                  <span className="text-[10px] text-white/35">shorter is better</span>
                </div>
                <div className="mt-3"><DetailCard>
                  <div className="space-y-3.5">
                    {sg.proxBands.map((b) => {
                      const worst = b.count >= 5 && b.avg === worstProx && worstProx > 0;
                      const frac = worstProx ? Math.max(0.06, b.avg / worstProx) : 0;
                      return (
                        <div key={b.label}>
                          <div className="flex items-baseline justify-between">
                            <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--cream)]">{b.label}{worst && <span className="text-[9px] font-black uppercase tracking-wide text-[var(--gold)]">Worst</span>}</span>
                            <span className="text-[12px] text-white/55" style={MONO}>{b.count >= 5 ? `${b.avg} ft` : `${b.count} of 5 needed`}</span>
                          </div>
                          {b.count >= 5 && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${frac * 100}%`, background: worst ? GOLD : GREEN }} /></div>}
                        </div>
                      );
                    })}
                  </div>
                </DetailCard></div>
              </div>
              {sg.scrambleOpps >= 5 && (
                <div>
                  <DetailSection>Around the green</DetailSection>
                  <div className="mt-3"><DetailCard>
                    <div className="flex items-baseline gap-1"><span className={`${HEAD} text-[26px] font-bold text-[var(--cream)]`} style={MONO}>{sg.scramblePct}</span><span className="text-[13px] text-white/45">%</span></div>
                    <div className={`${HEAD} mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/40`}>Save rate · {sg.scrambled} of {sg.scrambleOpps} saved</div>
                  </DetailCard></div>
                </div>
              )}
              {sg.approachDiscs.length > 0 && (
                <div>
                  <DetailSection>Discs used here</DetailSection>
                  <div className="mt-3"><DetailCard>
                    <div className="space-y-2.5">
                      {sg.approachDiscs.slice(0, 5).map((d) => (
                        <div key={d.name} className="flex items-center justify-between gap-3">
                          <span className={`${HEAD} truncate text-[14px] font-bold text-[var(--cream)]`}>{d.name} <span className="text-[11px] font-normal text-white/40" style={MONO}>· {d.count}</span></span>
                          <span className="shrink-0 text-[12px] text-white/55" style={MONO}>{d.avg} ft avg</span>
                        </div>
                      ))}
                    </div>
                  </DetailCard></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 3×3 putt-miss strike zone from tapped-miss counts.
function MissZones({ zones }: { zones: Record<string, number> }) {
  const total = Object.values(zones).reduce((s, n) => s + n, 0);
  const rows = ["high", "mid", "low"], cols = ["left", "center", "right"];
  const at = (r: string, c: string) => zones[`${r}-${c}`] ?? 0;
  return (
    <div>
      <DetailSection>Where misses go</DetailSection>
      {total === 0 ? (
        <p className="mt-2 text-[12.5px] leading-relaxed text-white/45">Tap where each missed C1X putt hit the strike zone in the app — your all-time miss map builds here.</p>
      ) : (
        <div className="mt-3">
          <div className="grid grid-cols-3 gap-1.5">
            {rows.map((r) => cols.map((c) => {
              const n = at(r, c), f = total ? n / total : 0;
              return <div key={`${r}-${c}`} className="grid aspect-[3/2] place-items-center rounded-lg" style={{ background: `rgba(224,71,63,${0.08 + f * 0.5})`, border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-[13px] font-bold text-[var(--cream)]" style={MONO}>{n || ""}</span>
              </div>;
            }))}
          </div>
          <div className="mt-2 text-[11px] text-white/40" style={MONO}>{total} tapped miss{total === 1 ? "" : "es"}</div>
        </div>
      )}
    </div>
  );
}
