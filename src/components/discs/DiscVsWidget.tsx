"use client";

import { useEffect, useMemo, useState } from "react";
import { getDiscCatalog } from "@/lib/bag";
import { buildDiscs, type DiscData } from "@/lib/discs";
import { normCat, tierFor, type FlightDisc } from "@/lib/bag";
import FlightChart from "@/components/bag/FlightChart";

const fnum = (n?: number) => ((n ?? 0) > 0 ? `+${n}` : `${n ?? 0}`);
function toFlight(d: DiscData): FlightDisc {
  return { id: d.slug, name: d.name, brand: d.manufacturer, category: normCat(d.category), speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade, stability: d.stability, tier: tierFor(d.stability), color: d.color || "#9aa6b2", throwCount: 0, known: true, isFavorite: false };
}

export default function DiscVsWidget({ self }: { self: FlightDisc }) {
  const [catalog, setCatalog] = useState<DiscData[]>([]);
  const [other, setOther] = useState<DiscData | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => { getDiscCatalog().then((r) => setCatalog(buildDiscs(r))).catch(() => {}); }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return catalog.filter((d) => d.slug !== self.id && `${d.name} ${d.manufacturer}`.toLowerCase().includes(s)).slice(0, 8);
  }, [catalog, q, self.id]);

  const otherF = other ? toFlight(other) : null;
  const discs = otherF ? [self, otherF] : [self];
  const cols: FlightDisc[] = [self, ...(otherF ? [otherF] : [])];
  const rows: [string, (c: typeof cols[number]) => string | number][] = [
    ["Speed", (c) => c.speed ?? "—"], ["Glide", (c) => c.glide ?? "—"], ["Turn", (c) => fnum(c.turn)], ["Fade", (c) => fnum(c.fade)], ["Stability", (c) => fnum(c.stability)],
  ];

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${self.color}22`, color: "#16221b" }}><span className="h-2 w-2 rounded-full" style={{ background: self.color }} />{self.name}</span>
          {otherF ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${otherF.color}22`, color: "#16221b" }}><span className="h-2 w-2 rounded-full" style={{ background: otherF.color }} />{otherF.name}<button onClick={() => { setOther(null); setQ(""); }} className="text-black/40 hover:text-black/70" aria-label="Remove">✕</button></span>
          ) : (
            <span className="text-xs text-[#8a968d]">vs…</span>
          )}
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-[#16221b] hover:border-[var(--gold)]">{open ? "Close" : otherF ? "Change disc" : "+ Compare a disc"}</button>
      </div>

      {open && (
        <div className="mb-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a disc to overlay…" className="w-full rounded-xl border border-black/10 bg-[#faf8f3] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--gold)]" />
          {results.length > 0 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-black/8">
              {results.map((d) => (
                <button key={d.slug} onClick={() => { setOther(d); setOpen(false); setQ(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-black/[0.03]">
                  <span><span className="font-semibold text-[#16221b]">{d.name}</span> <span className="text-[#8a968d]">{d.manufacturer}</span></span>
                  <span className="text-xs font-mono text-[#46554c]">{d.speed}/{d.glide}/{fnum(d.turn)}/{fnum(d.fade)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-[210px_1fr] sm:items-start">
        <div className="mx-auto w-full max-w-[210px]"><FlightChart discs={discs} light /></div>
        <div className="overflow-hidden rounded-xl border border-black/8">
          <table className="w-full text-sm">
            <thead><tr className="bg-black/[0.03] text-left text-[11px] uppercase tracking-wide text-[#8a968d]">
              <th className="px-3 py-2"></th>
              {cols.map((c) => <th key={c.name} className="px-3 py-2 text-right">{c.name}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(([label, get]) => (
                <tr key={label} className="border-t border-black/[0.06]">
                  <td className="px-3 py-2 font-semibold text-[#46554c]">{label}</td>
                  {cols.map((c) => <td key={c.name} className="px-3 py-2 text-right font-bold text-[#16221b]">{get(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
