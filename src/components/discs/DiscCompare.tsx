"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type DiscData, stabilityLabel, stabilityTier, tierColor, discSlug } from "@/lib/discs";
import { normCat, tierFor, type FlightDisc } from "@/lib/bag";
import OverlayFlightChart from "@/components/discs/OverlayFlightChart";

const fnum = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const PALETTE = ["#ea8b3a", "#4d94fa", "#5fcf80"];

function toFlight(d: DiscData): FlightDisc {
  return { id: d.slug, name: d.name, brand: d.manufacturer, category: normCat(d.category), speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade, stability: d.stability, tier: tierFor(d.stability), color: d.color || "#9aa6b2", throwCount: 0, known: true, isFavorite: false };
}

export default function DiscCompare({ catalog }: { catalog: DiscData[] }) {
  const [picked, setPicked] = useState<DiscData[]>([]);
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return catalog.filter((d) => `${d.name} ${d.manufacturer}`.toLowerCase().includes(s) && !picked.some((p) => p.slug === d.slug)).slice(0, 6);
  }, [q, catalog, picked]);

  const add = (d: DiscData) => { if (picked.length < 3 && !picked.some((p) => p.slug === d.slug)) { setPicked((p) => [...p, d]); setQ(""); } };
  const remove = (slug: string) => setPicked((p) => p.filter((x) => x.slug !== slug));

  return (
    <section className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">⚖️ Compare discs</div>
      <p className="mb-4 text-sm text-[#8a968d]">Overlay up to 3 discs to see how their flights differ.</p>

      <div className="relative max-w-md">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={picked.length >= 3 ? "Remove a disc to add another" : "Search a disc to add…"} disabled={picked.length >= 3} className="w-full rounded-full border border-black/10 bg-[#faf8f3] px-4 py-2.5 text-sm outline-none focus:border-[var(--gold)] disabled:opacity-50" />
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
            {matches.map((d) => (
              <button key={d.slug} onClick={() => add(d)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-black/[0.03]">
                <span><span className="font-bold text-[#16221b]">{d.name}</span> <span className="text-[#8a968d]">{d.manufacturer}</span></span>
                <span className="text-xs text-[#8a968d]">{d.speed}/{d.glide}/{fnum(d.turn)}/{fnum(d.fade)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {picked.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-[#8a968d]">Add discs above to compare their flight numbers and paths side by side.</div>
      ) : (
        <div className="mt-5 grid gap-6 md:grid-cols-[300px_1fr]">
          <div className="flex justify-center rounded-2xl border border-black/8 bg-[#faf8f3] p-3">
            <OverlayFlightChart items={picked.map((d, i) => ({ id: d.slug, disc: toFlight(d), color: PALETTE[i % PALETTE.length], label: d.name }))} />
          </div>
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {picked.map((d, i) => (
                <span key={d.slug} className="inline-flex items-center gap-2 rounded-full bg-black/[0.05] py-1 pl-3 pr-1.5 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="font-semibold text-[#16221b]">{d.name}</span>
                  <button onClick={() => remove(d.slug)} className="grid h-5 w-5 place-items-center rounded-full text-[#8a968d] hover:bg-black/10" aria-label="Remove">×</button>
                </span>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/8">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-black/8 text-left text-[11px] uppercase tracking-wide text-[#8a968d]"><th className="px-3 py-2">Disc</th><th className="px-2 py-2 text-center">Speed</th><th className="px-2 py-2 text-center">Glide</th><th className="px-2 py-2 text-center">Turn</th><th className="px-2 py-2 text-center">Fade</th><th className="px-3 py-2">Stability</th></tr></thead>
                <tbody>
                  {picked.map((d, i) => {
                    const tier = stabilityTier(d.stability);
                    return (
                      <tr key={d.slug} className="border-b border-black/5 last:border-0">
                        <td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} /><Link href={`/discs/${discSlug(d)}`} className="font-bold text-[#16221b] hover:text-[#9a7a3a]">{d.name}</Link></div><div className="ml-4 text-xs text-[#8a968d]">{d.manufacturer}</div></td>
                        <td className="px-2 py-2.5 text-center font-bold">{d.speed}</td>
                        <td className="px-2 py-2.5 text-center font-bold">{d.glide}</td>
                        <td className="px-2 py-2.5 text-center font-bold">{fnum(d.turn)}</td>
                        <td className="px-2 py-2.5 text-center font-bold">{fnum(d.fade)}</td>
                        <td className="px-3 py-2.5"><span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${tierColor(tier)}1f`, color: tierColor(tier) }}>{stabilityLabel(d.stability)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
