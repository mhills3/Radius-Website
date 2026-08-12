"use client";

// The round scorecard as a single wide table (Hole / Par / Dist rows + your score row + TOT),
// mirroring the app's event-final scorecard. Circle = under par (gold eagle+, blue birdie),
// plain = par, rounded-square = over (salmon bogey, filled double+). Scrolls horizontally.

export interface ScorecardHole { holeNumber: number; par: number; score: number; distance?: number }

const HEAD = "font-[family-name:var(--font-heading)]";
const MONO = { fontFamily: "var(--font-mono-stack, 'JetBrains Mono', monospace)" } as const;
const relColor = (n: number) => (n < 0 ? "#8FBF9A" : n > 0 ? "#e0873f" : "var(--cream)");
const fmtRel = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `−${Math.abs(n)}`);

function Cell({ score, par }: { score: number; par: number }) {
  const d = score - par;
  const base = `mx-auto grid h-9 w-9 place-items-center ${HEAD} text-[15px] font-bold leading-none`;
  if (d <= -2) return <span className={`${base} rounded-full border-2 border-[var(--gold)] text-[var(--gold)]`} style={MONO}>{score}</span>;   // eagle+/ace
  if (d === -1) return <span className={`${base} rounded-full border-2 border-[#8FBDE3] text-[#8FBDE3]`} style={MONO}>{score}</span>;          // birdie
  if (d === 0) return <span className={`${base} text-[var(--cream)]`} style={MONO}>{score}</span>;                                             // par
  if (d === 1) return <span className={`${base} rounded-lg border-2 border-[#e08a72] text-[#eb9166]`} style={MONO}>{score}</span>;             // bogey
  return <span className={`${base} rounded-lg border border-[#e0473f]/60 bg-[#e0473f]/20 text-[#f08c8c]`} style={MONO}>{score}</span>;          // double+
}

export default function ScorecardTable({ holes }: { holes: ScorecardHole[] }) {
  const played = [...holes].filter((h) => h.score > 0 && h.par > 0).sort((a, b) => a.holeNumber - b.holeNumber);
  if (played.length === 0) return null;
  const totalPar = played.reduce((s, h) => s + h.par, 0);
  const totalScore = played.reduce((s, h) => s + h.score, 0);
  const rel = totalScore - totalPar;
  const hasDist = played.some((h) => (h.distance ?? 0) > 0);
  const label = `${HEAD} sticky left-0 z-10 bg-[var(--bg-mid)] pr-4 text-left text-[10px] font-bold uppercase tracking-[0.14em]`;
  const th = "px-1.5 pb-2 text-center text-[13px]";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <tbody>
          <tr>
            <th className={`${label} text-[var(--sage-dim)]`}>Hole</th>
            {played.map((h) => <td key={h.holeNumber} className={`${th} font-semibold text-[var(--cream)]/80`} style={MONO}>{h.holeNumber}</td>)}
            <td className={`${HEAD} pl-3 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--gold)]`}>Tot</td>
          </tr>
          <tr>
            <th className={`${label} text-[var(--sage-dim)]`}>Par</th>
            {played.map((h) => <td key={h.holeNumber} className={`${th} text-[var(--sage-dim)]`} style={MONO}>{h.par}</td>)}
            <td className="pl-3 text-center text-[13px] font-semibold text-[var(--sage)]" style={MONO}>{totalPar}</td>
          </tr>
          {hasDist && (
            <tr>
              <th className={`${label} text-[var(--sage-dim)]`}>Dist</th>
              {played.map((h) => <td key={h.holeNumber} className="px-1.5 pb-2 text-center text-[11px] text-[var(--sage-dim)]" style={MONO}>{h.distance ? `${h.distance}′` : ""}</td>)}
              <td />
            </tr>
          )}
          <tr>
            <th className={`${label} pt-1 text-[var(--sage)]`}>Score</th>
            {played.map((h) => <td key={h.holeNumber} className="px-1.5 pt-1"><Cell score={h.score} par={h.par} /></td>)}
            <td className="pl-3 pt-1 text-center">
              <div className={`${HEAD} text-[20px] font-black leading-none text-[var(--cream)]`} style={MONO}>{totalScore}</div>
              <div className={`${HEAD} text-[11px] font-bold`} style={{ ...MONO, color: relColor(rel) }}>{fmtRel(rel)}</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-4 text-[11px] text-[var(--text-body)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--gold)]" /> Eagle+</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border-2 border-[#8FBDE3]" /> Birdie</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 text-center text-[var(--cream)]">3</span> Par</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border-2 border-[#e08a72]" /> Bogey</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-[#e0473f]/60 bg-[#e0473f]/20" /> Double+</span>
      </div>
    </div>
  );
}
