"use client";

// The round scorecard, styled to match the public event scorecard exactly (leagues event modal):
// a dark card with Hole / Par / Dist header rows and a player row (avatar + name + @handle) of score
// cells + TOT. Cell = gold-ring eagle+, blue-ring birdie, plain par, salmon-ring bogey, salmon-fill
// double+. Scrolls horizontally.

export interface ScorecardHole { holeNumber: number; par: number; score: number; distance?: number }
export interface ScorecardPlayer { name: string; photo?: string; username?: string }

const HEAD = "font-[family-name:var(--font-heading)]";
const relColor = (n: number) => (n < 0 ? "#8FBF9A" : n > 0 ? "#e0873f" : "var(--cream)");
const sp = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);

// Exact cell styling from the event scorecard modal.
function Cell({ score, par }: { score: number; par: number }) {
  const d = score - par;
  const base = "mx-auto grid h-8 w-8 place-items-center text-[14px] font-bold tabular-nums";
  if (d <= -2) return <span className={`${base} rounded-full text-[#E8B560] ring-2 ring-[#E8B560]`}>{score}</span>;
  if (d === -1) return <span className={`${base} rounded-full text-[#8FBDE3] ring-[1.5px] ring-[#8FBDE3]`}>{score}</span>;
  if (d === 0) return <span className={`${base} text-[var(--cream)]`}>{score}</span>;
  if (d === 1) return <span className={`${base} rounded-[7px] text-[#f0a58c] ring-[1.5px] ring-[#f0a58c]/60`}>{score}</span>;
  return <span className={`${base} rounded-[7px] bg-[#f08c8c]/15 text-[#f08c8c]`}>{score}</span>;
}

function MiniAvatar({ url, name, gold }: { url?: string; name: string; gold?: boolean }) {
  const ring = gold ? "ring-2 ring-[var(--gold)]/70" : "";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`h-[30px] w-[30px] shrink-0 rounded-full object-cover ${ring}`} />
  ) : (
    <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#22302A] text-[12px] font-bold text-[var(--sage)] ${ring}`}>{(name || "?").charAt(0)}</span>
  );
}

export default function ScorecardTable({ holes, player }: { holes: ScorecardHole[]; player?: ScorecardPlayer }) {
  const played = [...holes].filter((h) => h.score > 0 && h.par > 0).sort((a, b) => a.holeNumber - b.holeNumber);
  if (played.length === 0) return null;
  const totalPar = played.reduce((s, h) => s + h.par, 0);
  const totalScore = played.reduce((s, h) => s + h.score, 0);
  const rel = totalScore - totalPar;
  const hasDist = played.some((h) => (h.distance ?? 0) > 0);
  const stick = "sticky left-0 z-10 bg-[#111813]";
  const rowLabel = `${stick} px-4 text-left text-[10px] uppercase tracking-[0.14em] text-[var(--cream-38)]`;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--hair-strong)] bg-[#111813]">
      <table className="w-full min-w-max border-collapse text-center">
        <thead>
          <tr className="bg-black/25">
            <th className={`${stick} px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cream-38)]`} style={{ background: "#0a0e0b" }}>Hole</th>
            {played.map((h) => <th key={h.holeNumber} className="min-w-[38px] px-1.5 py-2.5 text-[12px] font-bold text-[var(--cream-60)]">{h.holeNumber}</th>)}
            <th className="min-w-[56px] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">Tot</th>
          </tr>
          <tr className="border-b border-[var(--hair)]">
            <th className={`${rowLabel} py-1.5`}>Par</th>
            {played.map((h) => <th key={h.holeNumber} className="px-1.5 py-1.5 text-[12px] text-[var(--cream-38)]">{h.par}</th>)}
            <th className="px-3 py-1.5 text-[12px] text-[var(--cream-38)]">{totalPar}</th>
          </tr>
          {hasDist && (
            <tr className="border-b border-[var(--hair)]">
              <th className={`${rowLabel} py-1.5`}>Dist</th>
              {played.map((h) => <th key={h.holeNumber} className="px-1.5 py-1.5 text-[10px] font-normal text-[var(--sage-dim)]">{h.distance ? `${h.distance}′` : "–"}</th>)}
              <th />
            </tr>
          )}
        </thead>
        <tbody>
          <tr className="border-t border-[var(--hair)] bg-[var(--gold)]/[0.06]">
            <td className={`${stick} px-4 py-2.5 text-left`} style={{ background: "#1a1c12" }}>
              <div className="flex items-center gap-2.5">
                <MiniAvatar url={player?.photo} name={player?.name ?? "You"} gold />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-[var(--cream)]">{player?.name ?? "You"}</div>
                  {player?.username && <div className="truncate text-[10px] text-[var(--sage-dim)]">@{player.username}</div>}
                </div>
              </div>
            </td>
            {played.map((h) => <td key={h.holeNumber} className="px-1 py-2"><Cell score={h.score} par={h.par} /></td>)}
            <td className="px-3 py-2 text-right">
              <span className={`${HEAD} text-[16px] font-black text-[var(--cream)]`}>{totalScore}</span>
              <span className="ml-1 text-[11px] font-bold" style={{ color: relColor(rel) }}>{sp(rel)}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
