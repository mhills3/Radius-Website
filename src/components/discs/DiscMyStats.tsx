"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getDecodedRounds, outcomesByDisc, RESULTS } from "@/lib/rounds";
import { getBag } from "@/lib/bag";
import { ceilingFor } from "@/lib/bagRating";
import { useMetricPref } from "@/lib/useMetricPref";
import { fmtDist } from "@/lib/units";

interface MyStats { thrown: number; quality: number; counts: Record<string, number>; avgDist: number | null; aces: number; inBag: boolean; armSpeed?: string }

export default function DiscMyStats({ discName, discSpeed }: { discName: string; discSpeed: number }) {
  const { user } = useAuth();
  const metric = useMetricPref();
  const [data, setData] = useState<MyStats | null | undefined>(undefined);

  useEffect(() => {
    if (!user) { setData(null); return; }
    let alive = true;
    (async () => {
      const [rounds, bag] = await Promise.all([getDecodedRounds(user.uid).catch(() => []), getBag(user.uid).catch(() => null)]);
      if (!alive) return;
      const key = discName.trim().toLowerCase();
      let o: { total: number; quality: number; counts: Record<string, number> } | undefined;
      for (const [k, v] of outcomesByDisc(rounds)) if (k.trim().toLowerCase() === key) { o = v; break; }
      let distSum = 0, distN = 0, aces = 0;
      for (const r of rounds) for (const h of r.holes) {
        for (const t of h.throws) if ((t.discName || "").trim().toLowerCase() === key && (t.distance || 0) > 0) { distSum += t.distance!; distN++; }
        if (h.throws.length === 1 && (h.throws[0].result === "Basket" || h.throws[0].madeIt) && (h.throws[0].discName || "").trim().toLowerCase() === key) aces++;
      }
      setData({ thrown: o?.total ?? 0, quality: o?.quality ?? 0, counts: o?.counts ?? {}, avgDist: distN ? Math.round(distSum / distN) : null, aces, inBag: !!bag?.discs.some((d) => (d.name || "").trim().toLowerCase() === key), armSpeed: bag?.armSpeed });
    })();
    return () => { alive = false; };
  }, [user, discName]);

  if (data === undefined && user) return <div className="h-28 animate-pulse rounded-2xl border border-black/8 bg-white" />;

  if (!user) {
    return (
      <Link href="/login" className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/[0.07] px-5 py-4 transition-colors hover:bg-[var(--gold)]/[0.12]">
        <div><div className="font-bold text-[#16221b]">See how the {discName} fits your game</div><div className="text-sm text-[#46554c]">Sign in to see your throws, success rate, and fit with this disc.</div></div>
        <span className="shrink-0 rounded-full bg-[#16221b] px-4 py-2 text-sm font-bold text-[var(--cream)]">Sign in</span>
      </Link>
    );
  }
  if (!data) return null;

  const fit = data.armSpeed
    ? (() => { const ceil = ceilingFor(data.armSpeed); const over = discSpeed - ceil; return { ceil, score: Math.max(0, Math.min(100, 100 - Math.max(0, over) * 22)), label: over <= -2 ? "Comfortable speed" : over <= 0 ? "In your range" : over <= 1 ? "At your limit" : "Above your range", good: over <= 0 }; })()
    : null;
  const hasData = data.thrown > 0 || data.inBag || !!fit;

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#16221b]">{value}</div><div className="mt-0.5 text-[11px] uppercase tracking-wide text-[#8a968d]">{label}</div></div>
  );

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">Your game with this disc</span>
        {data.inBag && <span className="rounded-full bg-[#5fcf80]/15 px-2.5 py-1 text-[11px] font-bold text-[#1d8f48]">🎒 In your bag</span>}
      </div>

      {!hasData ? (
        <p className="text-sm text-[#8a968d]">You haven&apos;t thrown the {discName} yet. Throw it in the Radius app and your stats show up here.</p>
      ) : (
        <>
          {fit && (
            <div className="mb-4 flex items-center gap-4 rounded-xl bg-black/[0.03] p-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${fit.good ? "#1ab859" : "#ea8b3a"} ${fit.score * 3.6}deg, rgba(0,0,0,0.08) 0)` }}>
                <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-sm font-extrabold text-[#16221b]">{fit.score}</div>
              </div>
              <div>
                <div className="font-bold text-[#16221b]">{fit.label}</div>
                <div className="text-xs text-[#8a968d]">Speed {discSpeed} vs your {data.armSpeed?.toLowerCase()} ceiling of {fit.ceil} — fit based on your arm speed.</div>
              </div>
            </div>
          )}

          {data.thrown > 0 ? (
            <>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <Stat label="Times thrown" value={data.thrown} />
                <Stat label="Success rate" value={`${data.quality}%`} />
                {data.avgDist != null && <Stat label="Avg distance" value={fmtDist(data.avgDist, metric)} />}
                {data.aces > 0 && <Stat label="Aces" value={data.aces} />}
              </div>
              <div className="mt-4">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
                  {RESULTS.filter((r) => (data.counts[r.key] ?? 0) > 0).map((r) => (
                    <div key={r.key} title={`${r.label}: ${data.counts[r.key]}`} style={{ width: `${((data.counts[r.key] ?? 0) / data.thrown) * 100}%`, background: r.color }} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#8a968d]">
                  {RESULTS.filter((r) => (data.counts[r.key] ?? 0) > 0).map((r) => (
                    <span key={r.key} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label} {data.counts[r.key]}</span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#8a968d]">{data.inBag ? "It's in your bag — throw it in a round to see your shot stats here." : ""}</p>
          )}
        </>
      )}
    </div>
  );
}
