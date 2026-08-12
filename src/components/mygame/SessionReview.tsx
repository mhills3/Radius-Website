"use client";

import { useEffect, useMemo, useState } from "react";
import type { PuttingSession, RangeSession } from "@/lib/sessions";

const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const GOLD = "#E8B560", GREEN = "#5fcf80", ORANGE = "#e0873f", RED = "#e0473f";
const eyebrow = `${HEAD} text-[9px] font-black uppercase tracking-[0.2em] text-[#4A5A48]`;
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "—");

function Stat({ value, unit, label, color = "var(--cream)" }: { value: string; unit?: string; label: string; color?: string }) {
  return (
    <div className="flex-1">
      <div className="flex items-baseline gap-0.5"><span className={`${HEAD} text-[22px] font-black leading-none`} style={{ ...MONO, color }}>{value}</span>{unit && <span className="text-[11px] text-white/40" style={MONO}>{unit}</span>}</div>
      <div className={`${HEAD} mt-1.5 text-[8.5px] font-black uppercase tracking-[0.14em] text-white/40`}>{label}</div>
    </div>
  );
}
const Hair = () => <div className="h-px bg-[#17201A]" />;
const Section = ({ children }: { children: string }) => <div className={eyebrow}>{children}</div>;

function Shell({ title, sub, onClose, onBack, children }: { title: string; sub?: string; onClose: () => void; onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#0C1310] animate-[fadeIn_0.25s_ease]">
        <div className="flex items-start justify-between gap-3 border-b border-[#17201A] px-6 py-5">
          <div className="flex items-center gap-3">
            {onBack && <button onClick={onBack} aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-[var(--sage)] transition-colors hover:text-[var(--cream)]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>}
            <div>
              <div className={`${HEAD} text-[18px] font-black text-[var(--cream)]`}>{title}</div>
              {sub && <div className="mt-0.5 text-[11.5px] text-[#8FA08A]" style={MONO}>{sub}</div>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-[var(--sage)] transition-colors hover:text-[var(--cream)]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="space-y-6 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function ZoneRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? count / total : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[12px] text-[var(--cream)]/85">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} /></div>
      <span className="w-16 shrink-0 text-right text-[11px] text-white/50" style={MONO}>{count} · {Math.round(pct * 100)}%</span>
    </div>
  );
}

