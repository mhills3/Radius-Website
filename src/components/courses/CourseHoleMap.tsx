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

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function CourseHoleMap({ holes, highlightHole, flight, onHole, className }: { holes: CourseHole[]; highlightHole?: number | null; flight?: FlightThrow[]; onHole?: (n: number | null) => void; className?: string }) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
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

      // Branded basket pin (same as the courses map) loaded as a map image.
      const loadPin = () => new Promise<void>((res) => {
        if (map.hasImage("basket-pin")) return res();
        const img = new Image();
        img.onload = () => {
          try {
            const scale = 2, w = 32 * scale, h = 40 * scale;
            const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
            const ctx = cv.getContext("2d");
            if (ctx) { ctx.drawImage(img, 0, 0, w, h); if (!map.hasImage("basket-pin")) map.addImage("basket-pin", ctx.getImageData(0, 0, w, h), { pixelRatio: 2 }); }
          } catch {}
          res();
        };
        img.onerror = () => res();
        img.src = "/basket-pin.svg";
      });

      // Pre-render each tee's numbered gold marker as a map image (GPU symbols → no zoom lag).
      const loadTeeIcons = () => {
        const scale = 2, w = 30 * scale, h = 30 * scale, pad = 3 * scale, r = 7 * scale;
        for (const hole of playable) {
          const id = `tee-${hole.holeNumber}`;
          if (map.hasImage(id)) continue;
          const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
          const ctx = cv.getContext("2d"); if (!ctx) continue;
          ctx.clearRect(0, 0, w, h);
          roundRectPath(ctx, pad, pad, w - 2 * pad, h - 2 * pad, r);
          ctx.fillStyle = "#F6C165"; ctx.fill();
          ctx.lineWidth = 2 * scale; ctx.strokeStyle = "#ffffff"; ctx.stroke();
          ctx.fillStyle = "#16221b"; ctx.font = `bold ${13 * scale}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(hole.holeNumber), w / 2, h / 2 + scale * 0.5);
          map.addImage(id, ctx.getImageData(0, 0, w, h), { pixelRatio: 2 });
        }
      };

      map.on("load", async () => {
        if (cancelled) return;
        map.resize();
        await loadPin();
        loadTeeIcons();
        if (cancelled) return;

        // hole lines (tee → basket)
        map.addSource("holes", { type: "geojson", data: lineCollection(playable) });
        map.addLayer({ id: "hole-casing", type: "line", source: "holes", layout: { "line-cap": "round" }, paint: { "line-color": "#0f1813", "line-width": 5, "line-opacity": 0.6 } });
        map.addLayer({ id: "hole-line", type: "line", source: "holes", layout: { "line-cap": "round" }, paint: { "line-color": "#F6C165", "line-width": 2.5, "line-dasharray": [2, 1.4] } });
        map.addLayer({ id: "hole-hl", type: "line", source: "holes", layout: { "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 5 }, filter: ["==", ["get", "hole"], -1] });

        // flight overlay (real shots projected onto the hole)
        map.addSource("flight", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({ id: "flight-seg", type: "line", source: "flight", filter: ["==", ["geometry-type"], "LineString"], layout: { "line-cap": "round" }, paint: { "line-color": ["get", "color"], "line-width": 4 } });
        map.addLayer({ id: "flight-pt", type: "circle", source: "flight", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": ["get", "color"], "circle-radius": 5, "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });

        // baskets — branded basket pin
        map.addSource("baskets", { type: "geojson", data: pointCollection(playable, "basket") });
        map.addLayer({ id: "baskets", type: "symbol", source: "baskets", layout: { "icon-image": "basket-pin", "icon-size": 0.87, "icon-anchor": "bottom", "icon-allow-overlap": true } });

        // tees — numbered gold markers (with a larger highlight overlay)
        map.addSource("tees", { type: "geojson", data: pointCollection(playable, "tee") });
        map.addLayer({ id: "tees", type: "symbol", source: "tees", layout: { "icon-image": ["get", "icon"], "icon-size": 0.9, "icon-allow-overlap": true } });
        map.addLayer({ id: "tee-hl", type: "symbol", source: "tees", filter: ["==", ["get", "hole"], -1], layout: { "icon-image": ["get", "icon"], "icon-size": 1.3, "icon-allow-overlap": true } });

        // interactions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const click = (e: any) => onHoleRef.current?.((e.features?.[0]?.properties as { hole?: number } | undefined)?.hole ?? null);
        for (const lyr of ["hole-line", "tees", "baskets"]) {
          map.on("click", lyr, click);
          map.on("mouseenter", lyr, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", lyr, () => (map.getCanvas().style.cursor = ""));
        }
      });
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer) return;
    try {
      if (map.getLayer("hole-hl")) map.setFilter("hole-hl", ["==", ["get", "hole"], highlightHole ?? -1]);
      if (map.getLayer("tee-hl")) map.setFilter("tee-hl", ["==", ["get", "hole"], highlightHole ?? -1]);
    } catch {}
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

function pointCollection(holes: CourseHole[], kind: "tee" | "basket") {
  return {
    type: "FeatureCollection" as const,
    features: holes.map((h) => ({
      type: "Feature" as const,
      properties: { hole: h.holeNumber, icon: `tee-${h.holeNumber}` },
      geometry: { type: "Point" as const, coordinates: kind === "tee" ? [h.teeLng!, h.teeLat!] : [h.basketLng!, h.basketLat!] },
    })),
  };
}
