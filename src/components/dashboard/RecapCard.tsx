"use client";

import { type Dashboard } from "@/lib/account";

const WEEK = 7 * 86400000;
const fmt = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number) => (n < 0 ? "#5fcf80" : n === 0 ? "var(--cream)" : "#f08c8c");

export default function RecapCard({ data }: { data: Dashboard }) {
  const now = Date.now();
  const metas = data.roundMetas;
  const thisWk = metas.filter((m) => now - m.date < WEEK);
  const best = thisWk.reduce<number | null>((b, m) => (typeof m.scoreToPar === "number" && (b == null || m.scoreToPar < b) ? m.scoreToPar : b), null);
  const holes = thisWk.reduce((s, m) => s + (m.holesPlayed || 0), 0);
  const hist = data.iqHistory;
  const weekAgoIq = [...hist].reverse().find((p) => p.t <= now - WEEK)?.iq ?? hist[0]?.iq ?? data.iqCurrent;
  const iqChange = data.iqCurrent - weekAgoIq;
  const Dot = () => <span className="text-[var(--sage-dim)]/50">·</span>;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--sage)] sm:justify-end">
      <span className="font-bold uppercase tracking-wide text-[var(--gold)]">🔥 This week</span>
      {thisWk.length === 0 ? (
        <span className="text-[var(--sage-dim)]">— no rounds yet</span>
      ) : (
        <>
          <Dot /><span><b className="font-bold text-[var(--cream)]">{thisWk.length}</b> rounds</span>
          {holes > 0 && <><Dot /><span><b className="font-bold text-[var(--cream)]">{holes}</b> holes</span></>}
          {best != null && <><Dot /><span>best <b className="font-bold" style={{ color: scoreColor(best) }}>{fmt(best)}</b></span></>}
          {data.iqCurrent > 0 && <><Dot /><span>IQ <b className="font-bold text-[var(--cream)]">{data.iqCurrent}</b>{iqChange !== 0 ? <span className={iqChange > 0 ? "text-[#5fcf80]" : "text-[#f08c8c]"}> {iqChange > 0 ? "▲" : "▼"}{Math.abs(iqChange)}</span> : null}</span></>}
        </>
      )}
    </div>
  );
}
