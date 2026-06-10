"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getLeaderboardWithRegion, type GeoLeaderRow } from "@/lib/leaderboard";
import { STATE_NAMES } from "@/lib/courses";

const MEDALS = ["🥇", "🥈", "🥉"];
type Scope = "world" | "country" | "state";

function Row({ row, rank }: { row: GeoLeaderRow; rank: number }) {
  const region = row.state ? STATE_NAMES[row.state] || row.state : row.country;
  const inner = (
    <div className={`flex items-center gap-3 px-4 py-3 ${rank <= 3 ? "bg-white/[0.02]" : ""}`}>
      <span className="w-7 shrink-0 text-center text-sm font-bold text-[var(--gold)]">{rank <= 3 ? MEDALS[rank - 1] : rank}</span>
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
        {row.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (row.name || "?").charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-bold text-[var(--cream)]">{row.name}</span>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${row.color}22`, color: row.color }}>{row.tier}</span>
        </div>
        <div className="truncate text-xs text-[var(--sage-dim)]">{row.username ? `@${row.username}` : ""}{row.username && region ? " · " : ""}{region || ""}</div>
      </div>
      <div className="text-right">
        <div className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-[var(--cream)]">{row.gameIQ}</div>
        <div className="text-[10px] uppercase tracking-wide text-[var(--sage-dim)]">Game IQ</div>
      </div>
    </div>
  );
  return row.username ? (
    <Link href={`/u/${row.username}`} className="block border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.04]">{inner}</Link>
  ) : (
    <div className="border-b border-white/[0.06] last:border-0">{inner}</div>
  );
}

export default function LeaderboardPage() {
  const [all, setAll] = useState<GeoLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>("world");
  const [country, setCountry] = useState("");
  const [usState, setUsState] = useState("");

  useEffect(() => {
    getLeaderboardWithRegion(250).then((rows) => {
      setAll(rows);
      const cc: Record<string, number> = {}; rows.forEach((r) => { if (r.country) cc[r.country] = (cc[r.country] || 0) + 1; });
      const ss: Record<string, number> = {}; rows.forEach((r) => { if (r.state) ss[r.state] = (ss[r.state] || 0) + 1; });
      setCountry(Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0] || "");
      setUsState(Object.entries(ss).sort((a, b) => b[1] - a[1])[0]?.[0] || "");
    }).catch(() => setAll([])).finally(() => setLoading(false));
  }, []);

  const countries = useMemo(() => { const m: Record<string, number> = {}; all.forEach((r) => { if (r.country) m[r.country] = (m[r.country] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [all]);
  const states = useMemo(() => { const m: Record<string, number> = {}; all.forEach((r) => { if (r.state) m[r.state] = (m[r.state] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); }, [all]);
  const rows = useMemo(() => {
    if (scope === "country") return all.filter((r) => r.country === country);
    if (scope === "state") return all.filter((r) => r.state === usState);
    return all.slice(0, 20); // World: top 20 only
  }, [all, scope, country, usState]);

  const podium = rows.slice(0, 3);
  const scopeLabel = scope === "world" ? "the world" : scope === "country" ? country : (STATE_NAMES[usState] || usState);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.14),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-6 pb-7 pt-12 text-center">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">🏆 Rankings</div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Game IQ Leaderboard</h1>
          <p className="mt-3 text-[var(--text-body)]">The top disc golfers in {scopeLabel}, ranked by Game IQ — earned through real rounds.</p>

          {/* scope filter */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              {(["world", "country", "state"] as Scope[]).map((s) => (
                <button key={s} onClick={() => setScope(s)} className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${scope === s ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{s === "world" ? "🌍 World" : s === "country" ? "Country" : "U.S. State"}</button>
              ))}
            </div>
            {scope === "country" && countries.length > 0 && (
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-full border border-white/10 bg-[var(--bg-mid)] px-4 py-1.5 text-xs font-semibold text-[var(--cream)] outline-none">
                {countries.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
              </select>
            )}
            {scope === "state" && states.length > 0 && (
              <select value={usState} onChange={(e) => setUsState(e.target.value)} className="rounded-full border border-white/10 bg-[var(--bg-mid)] px-4 py-1.5 text-xs font-semibold text-[var(--cream)] outline-none">
                {states.map(([s, n]) => <option key={s} value={s}>{STATE_NAMES[s] || s} ({n})</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {!loading && podium.length === 3 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[1, 0, 2].map((idx) => {
              const p = podium[idx];
              const place = idx + 1;
              return (
                <Link key={p.id} href={p.username ? `/u/${p.username}` : "#"} className={`flex flex-col items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 ${place === 1 ? "sm:-translate-y-3" : ""}`}>
                  <span className="text-2xl">{MEDALS[place - 1]}</span>
                  <span className="mt-1 grid h-14 w-14 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-lg font-bold ring-2" style={{ ["--tw-ring-color" as string]: `${p.color}66` }}>
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo} alt="" className="h-full w-full object-cover" />
                    ) : (p.name || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="mt-2 truncate text-sm font-bold">{p.name}</span>
                  <span className="font-[family-name:var(--font-heading)] text-lg font-extrabold" style={{ color: p.color }}>{p.gameIQ}</span>
                </Link>
              );
            })}
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-[68px] animate-pulse border-b border-white/[0.06] bg-white/[0.01]" />)
          ) : rows.length === 0 ? (
            <p className="p-12 text-center text-sm text-[var(--sage-dim)]">No ranked players in {scopeLabel} yet. Players are placed by their home course, or where they play most.</p>
          ) : (
            rows.map((r, i) => <Row key={r.id} row={r} rank={i + 1} />)
          )}
        </div>
        {scope !== "world" && <p className="mt-3 text-center text-xs text-[var(--sage-dim)]">Regional ranks use each player&apos;s home course, or the course they play most. Set a home course in the Radius app to fine-tune yours.</p>}
      </div>
    </div>
  );
}
