"use client";

import { useEffect, useMemo, useState } from "react";
import { geoPath, geoNaturalEarth1 } from "d3-geo";
import { feature } from "topojson-client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Topo = any;
type Counts = Map<string, number>;
type Row = { name: string; n: number; d: string; kind: "country" | "state" };

/**
 * World coverage choropleth — every country is filled by how many courses are mapped there (gold), and
 * the US is broken into its individual states (green). Both TopoJSON files are lat/lon, so US states
 * reproject onto the same world projection cleanly. The projection is fit to the ENTIRE world (incl. the
 * US country outline) so the states always land in-bounds and nothing clips off the edge.
 */
export default function CoverageMap({ stateCounts, countryCounts }: { stateCounts: Counts; countryCounts: Counts }) {
  const [topo, setTopo] = useState<{ world?: Topo; us?: Topo }>({});
  const [hover, setHover] = useState<{ name: string; n: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!topo.world) fetch("/geo/world.json").then((r) => r.json()).then((d) => setTopo((t) => ({ ...t, world: d }))).catch(() => {});
    if (!topo.us) fetch("/geo/us-states.json").then((r) => r.json()).then((d) => setTopo((t) => ({ ...t, us: d }))).catch(() => {});
  }, [topo.world, topo.us]);

  const W = 980, H = 500;
  const US_COUNTRY = new Set(["UNITED STATES OF AMERICA", "UNITED STATES", "USA"]);

  const { paths, mappedCountries, mappedStates, total, max } = useMemo(() => {
    if (!topo.world || !topo.us) return { paths: [] as Row[], mappedCountries: 0, mappedStates: 0, total: 0, max: 1 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCountries = ((feature(topo.world, topo.world.objects.countries) as any).features as any[])
      .filter((f) => f.properties.name !== "Antarctica");
    const countryFeats = allCountries.filter((f) => !US_COUNTRY.has((f.properties.name as string).toUpperCase()));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateFeats = ((feature(topo.us, topo.us.objects.states) as any).features as any[])
      .filter((f) => Number(f.id) <= 56 && f.properties.name !== "District of Columbia"); // 50 states only

    // Fit the projection to the WHOLE world (including the US country) so US states land in-bounds and
    // nothing spills off the edge; then draw the non-US countries + the US states on that same projection.
    const proj = geoNaturalEarth1().fitSize([W, H], { type: "FeatureCollection", features: allCountries });
    const pathGen = geoPath(proj);

    const rows: Row[] = [
      ...countryFeats.map((f) => ({ name: f.properties.name as string, n: countryCounts.get((f.properties.name as string).toUpperCase()) || 0, d: pathGen(f) || "", kind: "country" as const })),
      ...stateFeats.map((f) => ({ name: f.properties.name as string, n: stateCounts.get((f.properties.name as string).toUpperCase()) || 0, d: pathGen(f) || "", kind: "state" as const })),
    ].filter((p) => p.d);

    let mx = 1, mc = 0, ms = 0;
    for (const r of rows) if (r.n > 0) { if (r.n > mx) mx = r.n; if (r.kind === "state") ms++; else mc++; }
    return { paths: rows, mappedCountries: mc, mappedStates: ms, total: rows.length, max: mx };
  }, [topo.world, topo.us, stateCounts, countryCounts]);

  // Every mapped place is the same gold — only the legend counts distinguish countries vs US states.
  const fillFor = (n: number) => (n <= 0 ? "rgba(245,237,225,0.07)" : `rgba(246,193,101,${(0.42 + 0.58 * Math.min(1, n / max)).toFixed(2)})`);
  const loading = !topo.world || !topo.us;
  const noCourses = Math.max(0, total - mappedCountries - mappedStates);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg-deep)] lg:pl-[400px]">
      <div className="absolute right-3 top-[84px] z-10 rounded-xl bg-[var(--bg-mid)]/85 px-3 py-2 text-[11px] text-[var(--cream)] shadow-[0_18px_44px_-16px_rgba(0,0,0,0.7)] backdrop-blur">
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--gold)]" /> Countries ({mappedCountries})</div>
        <div className="mt-1 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--gold)]" /> US states ({mappedStates})</div>
        <div className="mt-1 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[rgba(245,237,225,0.14)]" /> No courses yet ({noCourses})</div>
      </div>

      {loading ? (
        <div className="grid h-full place-items-center text-sm text-[var(--sage-dim)]">Loading map…</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHover(null)}>
          {paths.map((p) => (
            <path
              key={`${p.kind}-${p.name}`}
              d={p.d}
              fill={fillFor(p.n)}
              stroke="rgba(15,24,19,0.85)"
              strokeWidth={0.4}
              className="cursor-default transition-[fill] duration-150 hover:fill-[var(--gold-bright)]"
              onMouseMove={(e) => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHover({ name: p.name, n: p.n, x: e.clientX - r.left, y: e.clientY - r.top }); }}
            />
          ))}
        </svg>
      )}

      {hover && (
        <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-lg bg-[var(--bg-deep)] px-2.5 py-1.5 text-xs shadow-lg ring-1 ring-white/10" style={{ left: hover.x, top: hover.y - 8 }}>
          <div className="font-bold text-[var(--cream)]">{hover.name}</div>
          <div className={hover.n > 0 ? "text-[var(--gold)]" : "text-[var(--sage-dim)]"}>{hover.n > 0 ? `${hover.n} course${hover.n === 1 ? "" : "s"}` : "No courses yet"}</div>
        </div>
      )}
    </div>
  );
}