function RangeDetail({ session, prev, onClose, onBack }: { session: RangeSession; prev?: RangeSession; onClose: () => void; onBack: () => void }) {
  const z = (name: string) => session.shots.filter((s) => s.zone === name).length;
  const fairwayColor = session.fairwayPct >= 0.7 ? GREEN : ORANGE;
  const longest = session.shots.reduce((m, s) => (s.distanceFeet > (m?.distanceFeet ?? -1) ? s : m), session.shots[0]);
  const accurate = session.perDisc.filter((d) => d.count >= 2).sort((a, b) => Math.abs(a.avgOffset) - Math.abs(b.avgOffset))[0];
  const maxScale = Math.max(400, session.maxDistance);
  return (
    <Shell title="Range session" sub={`${fmtDate(session.date)}${session.locationName ? ` · ${session.locationName}` : ""}`} onClose={onClose} onBack={onBack}>
      <div className="flex gap-3">
        <Stat value={`${session.throwCount}`} label="Throws" />
        <Stat value={`${session.avgDistance}`} unit="ft" label="Avg" />
        <Stat value={`${session.maxDistance}`} unit="ft" label="Max" />
        <Stat value={`${Math.round(session.fairwayPct * 100)}`} unit="%" label="Fairway" color={fairwayColor} />
      </div>
      <Hair />
      {longest && (
        <div className="flex items-center justify-between"><div><Section>Longest throw</Section><div className={`${HEAD} mt-1.5 text-[15px] font-bold text-[var(--cream)]`}>{longest.discName}</div></div><span className={`${HEAD} text-[22px] font-black`} style={{ ...MONO, color: GOLD }}>{Math.round(longest.distanceFeet)}<span className="text-[12px] text-white/40"> ft</span></span></div>
      )}
      {accurate && (
        <div className="flex items-center justify-between"><div><Section>Most accurate</Section><div className={`${HEAD} mt-1.5 text-[15px] font-bold text-[var(--cream)]`}>{accurate.disc}</div></div><span className="text-[13px] text-white/55" style={MONO}>{Math.abs(accurate.avgOffset)} ft avg offset</span></div>
      )}
      <div>
        <Section>Accuracy spread</Section>
        <div className="mt-3 space-y-2.5">
          <ZoneRow label="Miss Left" count={z("Miss Left")} total={session.throwCount} color={RED} />
          <ZoneRow label="Left Fairway" count={z("Left Fairway")} total={session.throwCount} color={ORANGE} />
          <ZoneRow label="Center" count={z("Center")} total={session.throwCount} color={GREEN} />
          <ZoneRow label="Right Fairway" count={z("Right Fairway")} total={session.throwCount} color={ORANGE} />
          <ZoneRow label="Miss Right" count={z("Miss Right")} total={session.throwCount} color={RED} />
        </div>
      </div>
      {session.perDisc.length > 0 && (
        <div>
          <Section>Disc breakdown</Section>
          <div className="mt-3 space-y-3.5">
            {session.perDisc.map((d) => (
              <div key={d.disc}>
                <div className="flex items-baseline justify-between">
                  <span className={`${HEAD} text-[13.5px] font-bold text-[var(--cream)]`}>{d.disc} <span className="text-[11px] font-normal text-white/40" style={MONO}>· {d.count}</span></span>
                  <span className="text-[12px] text-white/55" style={MONO}>{d.avgDist} ft avg · max {d.maxDist}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[var(--gold)]/80" style={{ width: `${Math.min(100, (d.avgDist / maxScale) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {prev && (
        <>
          <Hair />
          <div>
            <Section>Vs previous session</Section>
            <div className="mt-2 flex gap-6 text-[13px]">
              <span className="text-white/70">Avg <b style={{ ...MONO, color: session.avgDistance >= prev.avgDistance ? GREEN : ORANGE }}>{session.avgDistance - prev.avgDistance >= 0 ? "+" : ""}{session.avgDistance - prev.avgDistance} ft</b></span>
              <span className="text-white/70">Fairway <b style={{ ...MONO, color: session.fairwayPct >= prev.fairwayPct ? GREEN : ORANGE }}>{Math.round((session.fairwayPct - prev.fairwayPct) * 100) >= 0 ? "+" : ""}{Math.round((session.fairwayPct - prev.fairwayPct) * 100)}%</b></span>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}

export default function SessionReview({ type, putting, range, onClose }: { type: "putting" | "range"; putting: PuttingSession[]; range: RangeSession[]; onClose: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && (openIdx != null ? setOpenIdx(null) : onClose()); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose, openIdx]);

  const putStats = useMemo(() => {
    const all = putting.flatMap((s) => s.putts);
    const att = all.length, makes = all.filter((p) => p.made).length;
    const c1 = all.filter((p) => p.distanceFeet <= 33), c2 = all.filter((p) => p.distanceFeet > 33 && p.distanceFeet <= 66);
    const bestStreak = putting.reduce((m, s) => Math.max(m, s.longestStreak), 0);
    const bestSession = putting.reduce((m, s) => Math.max(m, s.makePct), 0);
    const days = new Set(putting.map((s) => new Date(s.date).toDateString()));
    return { sessions: putting.length, att, makes, makePct: att ? makes / att : 0, c1: c1.length ? c1.filter((p) => p.made).length / c1.length : null, c2: c2.length ? c2.filter((p) => p.made).length / c2.length : null, bestStreak, bestSession, dayStreak: days.size };
  }, [putting]);

  if (type === "range") {
    if (openIdx != null && range[openIdx]) return <RangeDetail session={range[openIdx]} prev={range[openIdx + 1]} onClose={onClose} onBack={() => setOpenIdx(null)} />;
    return (
      <Shell title="Driving Range" sub={`${range.length} session${range.length === 1 ? "" : "s"} synced`} onClose={onClose}>
        {range.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-[#8FA08A]">No driving-range sessions synced yet. Run a measured range session in the Radius app and it&apos;ll show up here to review.</p>
        ) : range.map((s, i) => (
          <button key={s.id} onClick={() => setOpenIdx(i)} className="flex w-full items-center gap-4 border-b border-[#17201A] pb-4 text-left last:border-0">
            <div className="min-w-0 flex-1">
              <div className={`${HEAD} text-[14px] font-bold text-[var(--cream)]`}>{fmtDate(s.date)}{s.locationName ? <span className="font-normal text-white/40"> · {s.locationName}</span> : ""}</div>
              <div className="mt-1 text-[11.5px] text-white/50" style={MONO}>{s.throwCount} throws · {s.avgDistance} ft avg · {Math.round(s.fairwayPct * 100)}% fairway</div>
            </div>
            <span className={`${HEAD} shrink-0 text-[18px] font-black`} style={{ ...MONO, color: GOLD }}>{s.maxDistance}<span className="text-[10px] text-white/40"> max</span></span>
            <svg className="h-4 w-4 shrink-0 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        ))}
      </Shell>
    );
  }

  // putting
  return (
    <Shell title="Putting Practice" sub={`${putStats.sessions} session${putStats.sessions === 1 ? "" : "s"} synced`} onClose={onClose}>
      {putting.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-[#8FA08A]">No putting sessions synced yet. Log a putting practice session in the Radius app and your make rates, streaks and recent sets will show up here to review.</p>
      ) : (
        <>
          <div className="flex gap-3">
            <Stat value={`${putStats.sessions}`} label="Sessions" />
            <Stat value={`${putStats.makes}/${putStats.att}`} label="Putts" />
            <Stat value={`${Math.round(putStats.makePct * 100)}`} unit="%" label="Make rate" color={GOLD} />
          </div>
          <Hair />
          <div>
            <Section>Personal bests</Section>
            <div className="mt-3 flex gap-3">
              <Stat value={`${putStats.bestStreak}`} label="Make streak" />
              <Stat value={`${Math.round(putStats.bestSession * 100)}`} unit="%" label="Best session" />
              <Stat value={`${putStats.dayStreak}`} label="Days practiced" />
            </div>
          </div>
          <div>
            <Section>Make % by circle</Section>
            <div className="mt-3 space-y-3.5">
              {[{ l: "Circle 1 · ≤33 ft", v: putStats.c1 }, { l: "Circle 2 · 34–66 ft", v: putStats.c2 }].map((b) => (
                <div key={b.l}>
                  <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold text-[var(--cream)]">{b.l}</span><span className="text-[13px] font-bold" style={{ ...MONO, color: b.v == null ? "#4A5A48" : b.v >= 0.7 ? GREEN : b.v >= 0.4 ? GOLD : RED }}>{b.v == null ? "—" : `${Math.round(b.v * 100)}%`}</span></div>
                  {b.v != null && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${b.v * 100}%`, background: b.v >= 0.7 ? GREEN : b.v >= 0.4 ? GOLD : RED }} /></div>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <Section>Recent sessions</Section>
            <div className="mt-3 space-y-3.5">
              {putting.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b border-[#17201A] pb-3.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className={`${HEAD} text-[14px] font-bold text-[var(--cream)]`}>{s.drill}</div>
                    <div className="mt-0.5 text-[11px] text-white/45" style={MONO}>{fmtDate(s.date)} · {s.courseName ? `${s.courseName}${s.holeNumber != null ? ` · Hole ${s.holeNumber}` : ""}` : "Quick Practice"}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`${HEAD} text-[16px] font-black`} style={{ ...MONO, color: s.makePct >= 0.7 ? GREEN : s.makePct >= 0.4 ? GOLD : RED }}>{Math.round(s.makePct * 100)}%</div>
                    <div className="text-[10px] text-white/40" style={MONO}>{s.makes}/{s.attempts}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
