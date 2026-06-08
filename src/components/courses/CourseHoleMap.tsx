"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { type CourseHole } from "@/lib/courses";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoibWlrZXkzIiwiYSI6ImNtb3Fra25hZzB6dnIycHB6ZHMxcjIwNHYifQ.tyyS7i-aoR54_l11rW0Khg";

export function holesWithGeo(holes: CourseHole[]): CourseHole[] {
  return holes.filter((h) => typeof h.teeLat === "number" && typeof h.teeLng === "number" && typeof h.basketLat === "number" && typeof h.basketLng === "number");
}

export interface FlightThrow { result: string; distance?: number; discName?: string }

function resultColor(result: string): string {
  const r = (result || "").toLowerCase();
  if (r.includes("ob") || r.includes("penalty")) return "#e0473f";
  if (r.includes("miss")) return "#ffa600";
  if (r.includes("circle 2") || r.includes("c2")) return "#e8d44d";
  if (r.includes("basket") || r.includes("circle 1") || r.includes("c1")) return "#1ab859";
  return "#4d94fa"; // fairway
}
const lerp = (a: [number, number], b: [number, number], f: number): [number, number] => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

function buildFlight(hole: CourseHole | undefined, throws?: FlightThrow[]) {
  const empty = { type: "FeatureCollection" as const, features: [] as unknown[] };
  if (!hole || hole.teeLng == null || hole.basketLng == null || !throws || throws.length === 0) return empty;
  const tee: [number, number] = [hole.teeLng!, hole.teeLat!];
  const basket: [number, number] = [hole.basketLng!, hole.basketLat!];
  const dists = throws.map((t) => Math.max(0, t.distance || 0));
  const total = dists.reduce((a, b) => a + b, 0);
  if (total <= 0) return empty;
  let cum = 0;
  const pts: [number, number][] = [tee];
  throws.forEach((_, i) => { cum += dists[i]; pts.push(lerp(tee, basket, Math.min(1, cum / total))); });
  const features: unknown[] = [];
  throws.forEach((t, i) => {
    const color = resultColor(t.result);
    features.push({ type: "Feature", properties: { color }, geometry: { type: "LineString", coordinates: [pts[i], pts[i + 1]] } });
    features.push({ type: "Feature", properties: { color, n: i + 1 }, geometry: { type: "Point", coordinates: pts[i + 1] } });
  });
  return { type: "FeatureCollection" as const, features };
}

export default function CourseHoleMap({ holes, highlightHole, flight, onHole, className }: { holes: CourseHole[]; highlightHole?: number | null; flight?: FlightThrow[]; onHole?: (n: number | null) => void; className?: string }) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const teeMarkersRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const onHoleRef = useRef(onHole);
  onHoleRef.current = onHole;

  const playable = holesWithGeo(holes);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !elRef.current || playable.length === 0) return;
      mapboxgl.accessToken = TOKEN;

      const map = new mapboxgl.Map({
        container: elRef.current,
        style: "mapbox://styles/mapbox/satellite-v9",
        projection: "mercator",
        attributionControl: false,
        bounds: bounds(playable),
        fitBoundsOptions: { padding: 60 },
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;
        map.resize();
        map.addSource("holes", { type: "geojson", data: lineCollection(playable) });
        map.addLayer({ id: "hole-casing", type: "line", source: "holes", layout: { "line-cap": "round" }, paint: { "line-color": "#0f1813", "line-width": 5, "line-opacity": 0.6 } });
        map.addLayer({ id: "hole-line", type: "line", source: "holes", layout: { "line-cap": "round" }, paint: { "line-color": "#F6C165", "line-width": 2.5, "line-dasharray": [2, 1.4] } });
        map.addLayer({ id: "hole-hl", type: "line", source: "holes", layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 5 }, filter: ["==", ["get", "hole"], -1] });
        // flight overlay (real shots projected onto the hole)
        map.addSource("flight", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "flight-seg", type: "line", source: "flight", filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round" }, paint: { "line-color": ["get", "color"], "line-width": 4 } });
        map.addLayer({ id: "flight-pt", type: "circle", source: "flight", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": ["get", "color"], "circle-radius": 5, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
        map.on("click", "hole-line", (e) => onHoleRef.current?.((e.features?.[0]?.properties as { hole?: number } | undefined)?.hole ?? null));
        map.on("mouseenter", "hole-line", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "hole-line", () => (map.getCanvas().style.cursor = ""));

        playable.forEach((h) => {
          // tee number pin
          const tee = document.createElement("div");
          tee.style.cssText = "min-width:26px;height:26px;padding:0 6px;border-radius:7px;background:#F6C165;color:#16221b;font:700 13px Sora,sans-serif;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.55);cursor:pointer;transition:transform .15s";
          tee.textContent = String(h.holeNumber);
          tee.addEventListener("click", () => onHoleRef.current?.(h.holeNumber));
          teeMarkersRef.current.set(h.holeNumber, tee);
          new mapboxgl.Marker({ element: tee }).setLngLat([h.teeLng!, h.teeLat!]).addTo(map);
          // basket dot
          const basket = document.createElement("div");
          basket.style.cssText = "width:12px;height:12px;border-radius:50%;background:#16221b;border:2px solid #5fcf80;box-shadow:0 1px 4px rgba(0,0,0,0.5)";
          new mapboxgl.Marker({ element: basket }).setLngLat([h.basketLng!, h.basketLat!]).addTo(map);
        });
      });
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // highlight
  useEffect(() => {
    const map = mapRef.current;
    if (map && map.getLayer && map.getLayer("hole-hl")) {
      try { map.setFilter("hole-hl", ["==", ["get", "hole"], highlightHole ?? -1]); } catch {}
    }
    teeMarkersRef.current.forEach((el, n) => { el.style.transform = n === highlightHole ? "scale(1.4)" : "scale(1)"; el.style.zIndex = n === highlightHole ? "10" : "1"; });
  }, [highlightHole]);

  // flight overlay for the highlighted hole
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource || !map.getSource("flight")) return;
    const hole = playable.find((h) => h.holeNumber === highlightHole);
    map.getSource("flight").setData(buildFlight(hole, highlightHole ? flight : undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightHole, flight]);

  if (playable.length === 0) return null;
  return <div ref={elRef} className={className ?? "h-[420px] w-full"} />;
}

function bounds(holes: CourseHole[]): [[number, number], [number, number]] {
  let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
  for (const h of holes) {
    for (const [lng, lat] of [[h.teeLng!, h.teeLat!], [h.basketLng!, h.basketLat!]]) {
      minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

function lineCollection(holes: CourseHole[]) {
  return {
    type: "FeatureCollection" as const,
    features: holes.map((h) => ({
      type: "Feature" as const,
      properties: { hole: h.holeNumber },
      geometry: { type: "LineString" as const, coordinates: [[h.teeLng!, h.teeLat!], [h.basketLng!, h.basketLat!]] },
    })),
  };
}
