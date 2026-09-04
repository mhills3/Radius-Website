"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { GeoLeaderRow } from "@/lib/leaderboard";
import { STATE_NAMES } from "@/lib/courses";

type Scope = "world" | "country" | "state";
const MEDAL = ["🥇", "🥈", "🥉"];
const TOP = 10;

// Compact Radius Rating leaderboard for the community sidebar. Fed the region-aware rows the page
// already loads (geoRows) — toggleable World / Country / U.S. State. Rated players lead; players not
// yet rated show their Game IQ (the leaderboard lib resolves the fallback per row).
export default function RatingLeaderboard({ rows, myState, myCountry }: { rows: GeoLeaderRow[]; myState?: string; myCountry?: string }) {
  const [scope, setScope] = useState<Scope>("world");
  const [selCountry, setSelCountry] = useState<string | null>(null);
  const [selState, setSelState] = useState<string | null>(null);

  const countries = useMemo(() => { const m: Record<string, number> = {}; rows.forEach((r) => { if (r.country) m[r.country] = (m[r.country] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [rows]);
  const states = useMemo(() => { const m: Record<string, number> = {}; rows.forEach((r) => { if (r.state) m[r.state] = (m[r.state] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [rows]);

  // Default a region scope to the viewer's own region, else the most-populated one; selects override.
  const country = selCountry ?? (myCountry && countries.some(([c]) => c === myCountry) ? myCountry : countries[0]?.[0]) ?? "";
  const usState = selState ?? (myState && states.some(([s]) => s === myState) ? myState : states[0]?.[0]) ?? "";

  const list = useMemo(() => {
    const base = scope === "country" ? rows.filter((r) => r.country === country) : scope === "state" ? rows.filter((r) => r.state === usState) : rows;
    return base.slice(0, TOP);
  }, [rows, scope, country, usState]);

  const TABS: { key: Scope; label: string }[] = [
    { key: "world", label: "🌍 World" },
    { key: "country", label: "Country" },
    { key: "state", label: "State" },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">🏆 Top Radius Ratings</span>
        <Link href="/leaderboard" className="text-[11px] font-bold text-[var(--gold)] hover:underline">All →</Link>
      </div>

      {/* scope toggle */}
      <div className="mb-2.5 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-0.5">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setScope(t.key)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${scope === t.key ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{t.label}</button>
        ))}
      </div>
      {scope === "country" && countries.length > 1 && (
        <select value={country} onChange={(e) => setSelCountry(e.target.value)} className="mb-2.5 block w-full rounded-lg border border-white/10 bg-[var(--bg-mid)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--cream)] outline-none">
          {countries.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
        </select>
      )}
      {scope === "state" && states.length > 1 && (
        <select value={usState} onChange={(e) => setSelState(e.target.value)} className="mb-2.5 block w-full rounded-lg border border-white/10 bg-[var(--bg-mid)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--cream)] outline-none">
          {states.map(([s, n]) => <option key={s} value={s}>{STATE_NAMES[s] || s} ({n})</option>)}
        </select>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--sage-dim)]">Loading rankings…</p>
      ) : list.length === 0 ? (
        <p className="text-[13px] text-[var(--sage-dim)]">No ranked players here yet.</p>
      ) : (
        <div className="space-y-0.5">
          {list.map((r, i) => {
            const rank = i + 1;
            const inner = (
              <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 transition-colors group-hover:bg-white/[0.04]">
                <span className="w-5 shrink-0 text-center text-[12px] font-bold text-[var(--gold)]">{rank <= 3 ? MEDAL[rank - 1] : rank}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-[11px] font-bold text-[var(--cream)] ring-1 ring-white/10">
                  {r.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (r.name || "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[var(--cream)] group-hover:text-[var(--gold)]">{r.name}</div>
                  <div className="truncate text-[10.5px] font-bold uppercase tracking-wide" style={{ color: r.color }}>{r.tier}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-[family-name:var(--font-heading)] text-[15px] font-extrabold leading-none" style={{ color: r.color }}>{r.value}</div>
                  <div className="mt-0.5 text-[8.5px] uppercase tracking-wide text-[var(--sage-dim)]">{r.isRating ? "Rating" : "Game IQ"}</div>
                </div>
              </div>
            );
            return r.username ? (
              <Link key={r.id} href={`/u/${r.username}`} className="group block">{inner}</Link>
            ) : (
              <div key={r.id} className="group">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
