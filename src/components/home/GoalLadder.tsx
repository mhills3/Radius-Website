"use client";

import { useEffect, useRef, useState } from "react";

// The goal ladder: completed community goals become permanent plaques above
// the active bar, so the section reads as a track record, not a wish.
//
// First visit after a goal completes plays a one-time celebration. Every
// phase CROSS-FADES (both blocks stay mounted through the hand-off — no
// unmount flashes), the confetti layer sits OUTSIDE the bar's overflow-hidden
// (where v1 accidentally clipped it to a 10px strip), and the next goal's bar
// sweeps from 0 to its live percent as it enters. Repeat visits and
// reduced-motion users get the settled state instantly.

const COMPLETED = [
  { goal: 10_000, label: "10,000", story: "hit Sept 2026 — three months early" },
];
const ACTIVE = { goal: 50_000, label: "50,000", deadline: "end of 2027" };

const SEEN_KEY = "radius-celebrated-10k";
const GOLD_TEXT = "#9a7a3a";

// Timeline (ms from mount)
const T_STAMP = 1700;   // bar full → stamp line + confetti
const T_LEAVE = 3600;   // celebrate block starts fading out
const T_SETTLE = 4200;  // ladder fades in

function useCountUp(target: number, run: boolean, durationMs: number) {
  const [value, setValue] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) { setValue(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, durationMs]);
  return value;
}

function Confetti() {
  // 22 flecks burst from the bar's right end: up and out, then a gravity
  // fall with tumble. Brand colors only. Lives on an unclipped layer.
  const pieces = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none absolute right-2 top-0 z-10 h-0 w-0">
      {pieces.map((i) => {
        const angle = -150 + (i * 120) / 21; // fan over the upper arc
        const dist = 42 + ((i * 7) % 5) * 16;
        const rad = (angle * Math.PI) / 180;
        const colors = ["#16221b", "var(--gold)", "#e3a94d", "#cfa15a"];
        const w = i % 3 === 0 ? 7 : 5;
        return (
          <span
            key={i}
            className="goal-confetti absolute block rounded-[2px]"
            style={{
              width: w, height: Math.max(3, Math.round(w * 0.6)), background: colors[i % 4],
              animationDelay: `${(i % 6) * 55}ms`,
              animationDuration: `${1200 + (i % 4) * 180}ms`,
              ["--cx" as string]: `${Math.cos(rad) * dist}px`,
              ["--cy" as string]: `${Math.sin(rad) * dist - 26}px`,
              ["--fy" as string]: `${Math.sin(rad) * dist + 46}px`,
            }}
          />
        );
      })}
      <style>{`
        .goal-confetti { opacity: 0; animation-name: goal-confetti-arc; animation-timing-function: cubic-bezier(0.22, 0.9, 0.3, 1); animation-fill-mode: forwards; }
        @keyframes goal-confetti-arc {
          0%   { opacity: 0; transform: translate(0, 4px) scale(0.3) rotate(0deg); }
          12%  { opacity: 1; }
          55%  { opacity: 1; transform: translate(var(--cx), var(--cy)) scale(1) rotate(200deg); }
          100% { opacity: 0; transform: translate(var(--cx), var(--fy)) scale(0.9) rotate(420deg); }
        }
      `}</style>
    </div>
  );
}

