"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getLeaderboardWithRegion, type GeoLeaderRow } from "@/lib/leaderboard";
import { STATE_NAMES } from "@/lib/courses";

const HEAD = "font-[family-name:var(--font-heading)]";
const NUM = { fontFamily: "var(--font-body)", fontVariantNumeric: "tabular-nums" } as const;
type Scope = "world" | "country" | "state";

// gold / silver / bronze — matches the Top Builders podium
const MEDALS: Record<number, { label: string; icon: string; color: string; soft: string }> = {
  1: { label: "1st", icon: "🏆", color: "#f6c165", soft: "rgba(246,193,101,0.12)" },
  2: { label: "2nd", icon: "🥈", color: "#cfd6e0", soft: "rgba(207,214,224,0.09)" },
  3: { label: "3rd", icon: "🥉", color: "#dca06e", soft: "rgba(220,160,110,0.10)" },
};

// Canonical state label — merges abbreviation ("TX") and full name ("Texas") so the picker doesn't
// double-list a state (and so filtering matches every row for it). Countries are already codes.
const stKey = (s?: string) => (s ? STATE_NAMES[s] || s : "");

function Avatar({ row, className = "", ringColor }: { row: GeoLeaderRow; className?: string; ringColor?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] font-bold text-[var(--cream)] ${className}`}
      style={ringColor ? { boxShadow: `0 0 0 3px ${ringColor}, 0 0 28px -8px ${ringColor}` } : { boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)" }}
    >
      {row.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (row.name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
function TierChip({ row, className = "" }: { row: GeoLeaderRow; className?: string }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${className}`} style={{ background: `${row.color}22`, color: row.color }}>{row.tier}</span>;
}
function Metric({ row }: { row: GeoLeaderRow }) {
  return <>{row.isRating ? "Rating" : "Game IQ"}{row.provisional ? " · Prov" : ""}</>;
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
      const ss: Record<string, number> = {}; rows.forEach((r) => { const k = stKey(r.state); if (k) ss[k] = (ss[k] || 0) + 1; });
      setCountry(Object.entries(cc).sort((a, b) => b[1] - a[1])[0]?.[0] || "");   // default = most-populated
      setUsState(Object.entries(ss).sort((a, b) => b[1] - a[1])[0]?.[0] || "");
    }).catch(() => setAll([])).finally(() => setLoading(false));
  }, []);

  // Picker options: deduped by canonical label, sorted A→Z.
  const countries = useMemo(() => { const m: Record<string, number> = {}; all.forEach((r) => { if (r.country) m[r.country] = (m[r.country] || 0) + 1; }); return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])); }, [all]);
  const states = useMemo(() => { const m: Record<string, number> = {}; all.forEach((r) => { const k = stKey(r.state); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])); }, [all]);

  const rows = useMemo(() => {
    if (scope === "country") return all.filter((r) => r.country === country);
    if (scope === "state") return all.filter((r) => stKey(r.state) === usState);
    return all.slice(0, 20); // World: top 20
  }, [all, scope, country, usState]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const scopeLabel = scope === "world" ? "the world" : scope === "country" ? country : usState;

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* hero */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.16),transparent_70%)]" />
        <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(166,115,217,0.10),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-6 pb-8 pt-12 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">🏆 Rankings</div>
          <h1 className={`${HEAD} text-4xl font-black tracking-[-0.03em] md:text-[3.4rem] md:leading-[0.95]`}>
            <span className="bg-gradient-to-r from-[#f7dca0] via-[#f6c165] to-[#e0a23a] bg-clip-text text-transparent">Radius Rating</span> Leaderboard
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text-body)]">The top disc golfers in {scopeLabel}, ranked by their Radius Rating — earned through real rounds. Players not yet rated show their Game IQ.</p>

          {/* scope filter */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              {(["world", "country", "state"] as Scope[]).map((s) => (
                <button key={s} onClick={() => setScope(s)} className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${scope === s ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{s === "world" ? "🌍 World" : s === "country" ? "Country" : "U.S. State"}</button>
              ))}
            </div>
            {scope === "country" && countries.length > 0 && (
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-full border border-white/10 bg-[var(--bg-mid)] px-4 py-1.5 text-xs font-semibold text-[var(--cream)] outline-none">
                {countries.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
              </select>
            )}
            {scope === "state" && states.length > 0 && (
              <select value={usState} onChange={(e) => setUsState(e.target.value)} className="rounded-full border border-white/10 bg-[var(--bg-mid)] px-4 py-1.5 text-xs font-semibold text-[var(--cream)] outline-none">
                {states.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10">
        {loading ? (
          <div className="mt-4 flex justify-center text-[var(--sage)]"><svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-[var(--sage-dim)]">No ranked players in {scopeLabel} yet. Players are placed by their home course, or where they play most.</p>
        ) : (
          <>
            {/* premium podium — top 3 */}
            {podium.length >= 3 && (
              <div className="mt-2 grid grid-cols-3 items-end gap-3 sm:gap-5">
                {[podium[1], podium[0], podium[2]].map((p, order) => {
                  const place = order === 0 ? 2 : order === 1 ? 1 : 3;
                  const m = MEDALS[place];
                  const first = place === 1;
                  const region = stKey(p.state) || p.country;
                  return (
                    <Link
                      key={p.id + place}
                      href={p.username ? `/u/${p.username}` : "#"}
                      className={`group relative flex flex-col items-center overflow-hidden rounded-3xl border p-4 text-center transition-transform hover:-translate-y-1 sm:p-6 ${first ? "-mt-3 sm:-mt-9" : ""}`}
                      style={{ borderColor: `${m.color}5c`, background: `linear-gradient(180deg, ${m.soft}, rgba(255,255,255,0.014) 62%)`, boxShadow: first ? `0 0 64px -18px ${m.color}` : `0 0 42px -24px ${m.color}` }}
                    >
                      <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, transparent, ${m.color}, transparent)` }} />
                      <div className={`${HEAD} inline-flex items-center gap-1.5 text-[13px] font-black`} style={{ color: m.color }}><span className="text-[15px]">{m.icon}</span> {m.label}</div>
                      <Avatar row={p} ringColor={m.color} className={first ? "mt-3.5 h-[86px] w-[86px] text-2xl sm:h-24 sm:w-24 sm:text-3xl" : "mt-3.5 h-16 w-16 text-xl sm:h-[76px] sm:w-[76px] sm:text-2xl"} />
                      <div className={`${HEAD} mt-3.5 max-w-full truncate text-[15px] font-bold text-[var(--cream)] sm:text-base`}>{p.name}</div>
                      {region && <div className="truncate text-[11px] text-[var(--sage-dim)]">{region}</div>}
                      <div className="mt-2.5 flex items-baseline justify-center gap-1">
                        <span style={{ ...NUM, color: p.color }} className="text-[26px] font-black sm:text-[30px]">{p.value}</span>
                      </div>
                      <div className="mt-1.5"><TierChip row={p} /></div>
                      <div className="mt-1 text-[9px] uppercase tracking-wide text-[var(--sage-dim)]"><Metric row={p} /></div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* ranks 4+ */}
            {rest.length > 0 && (
              <div className="mt-8 divide-y divide-[var(--hair)] border-t border-[var(--hair)]">
                {rest.map((p, i) => {
                  const place = i + 4;
                  const region = stKey(p.state) || p.country;
                  return (
                    <Link key={p.id + place} href={p.username ? `/u/${p.username}` : "#"} className="group flex items-center gap-4 py-3.5 transition-colors hover:bg-white/[0.02]">
                      <span style={NUM} className="w-6 shrink-0 text-center text-[15px] font-bold text-[var(--sage-dim)]">{place}</span>
                      <Avatar row={p} className="h-11 w-11 text-sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`${HEAD} truncate text-[15px] font-bold text-[var(--cream)] group-hover:text-[var(--gold)]`}>{p.name}</span>
                          <TierChip row={p} />
                        </div>
                        <div className="truncate text-[12px] text-[var(--sage-dim)]">{p.username ? `@${p.username}` : ""}{p.username && region ? " · " : ""}{region || ""}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div style={{ ...NUM, color: p.color }} className="text-lg font-black leading-none">{p.value}</div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--sage-dim)]"><Metric row={p} /></div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {scope !== "world" && <p className="mt-4 text-center text-xs text-[var(--sage-dim)]">Regional ranks use each player&apos;s home course, or the course they play most. Set a home course in the Radius app to fine-tune yours.</p>}

            <div className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 text-center">
              <div className={`${HEAD} text-lg font-bold text-[var(--cream)]`}>Climb the board</div>
              <p className="mx-auto mt-1.5 max-w-md text-[14px] text-[var(--text-body)]">Log rounds in the Radius app — every rated round moves your number. Your best 8 of the last 20 make your Radius Rating.</p>
              <Link href="/download" className="mt-5 inline-block rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[#141B16] transition-colors hover:bg-[var(--gold-bright)]">Get Radius</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
