"use client";

// A polished, classic disc-golf scorecard grid (Hole / Par / Score rows, split into nines with an
// OUT/IN total). Shape + color follow the convention: circles for under par, squares for over —
// filled for eagle/double, ringed for birdie/bogey. Shared by the dashboard round detail and the
// public "view scorecard" on shared-round posts so both read identically premium.

export interface ScorecardHole { holeNumber: number; par: number; score: number }

const HEAD = "font-[family-name:var(--font-heading)]";

function ScoreCell({ score, par }: { score: number; par: number }) {
  const d = score - par;
  const base = `grid h-9 w-9 place-items-center ${HEAD} text-[15px] font-bold leading-none`;
  if (d <= -2) return <span className={`${base} rounded-full bg-[var(--gold)] font-extrabold text-[#141b16] shadow-[0_2px_8px_-2px_rgba(232,181,96,0.7)]`}>{score}</span>; // eagle+
  if (d === -1) return <span className={`${base} rounded-full border-2 border-[#5fb87a] text-[#7fd39a]`}>{score}</span>; // birdie
  if (d === 0) return <span className={`${base} text-[var(--cream)]`}>{score}</span>; // par
  if (d === 1) return <span className={`${base} rounded-md border-2 border-[#e0733f] text-[#eb9166]`}>{score}</span>; // bogey
  return <span className={`${base} rounded-md border border-[#e0473f]/60 bg-[#e0473f]/15 text-[#f08c8c]`}>{score}</span>; // double+
}

function Nine({ holes, label, outLabel }: { holes: ScorecardHole[]; label?: string; outLabel: string }) {
  const par = holes.reduce((s, h) => s + h.par, 0);
  const score = holes.reduce((s, h) => s + h.score, 0);
  const rel = score - par;
  const relColor = rel < 0 ? "#7fd39a" : rel === 0 ? "var(--cream)" : "#eb9166";
  return (
    <div>
      {label && <div className={`mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]`}>{label}</div>}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-center">
          <tbody>
            <tr>
              <th className={`sticky left-0 z-10 bg-[var(--bg-mid)] pr-3 text-left text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]`}>Hole</th>
              {holes.map((h) => <td key={h.holeNumber} className="px-1 pb-1 text-[11px] font-semibold text-[var(--sage-dim)]">{h.holeNumber}</td>)}
              <td className={`pl-3 text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]`}>{outLabel}</td>
            </tr>
            <tr>
              <th className={`sticky left-0 z-10 bg-[var(--bg-mid)] pr-3 text-left text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]`}>Par</th>
              {holes.map((h) => <td key={h.holeNumber} className="px-1 pb-2 text-[11px] text-[var(--sage-dim)]">{h.par}</td>)}
              <td className={`pl-3 text-[11px] font-semibold text-[var(--sage-dim)]`}>{par}</td>
            </tr>
            <tr>
              <th className={`sticky left-0 z-10 bg-[var(--bg-mid)] pr-3 text-left text-[10px] font-bold uppercase tracking-wide text-[var(--sage)]`}>Score</th>
              {holes.map((h) => <td key={h.holeNumber} className="px-1 pt-1"><div className="grid place-items-center"><ScoreCell score={h.score} par={h.par} /></div></td>)}
              <td className={`pl-3 pt-1`}><span className={`${HEAD} text-lg font-extrabold`} style={{ color: relColor }}>{score}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ScorecardTable({ holes }: { holes: ScorecardHole[] }) {
  const played = [...holes].filter((h) => h.score > 0 && h.par > 0).sort((a, b) => a.holeNumber - b.holeNumber);
  const front = played.filter((h) => h.holeNumber <= 9);
  const back = played.filter((h) => h.holeNumber > 9);
  if (played.length === 0) return null;
  return (
    <div className="space-y-5">
      <Nine holes={front.length ? front : played} label={back.length ? "Front nine" : undefined} outLabel="Out" />
      {back.length > 0 && <Nine holes={back} label="Back nine" outLabel="In" />}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-white/[0.06] pt-4 text-[11px] text-[var(--text-body)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full bg-[var(--gold)]" /> Eagle+</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border-2 border-[#5fb87a]" /> Birdie</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 text-center text-[var(--cream)]">—</span> Par</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border-2 border-[#e0733f]" /> Bogey</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border border-[#e0473f]/60 bg-[#e0473f]/15" /> Double+</span>
      </div>
    </div>
  );
}