export default function GoalLadder({ playerCount }: { playerCount: number }) {
  // init → celebrate → stamp → leaving (celebrate fades out) → settled
  const [phase, setPhase] = useState<"init" | "celebrate" | "stamp" | "leaving" | "settled">("init");
  const [fill, setFill] = useState(0);         // old bar 0→100
  const [nextFill, setNextFill] = useState(0); // new bar 0→live pct
  const animated = useRef(false);

  const activePct = Math.min(100, (playerCount / ACTIVE.goal) * 100);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch { /* settled */ }
    if (reduced || seen || playerCount < COMPLETED[0].goal) {
      setPhase("settled"); setNextFill(activePct); return;
    }
    animated.current = true;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* fine */ }
    setPhase("celebrate");
    requestAnimationFrame(() => requestAnimationFrame(() => setFill(100)));
    const t1 = setTimeout(() => setPhase("stamp"), T_STAMP);
    const t2 = setTimeout(() => setPhase("leaving"), T_LEAVE);
    const t3 = setTimeout(() => {
      setPhase("settled");
      requestAnimationFrame(() => requestAnimationFrame(() => setNextFill(activePct)));
    }, T_SETTLE);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCount]);

  const oldCount = useCountUp(COMPLETED[0].goal, animated.current && (phase === "celebrate" || phase === "stamp" || phase === "leaving"), 1600);
  const showCelebrate = phase === "celebrate" || phase === "stamp" || phase === "leaving";

  if (phase === "init") return <div className="mt-8 max-w-md" style={{ minHeight: 120 }} />;

  return (
    <div className="relative mt-8 max-w-md" style={{ minHeight: 120 }}>
      {/* ── Celebration layer: Road to 10,000 fills one last time */}
      {showCelebrate && (
        <div
          className="absolute inset-x-0 top-0 transition-all duration-700 ease-out"
          style={phase === "leaving" ? { opacity: 0, transform: "translateY(-10px)" } : { opacity: 1, transform: "translateY(0)" }}
        >
          <div className="flex items-baseline justify-between whitespace-nowrap">
            <div className="font-[family-name:var(--font-heading)] text-sm font-extrabold tracking-tight">Road to 10,000</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: GOLD_TEXT }}>
              {phase === "celebrate" ? oldCount.toLocaleString() : "100% — done ✓"}
            </div>
          </div>
          <div className="relative">
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#16221b]/[0.08]">
              <div
                className={`h-full rounded-full bg-[linear-gradient(90deg,#e3a94d,var(--gold))] transition-[width] duration-[1600ms] ${phase !== "celebrate" ? "goal-bar-glow" : ""}`}
                style={{ width: `${fill}%`, transitionTimingFunction: "cubic-bezier(0.22, 0.9, 0.3, 1)" }}
              />
            </div>
            {/* confetti lives OUTSIDE the overflow-hidden bar */}
            {(phase === "stamp" || phase === "leaving") && <Confetti />}
          </div>
          <p
            className="mt-2.5 truncate text-sm font-semibold transition-all duration-700 ease-out"
            style={{ color: GOLD_TEXT, opacity: phase === "celebrate" ? 0 : 1, transform: phase === "celebrate" ? "translateY(6px)" : "translateY(0)" }}
          >
            ✓ Called for end of 2026 — hit three months early.
          </p>
          <style>{`
            .goal-bar-glow { animation: goal-glow 1400ms ease-out 1; }
            @keyframes goal-glow {
              0% { box-shadow: 0 0 0 0 rgba(227, 169, 77, 0.0); }
              30% { box-shadow: 0 0 18px 2px rgba(227, 169, 77, 0.55); }
              100% { box-shadow: 0 0 0 0 rgba(227, 169, 77, 0.0); }
            }
          `}</style>
        </div>
      )}

      {/* ── Settled layer: plaque + the next rung (fades up underneath) */}
      <div
        className="transition-all duration-700 ease-out"
        style={phase === "settled" ? { opacity: 1, transform: "translateY(0)" } : { opacity: 0, transform: "translateY(12px)", pointerEvents: "none" }}
        aria-hidden={phase !== "settled"}
      >
        {COMPLETED.map((m) => (
          <div key={m.goal} className="flex min-w-0 items-center gap-2 whitespace-nowrap">
            <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#16221b] text-[10px] font-bold leading-none text-[var(--gold)]">✓</span>
            <span className="font-[family-name:var(--font-heading)] text-sm font-extrabold tracking-tight">{m.label}</span>
            <span className="truncate text-sm text-[#6b7a70]">{m.story}</span>
          </div>
        ))}

        <div className="mt-5">
          <div className="flex items-baseline justify-between whitespace-nowrap">
            <div className="font-[family-name:var(--font-heading)] text-sm font-extrabold tracking-tight">Next stop: {ACTIVE.label}</div>
            <div className="text-sm font-bold" style={{ color: GOLD_TEXT }}>{Math.round(activePct)}% there</div>
          </div>
          <div
            role="progressbar"
            aria-label={`Progress toward ${ACTIVE.label} disc golfers`}
            aria-valuenow={playerCount}
            aria-valuemin={0}
            aria-valuemax={ACTIVE.goal}
            className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#16221b]/[0.08]"
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#e3a94d,var(--gold))] transition-[width] duration-[1200ms]"
              style={{ width: `${nextFill}%`, transitionTimingFunction: "cubic-bezier(0.22, 0.9, 0.3, 1)" }}
            />
          </div>
          <p className="mt-2.5 truncate text-sm text-[#6b7a70]">{ACTIVE.goal.toLocaleString()} by the {ACTIVE.deadline} — every player counts.</p>
        </div>
      </div>
    </div>
  );
}
