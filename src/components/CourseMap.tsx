"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { slugify, type Course } from "@/lib/courses";

// URL-restricted token works on radiusdiscgolf.com. For localhost/other domains, set
// NEXT_PUBLIC_MAPBOX_TOKEN to an unrestricted token (or add the domain in the Mapbox dashboard).
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoibWlrZXkzIiwiYSI6ImNtb3Fra25hZzB6dnIycHB6ZHMxcjIwNHYifQ.tyyS7i-aoR54_l11rW0Khg";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function toGeoJSON(courses: Course[]) {
  return {
    type: "FeatureCollection" as const,
    features: courses
      .filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number")
      .map((c) => ({
        type: "Feature" as const,
        id: c.id,
        properties: {
          cid: c.id,
          name: c.name,
          loc: [c.city, c.state].filter(Boolean).join(", "),
          holeCount: c.holeCount,
          par: c.par,
          rating: c.rating ?? 0,
          photo: c.coverPhotoUrl ?? "",
          slug: slugify(c.name, c.id),
        },
        geometry: { type: "Point" as const, coordinates: [c.longitude as number, c.latitude as number] },
      })),
  };
}

export default function CourseMap({
  courses,
  filterActive,
  highlightId,
  flyTo,
  userLoc,
  onSelect,
  onLocate,
  onBoundsChange,
  mode = "pins",
  className,
}: {
  courses: Course[];
  filterActive: boolean;
  highlightId?: string | null;
  flyTo?: { lng: number; lat: number; zoom?: number } | null;
  userLoc?: { lng: number; lat: number } | null;
  onSelect?: (id: string) => void;
  onLocate?: (loc: { lng: number; lat: number }) => void;
  onBoundsChange?: (b: { west: number; south: number; east: number; north: number }) => void;
  mode?: "pins" | "heat";
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const readyRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onLocateRef = useRef(onLocate);
  onLocateRef.current = onLocate;
  const flyToRef = useRef(flyTo);
  flyToRef.current = flyTo;
  const userLocRef = useRef(userLoc);
  userLocRef.current = userLoc;
  const onBoundsChangeRef = useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !elRef.current || mapRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: elRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [-95.7, 37.8],
        zoom: 3.4,
        projection: "globe",
        attributionControl: false,
      });
      mapRef.current = map;
      // "My location" control, stacked ABOVE the +/- zoom controls.
      const locateCtrl = {
        onAdd(m: typeof map) {
          const div = document.createElement("div");
          div.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
          const b = document.createElement("button");
          b.type = "button";
          b.title = "My location";
          b.setAttribute("aria-label", "My location");
          b.style.cssText = "display:flex;align-items:center;justify-content:center";
          b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#9a7a3a" xmlns="http://www.w3.org/2000/svg"><path d="M21.43 2.57a1 1 0 0 0-1.09-.22L3.53 9.06c-.97.39-.9 1.79.1 2.09l6.43 1.93 1.93 6.43c.3 1 1.7 1.07 2.09.1l6.71-16.8a1 1 0 0 0-.36-1.24z"/></svg>';
          b.onclick = () => {
            if (!navigator.geolocation) return;
            b.style.opacity = "0.5";
            navigator.geolocation.getCurrentPosition(
              (pos) => { const lng = pos.coords.longitude, lat = pos.coords.latitude; m.flyTo({ center: [lng, lat], zoom: 11, duration: 900 }); onLocateRef.current?.({ lng, lat }); b.style.opacity = "1"; },
              () => { b.style.opacity = "1"; },
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
            );
          };
          div.appendChild(b);
          (this as { _div?: HTMLElement })._div = div;
          return div;
        },
        onRemove() { (this as { _div?: HTMLElement })._div?.remove(); },
      };
      map.addControl(locateCtrl, "top-right");
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

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

      map.on("load", async () => {
        if (cancelled) return;
        map.resize();
        await loadPin();
        if (cancelled) return;
        // Every course shown as its own basket pin (no clustering) — matches the live site.
        map.addSource("courses", { type: "geojson", data: toGeoJSON(courses), promoteId: "cid" });
        // density heatmap (toggled on via mode="heat")
        map.addLayer({ id: "heat", type: "heatmap", source: "courses", layout: { visibility: mode === "heat" ? "visible" : "none" }, paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 9, 1.5],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 14, 6, 26, 10, 42],
          "heatmap-opacity": 0.85,
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "rgba(95,207,128,0.45)", 0.4, "#5fcf80", 0.6, "#F6C165", 0.8, "#efab3e", 1, "#e0473f"],
        } });
        map.addLayer({ id: "points", type: "symbol", source: "courses", layout: {
          "icon-image": "basket-pin",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 3, 0.85, 6, 1.05, 10, 1.3],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          visibility: mode === "heat" ? "none" : "visible",
        } });
        // highlighted pin (from list hover) — a slightly larger overlay
        map.addLayer({ id: "points-hl", type: "symbol", source: "courses", filter: ["==", ["get", "cid"], "__none__"], layout: {
          "icon-image": "basket-pin",
          "icon-size": 1.7,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
        } });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("click", "points", (e: any) => {
          const f = e.features[0];
          const p = f.properties;
          const photo = p.photo ? `<img src="${p.photo}" style="width:100%;height:90px;object-fit:cover;border-radius:10px 10px 0 0;display:block" alt="">` : "";
          const rating = Number(p.rating) > 0 ? `<span style="color:#9a7a3a;font-size:0.72rem;font-weight:700">★ ${Number(p.rating).toFixed(1)}</span>` : "";
          new mapboxgl.Popup({ offset: 14, closeButton: false, maxWidth: "230px" })
            .setLngLat(f.geometry.coordinates)
            .setHTML(`<a href="/courses/${p.slug}" style="display:block;text-decoration:none;border-radius:12px;overflow:hidden">${photo}<div style="padding:8px 10px 10px"><strong style="font-family:Sora,sans-serif;color:#16221b;font-size:0.95rem">${esc(p.name)}</strong><div style="color:#6b7a70;font-size:0.75rem;margin-top:1px">${esc(p.loc || "")}</div><div style="margin-top:5px;display:flex;gap:8px;align-items:center"><span style="color:#16221b;font-size:0.75rem;font-weight:700">${p.holeCount} holes · Par ${p.par}</span>${rating}</div><div style="margin-top:7px;background:#16221b;color:#F5EDE1;border-radius:999px;padding:5px 0;text-align:center;font-size:0.72rem;font-weight:700">View course →</div></div></a>`)
            .addTo(map);
          onSelectRef.current?.(p.cid);
        });
        map.on("mouseenter", "points", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "points", () => (map.getCanvas().style.cursor = ""));
        // Emit the visible viewport so the list pane can filter to courses in view (zoom/pan to filter).
        const emitBounds = () => { const bb = map.getBounds(); if (!bb) return; onBoundsChangeRef.current?.({ west: bb.getWest(), south: bb.getSouth(), east: bb.getEast(), north: bb.getNorth() }); };
        map.on("moveend", emitBounds);
        emitBounds();
        readyRef.current = true;
        // Apply any geolocation that resolved before the map finished loading.
        if (flyToRef.current) {
          map.flyTo({ center: [flyToRef.current.lng, flyToRef.current.lat], zoom: flyToRef.current.zoom ?? 10, duration: 0 });
        } else if (filterActive) {
          fit(map, mapboxgl, courses);
        }
        if (userLocRef.current) {
          const el = document.createElement("div");
          el.style.cssText = "width:18px;height:18px;border-radius:50%;background:#4d94fa;border:3px solid #fff;box-shadow:0 0 0 4px rgba(77,148,250,0.3)";
          userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([userLocRef.current.lng, userLocRef.current.lat]).addTo(map);
        }
      });
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; readyRef.current = false; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // data updates
  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map || !readyRef.current || !map.getSource("courses")) return;
      map.getSource("courses").setData(toGeoJSON(courses));
      if (filterActive) { const mapboxgl = (await import("mapbox-gl")).default; fit(map, mapboxgl, courses); }
    })();
  }, [courses, filterActive]);

  // highlight from list hover (enlarged overlay pin)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.getLayer || !map.getLayer("points-hl")) return;
    try { map.setFilter("points-hl", ["==", ["get", "cid"], highlightId ?? "__none__"]); } catch {}
  }, [highlightId]);

  // pins ↔ heatmap toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.getLayer || !map.getLayer("heat")) return;
    const heat = mode === "heat";
    ["points", "points-hl"].forEach((l) => map.getLayer(l) && map.setLayoutProperty(l, "visibility", heat ? "none" : "visible"));
    map.setLayoutProperty("heat", "visibility", heat ? "visible" : "none");
  }, [mode]);

  useEffect(() => { if (flyTo && mapRef.current) mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 10, duration: 900 }); }, [flyTo]);

  useEffect(() => {
    (async () => {
      if (!userLoc || !mapRef.current) return;
      const mapboxgl = (await import("mapbox-gl")).default;
      if (userMarkerRef.current) userMarkerRef.current.remove();
      const el = document.createElement("div");
      el.style.cssText = "width:18px;height:18px;border-radius:50%;background:#4d94fa;border:3px solid #fff;box-shadow:0 0 0 4px rgba(77,148,250,0.3)";
      userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([userLoc.lng, userLoc.lat]).addTo(mapRef.current);
    })();
  }, [userLoc]);

  return <div ref={elRef} className={className ?? "isolate h-[600px] w-full overflow-hidden rounded-2xl border border-black/8 shadow-sm"} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fit(map: any, mapboxgl: any, courses: Course[]) {
  const pts = courses.filter((c) => typeof c.latitude === "number" && typeof c.longitude === "number");
  if (pts.length === 0) return;
  const b = new mapboxgl.LngLatBounds();
  pts.forEach((c) => b.extend([c.longitude as number, c.latitude as number]));
  map.fitBounds(b, { padding: 60, maxZoom: 12, duration: 600 });
}
