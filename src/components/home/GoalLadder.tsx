"use client";

import { useEffect, useRef, useState } from "react";

// The goal ladder: completed community goals become permanent plaques above
// the active bar, so the section reads as a track record, not a wish.
// Credibility compounds — every new goal inherits the ones already hit.
//
// First visit after a goal completes plays a one-time celebration (bar fills,
// confetti, plaque stamps in, next goal slides up). Repeat visits and
// reduced-motion users get the settled state instantly.

const COMPLETED = [
  {
    goal: 10_000,
    label: "10,000",
    story: "called for end of 2026 — hit September, six months after launch",
  },
];
const ACTIVE = { goal: 50_000, label: "50,000", deadline: "end of 2027" };

const SEEN_KEY = "radius-celebrated-10k";
const GOLD_TEXT = "#9a7a3a";

function useCountUp(target: number, run: boolean, durationMs: number) {
  const [value, setValue] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) { setValue(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, durationMs]);
  return value;
}

function Confetti() {
  // Fourteen gold/forest flecks arcing up from the end of the bar. Pure CSS,
  // one burst, pointer-events none — festive, not a casino.
  const pieces = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none absolute -top-1 right-0 h-0 w-0">
      {pieces.map((i) => {
        const angle = -100 + (i * 200) / 13; // fan: -100°..100°
        const dist = 34 + (i % 4) * 14;
        const color = i % 3 === 0 ? "#16221b" : i % 3 === 1 ? "var(--gold)" : "#e3a94d";
        return (
          <span
            key={i}
            className="goal-confetti absolute block h-1.5 w-1.5 rounded-[2px]"
            style={{
              background: color,
              transform: "translate(0,0)",
              animationDelay: `${(i % 5) * 40}ms`,
              ["--cx" as string]: `${Math.sin((angle * Math.PI) / 180) * dist}px`,
              ["--cy" as string]: `${-Math.abs(Math.cos((angle * Math.PI) / 180)) * dist - 10}px`,
            }}
          />
        );
      })}
      <style>{`
        .goal-confetti { opacity: 0; animation: goal-confetti-pop 900ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes goal-confetti-pop {
          0% { opacity: 0; transform: translate(0, 0) scale(0.4) rotate(0deg); }
          18% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--cx), var(--cy)) scale(1) rotate(260deg); }
        }
      `}</style>
    </div>
  );
}

export default function GoalLadder({ playerCount }: { playerCount: number }) {
  // phases: celebrate (old bar filling) → stamp (✓ + confetti) → settled (ladder + new bar)
  const [phase, setPhase] = useState<"init" | "celebrate" | "stamp" | "settled">("init");
  const [fill, setFill] = useState(0);
  const animated = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === "1"; } catch { /* settled */ }
    if (reduced || seen || playerCount < COMPLETED[0].goal) { setPhase("settled"); return; }
    animated.current = true;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* fine */ }
    setPhase("celebrate");
    requestAnimationFrame(() => requestAnimationFrame(() => setFill(100)));
    const t1 = setTimeout(() => setPhase("stamp"), 1400);
    const t2 = setTimeout(() => setPhase("settled"), 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [playerCount]);

  const celebrating = phase === "celebrate" || phase === "stamp";
  const oldCount = useCountUp(COMPLETED[0].goal, phase === "celebrate" && animated.current, 1300);
  const activePct = Math.min(100, (playerCount / ACTIVE.goal) * 100);
  const liveCount = useCountUp(playerCount, phase === "settled" && animated.current, 1100);

  if (phase === "init") {
    // One frame before the effect runs — render nothing moving.
    return <div className="mt-8 max-w-md" style={{ minHeight: 96 }} />;
  }

  return (
    <div className="mt-8 max-w-md">
      {/* ── The celebration: the finished Road to 10,000 filling one last time */}
      {celebrating && (
        <div className="transition-opacity duration-500">
          <div className="flex items-baseline justify-between">
            <div className="font-[family-name:var(--font-heading)] text-sm font-extrabold tracking-tight">Road to 10,000</div>
            <div className="text-sm font-bold" style={{ color: GOLD_TEXT }}>
              {phase === "stamp" ? "100% — done ✓" : `${oldCount.toLocaleString()}`}
            </div>
          </div>
          <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#16221b]/[0.08]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#e3a94d,var(--gold))] transition-[width] duration-[1300ms] ease-out"
              style={{ width: `${fill}%` }}
            />
            {phase === "stamp" && <Confetti />}
          </div>
          <p className={`mt-2.5 text-sm font-semibold transition-opacity duration-300 ${phase === "stamp" ? "opacity-100" : "opacity-0"}`} style={{ color: GOLD_TEXT }}>
            ✓ Promised by end of 2026 — reached in September, six months after launch.
          </p>
        </div>
      )}

      {/* ── Settled state: plaques + the next rung */}
      {phase === "settled" && (
        <div className={animated.current ? "animate-[goal-rise_600ms_cubic-bezier(0.16,1,0.3,1)]" : undefined}>
          {COMPLETED.map((m) => (
            <div key={m.goal} className="flex items-center gap-2.5 border-b border-black/[0.07] pb-3">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#16221b] text-[11px] font-bold text-[var(--gold)]">✓</span>
              <div className="min-w-0">
                <span className="font-[family-name:var(--font-heading)] text-sm font-extrabold tracking-tight">{m.label}</span>
                <span className="ml-2 text-[13px] text-[#6b7a70]">{m.story}</span>
              </div>
            </div>
          ))}

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <div className="font-[family-name:var(--font-heading)] text-sm font-extrabold tracking-tight">Next stop: {ACTIVE.label}</div>
              <div className="text-sm font-bold" style={{ color: GOLD_TEXT }}>
                {(animated.current ? liveCount : playerCount).toLocaleString()} · {Math.round(activePct)}% there
              </div>
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
                className="h-full rounded-full bg-[linear-gradient(90deg,#e3a94d,var(--gold))] transition-[width] duration-[1100ms] ease-out"
                style={{ width: `${activePct}%` }}
              />
            </div>
            <p className="mt-2.5 text-sm text-[#6b7a70]">{ACTIVE.goal.toLocaleString()} disc golfers by the {ACTIVE.deadline} — every player counts.</p>
          </div>
          <style>{`@keyframes goal-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      )}
    </div>
  );
}
