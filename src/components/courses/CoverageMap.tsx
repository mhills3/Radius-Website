"use client";

import { useEffect, useMemo, useState } from "react";
import { geoPath, geoAlbersUsa, geoNaturalEarth1 } from "d3-geo";
import { feature } from "topojson-client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Topo = any;
type Counts = Map<string, number>;

/**
 * Choropleth coverage map — fills US states / world countries by how many courses
 * are mapped there. TopoJSON is lazy-loaded only when this view is shown.
 */
export default function CoverageMap({ stateCounts, countryCounts }: { stateCounts: Counts; countryCounts: Counts }) {
  const [scope, setScope] = useState<"us" | "world">("us");
  const [topo, setTopo] = useState<{ us?: Topo; world?: Topo }>({});
  const [hover, setHover] = useState<{ name: string; n: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (scope === "us" && !topo.us) fetch("/geo/us-states.json").then((r) => r.json()).then((d) => setTopo((t) => ({ ...t, us: d }))).catch(() => {});
    if (scope === "world" && !topo.world) fetch("/geo/world.json").then((r) => r.json()).then((d) => setTopo((t) => ({ ...t, world: d }))).catch(() => {});
  }, [scope, topo.us, topo.world]);

  const W = 980;
  const H = scope === "us" ? 560 : 500;
  const counts = scope === "us" ? stateCounts : countryCounts;

  const { paths, mapped, total, max } = useMemo(() => {
    const raw = scope === "us" ? topo.us : topo.world;
    if (!raw) return { paths: [] as { name: string; n: number; d: string }[], mapped: 0, total: 0, max: 1 };
    const fc = scope === "us"
      ? feature(raw, raw.objects.states)
      : feature(raw, raw.objects.countries);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let feats = (fc as any).features as any[];
    feats = scope === "us"
      ? feats.filter((f) => Number(f.id) <= 56) // 50 states + DC, no territories
      : feats.filter((f) => f.properties.name !== "Antarctica");
    const proj = (scope === "us" ? geoAlbersUsa() : geoNaturalEarth1()).fitSize([W, H], { type: "FeatureCollection", features: feats });
    const pathGen = geoPath(proj);
    let mx = 1, m = 0;
    for (const f of feats) { const n = counts.get((f.properties.name as string).toUpperCase()) || 0; if (n > 0) { m++; if (n > mx) mx = n; } }
    const paths = feats
      .map((f) => ({ name: f.properties.name as string, n: counts.get((f.properties.name as string).toUpperCase()) || 0, d: pathGen(f) || "" }))
      .filter((p) => p.d);
    return { paths, mapped: m, total: feats.length, max: mx };
  }, [scope, topo.us, topo.world, counts]);

  const fillFor = (n: number) => (n <= 0 ? "rgba(245,237,225,0.07)" : `rgba(246,193,101,${(0.45 + 0.55 * Math.min(1, n / max)).toFixed(2)})`);
  const loading = (scope === "us" && !topo.us) || (scope === "world" && !topo.world);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg-deep)]">
      <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.04 }} />

      <div className="absolute right-3 top-3 z-10 inline-flex rounded-full border border-white/10 bg-[var(--bg-mid)]/80 p-1 backdrop-blur">
        {(["us", "world"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${scope === s ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{s === "us" ? "U.S. States" : "World"}</button>
        ))}
      </div>

      <div className="absolute bottom-3 left-3 z-10 rounded-xl border border-white/10 bg-[var(--bg-mid)]/85 px-3 py-2 text-[11px] text-[var(--cream)] backdrop-blur">
        <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--gold)]" /> Mapped ({mapped})</div>
        <div className="mt-1 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[rgba(245,237,225,0.14)]" /> {scope === "us" ? "Needs courses" : "No courses yet"} ({Math.max(0, total - mapped)})</div>
      </div>

      {loading ? (
        <div className="grid h-full place-items-center text-sm text-[var(--sage-dim)]">Loading map…</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" onMouseLeave={() => setHover(null)}>
          {paths.map((p) => (
            <path
              key={p.name}
              d={p.d}
              fill={fillFor(p.n)}
              stroke="rgba(15,24,19,0.85)"
              strokeWidth={0.5}
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
