"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "mapbox-gl/dist/mapbox-gl.css";
import { createCourse, findNearbyCourses, distanceFt, slugify, type HoleDraft, type Course } from "@/lib/courses";
import { storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoibWlrZXkzIiwiYSI6ImNtb3Fra25hZzB6dnIycHB6ZHMxcjIwNHYifQ.tyyS7i-aoR54_l11rW0Khg";

const TERRAINS = ["Mixed", "Open", "Wooded", "Hilly", "Desert", "Coastal"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced", "Pro"];
const DIFF_COLOR: Record<string, string> = { Beginner: "#4AA861", Intermediate: "#3385CC", Advanced: "#E0752A", Pro: "#F6C165" };
const PRO_GRADIENT = "linear-gradient(135deg, #FFD452, #F6C165, #CC6B1A)";
function diffStyle(label: string, on: boolean): React.CSSProperties {
  const c = DIFF_COLOR[label] || "#4AA861";
  const isPro = label === "Pro";
  if (on) return { background: isPro ? PRO_GRADIENT : c, color: "#fff", border: `1px solid ${isPro ? "rgba(255,255,255,0.45)" : c}`, boxShadow: isPro ? "0 5px 18px rgba(246,193,101,0.6)" : `0 5px 18px ${c}73`, transform: "translateY(-1px)" };
  return { background: isPro ? "rgba(246,193,101,0.1)" : `${c}14`, color: isPro ? "#9a7a3a" : c, border: `1.5px solid ${isPro ? "rgba(246,193,101,0.5)" : c + "59"}` };
}
const AMENITIES = ["Parking", "Restrooms", "Water", "Lighting", "Picnic Area", "Camping", "Pro Shop", "Food"];
const STEPS = ["Details", "Map holes", "Review"];
// Exact 9 alt-basket presets (hex WITHOUT #, matching AltBasketColor). Default = Blue.
const ALT_COLORS: { name: string; hex: string }[] = [
  { name: "Red", hex: "E74C3C" }, { name: "Orange", hex: "E67E22" }, { name: "Yellow", hex: "F1C40F" },
  { name: "Green", hex: "2ECC71" }, { name: "Teal", hex: "1ABC9C" }, { name: "Blue", hex: "3498DB" },
  { name: "Purple", hex: "9B59B6" }, { name: "Pink", hex: "E91E63" }, { name: "White", hex: "FFFFFF" },
];
const DEFAULT_COLOR = "3498DB";
const MAX_ALT = 3, MAX_MANDO = 4;

type Dir = "Left" | "Right" | "Down";
type AltTee = { id: string; label: string; lat: number; lng: number };
type AltBasket = { id: string; label: string; lat: number; lng: number; colorHex: string };
type Mando = { id: string; lat: number; lng: number; direction: Dir; label: string };
// elbows are [lng,lat] internally (Mapbox); alt/mando store lat,lng (app shape).
type Hole = { par: number; teeLat?: number; teeLng?: number; basketLat?: number; basketLng?: number; elbows: [number, number][]; altTees: AltTee[]; altBaskets: AltBasket[]; mandos: Mando[]; notes: string };
const blankHole = (): Hole => ({ par: 3, elbows: [], altTees: [], altBaskets: [], mandos: [], notes: "" });
const mapped = (h: Hole) => h.teeLat != null && h.basketLat != null;
type Mode = "tee" | "basket" | "elbow" | "altTee" | "altBasket" | "mando";
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().toUpperCase() : `${Date.now()}-${Math.random().toString(36).slice(2)}`.toUpperCase());
// Mando labels: single = "M", multiple = "M1","M2"… (matches the apps).
const renumberMandos = (ms: Mando[]): Mando[] => (ms.length === 1 ? [{ ...ms[0], label: "M" }] : ms.map((m, i) => ({ ...m, label: `M${i + 1}` })));

function bearing(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toR = (d: number) => (d * Math.PI) / 180, toDg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toR(bLng - aLng)) * Math.cos(toR(bLat));
  const x = Math.cos(toR(aLat)) * Math.sin(toR(bLat)) - Math.sin(toR(aLat)) * Math.cos(toR(bLat)) * Math.cos(toR(bLng - aLng));
  return (toDg(Math.atan2(y, x)) + 360) % 360;
}
function ringCoords(lng: number, lat: number, radiusFt: number, pts = 64): number[][] {
  const radM = radiusFt * 0.3048, R = 6378137, out: number[][] = [];
  for (let i = 0; i <= pts; i++) { const a = (i / pts) * 2 * Math.PI, dx = radM * Math.cos(a), dy = radM * Math.sin(a); out.push([lng + (dx / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI), lat + (dy / R) * (180 / Math.PI)]); }
  return out;
}
function fairway(h: Hole): number[][] {
  const p: number[][] = [];
  if (h.teeLat != null) p.push([h.teeLng!, h.teeLat!]);
  for (const e of h.elbows) p.push(e);
  if (h.basketLat != null) p.push([h.basketLng!, h.basketLat!]);
  return p;
}
function holeDistFt(h: Hole): number {
  const p = fairway(h); let d = 0;
  for (let i = 1; i < p.length; i++) d += distanceFt(p[i - 1][1], p[i - 1][0], p[i][1], p[i][0]);
  return Math.round(d);
}
function teeBearing(h: Hole): number {
  if (h.teeLat == null) return 0;
  const t = h.elbows[0] ?? (h.basketLat != null ? [h.basketLng!, h.basketLat!] : null);
  return t ? bearing(h.teeLat, h.teeLng!, t[1], t[0]) - 90 : 0;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const FIELD = "w-full rounded-xl border border-black/[0.08] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#16221b] outline-none placeholder-[#b3bbb2] transition-all focus:border-[var(--gold)] focus:bg-white focus:ring-2 focus:ring-[var(--gold)]/20";
const LABEL = "mb-1.5 block text-xs font-semibold text-[#46554c]";
const pill = (on: boolean) => `rounded-xl border py-2 text-xs font-bold transition-all ${on ? "border-[var(--gold)] bg-[var(--gold)] text-[#16221b] shadow-[0_2px_8px_-2px_rgba(246,193,101,0.6)]" : "border-black/[0.08] bg-white text-[#46554c] hover:border-black/20 hover:text-[#16221b]"}`;
const seg = (on: boolean) => `flex-1 rounded-xl border py-2.5 text-sm font-bold transition-all ${on ? "border-[var(--gold)] bg-[var(--gold)] text-[#16221b] shadow-[0_2px_8px_-2px_rgba(246,193,101,0.6)]" : "border-black/[0.08] bg-white text-[#46554c] hover:border-black/20"}`;

export default function CourseBuilder({ uid }: { uid: string }) {
  const router = useRouter();
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapErr, setMapErr] = useState("");
  const [courseId] = useState(() => newId());
  const DRAFT_KEY = `radius_course_draft_${uid}`;

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [holeCountText, setHoleCountText] = useState("18");
  const [description, setDescription] = useState("");
  const [courseType, setCourseType] = useState("Public");
  const [terrain, setTerrain] = useState("Mixed");
  const [difficulty, setDifficulty] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [feeAmount, setFeeAmount] = useState(0);
  const [amenities, setAmenities] = useState<Set<string>>(new Set());
  const [coverPhotoUrl, setCoverPhotoUrl] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lng: number; city: string; state: string } | null>(null);
  const [search, setSearch] = useState("");

  const [holes, setHoles] = useState<Hole[]>([]);
  const [cur, setCur] = useState(0);
  const [mode, setMode] = useState<Mode>("tee");
  const [undo, setUndo] = useState<Hole[][]>([]);
  const [pending, setPending] = useState<null | { mode: "altTee" | "altBasket" | "mando"; lng: number; lat: number; label: string; colorHex: string; direction: Dir }>(null);

  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const [dupes, setDupes] = useState<Course[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resume, setResume] = useState<null | (() => void)>(null);

  const stepRef = useRef(step); stepRef.current = step;
  const modeRef = useRef(mode); modeRef.current = mode;
  const curRef = useRef(cur); curRef.current = cur;
  const holesRef = useRef(holes); holesRef.current = holes;
  const hydrated = useRef(false);

  const holeCount = Math.max(0, Math.min(27, parseInt(holeCountText, 10) || 0));

  const snapshot = (hs: Hole[]) => hs.map((h) => ({ ...h, elbows: [...h.elbows], altTees: [...h.altTees], altBaskets: [...h.altBaskets], mandos: [...h.mandos] }));

  // ---------- draft autosave / resume ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return;
      const d = JSON.parse(raw); if (!d || (!d.name && !(d.holes?.length))) return;
      setResume(() => () => {
        setName(d.name || ""); setHoleCountText(d.holeCountText || "18"); setDescription(d.description || "");
        setCourseType(d.courseType || "Public"); setTerrain(d.terrain || "Mixed"); setDifficulty(d.difficulty || "");
        setIsFree(d.isFree ?? true); setFeeAmount(d.feeAmount || 0); setAmenities(new Set(d.amenities || []));
        setCoverPhotoUrl(d.coverPhotoUrl || ""); setLoc(d.loc || null);
        setHoles(Array.isArray(d.holes) ? d.holes.map((h: Partial<Hole>) => ({ par: h.par ?? 3, teeLat: h.teeLat, teeLng: h.teeLng, basketLat: h.basketLat, basketLng: h.basketLng, elbows: h.elbows || [], altTees: h.altTees || [], altBaskets: h.altBaskets || [], mandos: h.mandos || [], notes: h.notes || "" })) : []);
        setStep(d.step || 0); setCur(d.cur || 0); hydrated.current = true; setResume(null);
        if (d.loc) setTimeout(() => mapRef.current?.flyTo({ center: [d.loc.lng, d.loc.lat], zoom: 16 }), 300);
      });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resume) return;
    const t = setTimeout(() => {
      try { if (!name && holes.length === 0) return; localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, holeCountText, description, courseType, terrain, difficulty, isFree, feeAmount, amenities: [...amenities], coverPhotoUrl, loc, holes, step, cur, ts: Date.now() })); } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [name, holeCountText, description, courseType, terrain, difficulty, isFree, feeAmount, amenities, coverPhotoUrl, loc, holes, step, cur, resume, DRAFT_KEY]);

  // ---------- map ----------
  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | undefined;
    (async () => {
     try {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!elRef.current) { setMapErr("Map container didn't mount."); return; }
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({ container: elRef.current, style: "mapbox://styles/mapbox/satellite-streets-v12", projection: "mercator", center: [-98.5, 39.5], zoom: 3.4, attributionControl: false });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showUserLocation: true }), "top-right");
      map.on("error", (e: { error?: { message?: string; status?: number } }) => { const m = e?.error?.message || (e?.error?.status ? `HTTP ${e.error.status}` : ""); if (m) setMapErr(m); });
      ro = new ResizeObserver(() => { try { map.resize(); } catch {} });
      ro.observe(elRef.current);

      map.on("load", () => {
        if (cancelled) return;
        map.resize();
        if (!hydrated.current && typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => { if (!cancelled && !hydrated.current) map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16, duration: 1200 }); }, () => {}, { enableHighAccuracy: true, timeout: 8000 });
        }
        // Use the app's real BasketIcon, tinted gold (primary) and into the 9 alt-basket colors.
        const bimg = new Image();
        bimg.onload = () => {
          try {
            const s = 2, w = 64 * s, h = 64 * s;
            const make = (nm: string, color: string) => {
              const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d"); if (!c) return;
              c.drawImage(bimg, 0, 0, w, h);
              c.globalCompositeOperation = "source-in"; c.fillStyle = color; c.fillRect(0, 0, w, h);
              if (!map.hasImage(nm)) map.addImage(nm, c.getImageData(0, 0, w, h), { pixelRatio: 2 });
            };
            make("basket-gold", "#F6C165");
            for (const col of ALT_COLORS) make(`altbasket-${col.hex}`, `#${col.hex}`);
          } catch {}
        };
        bimg.src = "/basket-icon.svg";

        const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        for (const id of ["rings", "fairway", "tees", "baskets", "elbows", "altTees", "altBaskets", "mandos", "pending"]) map.addSource(id, { type: "geojson", data: empty });
        const TF = ["DIN Pro Medium", "Arial Unicode MS Regular"];
        map.addLayer({ id: "rings-fill", type: "fill", source: "rings", paint: { "fill-color": "#ffffff", "fill-opacity": ["case", ["==", ["get", "c"], 1], 0.08, 0.04] } });
        map.addLayer({ id: "rings-line", type: "line", source: "rings", paint: { "line-color": "#ffffff", "line-opacity": ["case", ["==", ["get", "c"], 1], 0.35, 0.18], "line-width": 1 } });
        map.addLayer({ id: "fairway-casing", type: "line", source: "fairway", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0f1813", "line-width": 5, "line-opacity": ["case", ["get", "cur"], 0.55, 0.2] } });
        map.addLayer({ id: "fairway", type: "line", source: "fairway", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#F6C165", "line-width": ["case", ["get", "cur"], 3, 1.5], "line-opacity": ["case", ["get", "cur"], 1, 0.35] } });
        map.addLayer({ id: "altBaskets", type: "symbol", source: "altBaskets", layout: { "icon-image": ["concat", "altbasket-", ["get", "colorHex"]], "icon-size": ["case", ["get", "cur"], 1.1, 0.7], "icon-allow-overlap": true, "text-field": ["get", "label"], "text-font": TF, "text-size": 10, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }, paint: { "icon-opacity": ["case", ["get", "cur"], 1, 0.45], "text-color": "#fff", "text-halo-color": "#0f1813", "text-halo-width": 1.4 } });
        map.addLayer({ id: "baskets", type: "symbol", source: "baskets", layout: { "icon-image": "basket-gold", "icon-size": ["case", ["get", "cur"], 1.4, 0.85], "icon-anchor": "center", "icon-allow-overlap": true }, paint: { "icon-opacity": ["case", ["get", "cur"], 1, 0.5] } });
        map.addLayer({ id: "mandos", type: "symbol", source: "mandos", layout: { "icon-image": ["concat", "mando-", ["get", "dir"]], "icon-size": 0.9, "icon-allow-overlap": true, "text-field": ["get", "label"], "text-font": TF, "text-size": 10, "text-offset": [0, -1.3], "text-anchor": "bottom", "text-optional": true }, paint: { "icon-opacity": ["case", ["get", "cur"], 1, 0.45], "text-color": "#F1C40F", "text-halo-color": "#0f1813", "text-halo-width": 1.4 } });
        map.addLayer({ id: "elbows", type: "symbol", source: "elbows", layout: { "icon-image": ["get", "icon"], "icon-size": 0.9, "icon-allow-overlap": true }, paint: { "icon-opacity": ["case", ["get", "cur"], 1, 0.4] } });
        map.addLayer({ id: "altTees", type: "symbol", source: "altTees", layout: { "icon-image": "altpad", "icon-rotate": ["get", "rot"], "icon-rotation-alignment": "map", "icon-size": ["case", ["get", "cur"], 0.85, 0.6], "icon-allow-overlap": true, "text-field": ["get", "label"], "text-font": TF, "text-size": 10, "text-offset": [0, 1.2], "text-anchor": "top", "text-optional": true }, paint: { "icon-opacity": ["case", ["get", "cur"], 1, 0.5], "text-color": "#cfe8d6", "text-halo-color": "#0f1813", "text-halo-width": 1.4 } });
        map.addLayer({ id: "tees", type: "symbol", source: "tees", layout: { "icon-image": ["get", "icon"], "icon-rotate": ["get", "rot"], "icon-rotation-alignment": "map", "icon-size": ["case", ["get", "cur"], 1, 0.7], "icon-allow-overlap": true }, paint: { "icon-opacity": ["case", ["get", "cur"], 1, 0.5] } });
        map.addLayer({ id: "pending", type: "circle", source: "pending", paint: { "circle-radius": 8, "circle-color": "#F6C165", "circle-stroke-width": 2.5, "circle-stroke-color": "#fff", "circle-opacity": 0.85 } });
        setMapReady(true);
      });

      map.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
        if (stepRef.current !== 1) return;
        const i = curRef.current; const pt = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        const m = modeRef.current;
        if (m === "tee" || m === "basket" || m === "elbow") {
          setHoles((hs) => {
            setUndo((u) => [...u.slice(-29), snapshot(hs)]);
            const next = snapshot(hs); if (!next[i]) return hs;
            if (m === "tee") { next[i].teeLat = pt.lat; next[i].teeLng = pt.lng; }
            else if (m === "basket") { next[i].basketLat = pt.lat; next[i].basketLng = pt.lng; }
            else next[i].elbows.push([pt.lng, pt.lat]);
            return next;
          });
          if (m === "tee") setMode("basket");
          else if (m === "basket") { setMode("tee"); setCur((c) => (c + 1 < holeCount ? c + 1 : c)); }
        } else {
          // alt tee / alt basket / mando — capture point, confirm details in the panel
          const h = holesRef.current[i];
          if (m === "altTee" && (h?.teeLat == null || h.altTees.length >= MAX_ALT)) { setError(h?.teeLat == null ? "Place the primary tee first." : "Max 3 alternate tees."); return; }
          if (m === "altBasket" && (h?.basketLat == null || h.altBaskets.length >= MAX_ALT)) { setError(h?.basketLat == null ? "Place the primary basket first." : "Max 3 alternate baskets."); return; }
          if (m === "mando" && (h?.mandos.length ?? 0) >= MAX_MANDO) { setError("Max 4 mandos."); return; }
          setError("");
          setPending({ mode: m, lng: pt.lng, lat: pt.lat, label: "", colorHex: DEFAULT_COLOR, direction: "Left" });
        }
      });
     } catch (err) { setMapErr(err instanceof Error ? err.message : String(err)); }
    })();
    return () => { cancelled = true; ro?.disconnect(); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const m = mapRef.current; if (m?.getCanvas) m.getCanvas().style.cursor = step === 1 ? "crosshair" : ""; }, [step]);
  useEffect(() => { setTimeout(() => mapRef.current?.resize(), 60); }, [step]);

  // render markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getSource) return;
    const ensure = (id: string, draw: (c: CanvasRenderingContext2D, s: number, sz: number) => void, sz = 30) => {
      if (map.hasImage(id)) return; const s = 2, w = sz * s; const cv = document.createElement("canvas"); cv.width = w; cv.height = w; const c = cv.getContext("2d"); if (!c) return; draw(c, s, w); map.addImage(id, c.getImageData(0, 0, w, w), { pixelRatio: 2 });
    };
    // tee pads (numbered) + alt pad + elbows + colored alt baskets + mando arrows
    for (let n = 1; n <= Math.max(holes.length, 1); n++) {
      const id = `teepad-${n}`;
      if (!map.hasImage(id)) { const s = 2, w = 30 * s, h = 16 * s; const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d"); if (c) { roundRectPath(c, s, s, w - 2 * s, h - 2 * s, 3 * s); c.fillStyle = "#16331f"; c.fill(); c.lineWidth = 1.5 * s; c.strokeStyle = "rgba(255,255,255,0.55)"; c.stroke(); c.fillStyle = "#fff"; c.font = `bold ${10 * s}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), w / 2, h / 2 + s * 0.5); map.addImage(id, c.getImageData(0, 0, w, h), { pixelRatio: 2 }); } }
    }
    if (!map.hasImage("altpad")) { const s = 2, w = 24 * s, h = 13 * s; const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d"); if (c) { roundRectPath(c, s, s, w - 2 * s, h - 2 * s, 3 * s); c.fillStyle = "rgba(22,51,31,0.9)"; c.fill(); c.lineWidth = 1.5 * s; c.strokeStyle = "#fff"; c.stroke(); map.addImage("altpad", c.getImageData(0, 0, w, h), { pixelRatio: 2 }); } }
    for (let n = 1; n <= 12; n++) ensure(`elbow-${n}`, (c, s, sz) => { c.translate(sz / 2, sz / 2); c.rotate(Math.PI / 4); roundRectPath(c, -6 * s, -6 * s, 12 * s, 12 * s, 2 * s); c.fillStyle = "#E0752A"; c.fill(); c.rotate(-Math.PI / 4); c.fillStyle = "#fff"; c.font = `bold ${9 * s}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(n), 0, s * 0.5); }, 18);
    for (const d of ["Left", "Right", "Down"]) ensure(`mando-${d}`, (c, s, sz) => { roundRectPath(c, sz * 0.2, sz * 0.12, sz * 0.6, sz * 0.76, 4 * s); c.fillStyle = "#F1C40F"; c.fill(); c.lineWidth = 1.5 * s; c.strokeStyle = "#0f1813"; c.stroke(); c.fillStyle = "#0f1813"; c.font = `bold ${13 * s}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(d === "Left" ? "←" : d === "Right" ? "→" : "↓", sz / 2, sz / 2 + s); }, 26);

    const fc = (features: unknown[]) => ({ type: "FeatureCollection", features } as unknown as GeoJSON.FeatureCollection);
    const rings: unknown[] = [], fairwayF: unknown[] = [], tees: unknown[] = [], baskets: unknown[] = [], elbowsF: unknown[] = [], altTeesF: unknown[] = [], altBasketsF: unknown[] = [], mandosF: unknown[] = [];
    holes.forEach((h, i) => {
      const isCur = i === cur; const tb = teeBearing(h);
      const path = fairway(h);
      if (path.length >= 2) fairwayF.push({ type: "Feature", properties: { cur: isCur }, geometry: { type: "LineString", coordinates: path } });
      if (h.teeLat != null) tees.push({ type: "Feature", properties: { icon: `teepad-${i + 1}`, rot: tb, cur: isCur }, geometry: { type: "Point", coordinates: [h.teeLng, h.teeLat] } });
      if (h.basketLat != null) {
        baskets.push({ type: "Feature", properties: { cur: isCur }, geometry: { type: "Point", coordinates: [h.basketLng, h.basketLat] } });
        if (isCur) { rings.push({ type: "Feature", properties: { c: 2 }, geometry: { type: "Polygon", coordinates: [ringCoords(h.basketLng!, h.basketLat!, 66)] } }); rings.push({ type: "Feature", properties: { c: 1 }, geometry: { type: "Polygon", coordinates: [ringCoords(h.basketLng!, h.basketLat!, 33)] } }); }
      }
      h.elbows.forEach((e, ei) => elbowsF.push({ type: "Feature", properties: { icon: `elbow-${Math.min(ei + 1, 12)}`, cur: isCur }, geometry: { type: "Point", coordinates: e } }));
      h.altTees.forEach((t) => altTeesF.push({ type: "Feature", properties: { label: t.label, rot: tb, cur: isCur }, geometry: { type: "Point", coordinates: [t.lng, t.lat] } }));
      h.altBaskets.forEach((b) => altBasketsF.push({ type: "Feature", properties: { label: b.label, colorHex: b.colorHex, cur: isCur }, geometry: { type: "Point", coordinates: [b.lng, b.lat] } }));
      h.mandos.forEach((mn) => mandosF.push({ type: "Feature", properties: { label: mn.label, dir: mn.direction, cur: isCur }, geometry: { type: "Point", coordinates: [mn.lng, mn.lat] } }));
    });
    map.getSource("rings").setData(fc(rings));
    map.getSource("fairway").setData(fc(fairwayF));
    map.getSource("tees").setData(fc(tees));
    map.getSource("baskets").setData(fc(baskets));
    map.getSource("elbows").setData(fc(elbowsF));
    map.getSource("altTees").setData(fc(altTeesF));
    map.getSource("altBaskets").setData(fc(altBasketsF));
    map.getSource("mandos").setData(fc(mandosF));
    map.getSource("pending").setData(fc(pending ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [pending.lng, pending.lat] } }] : []));
  }, [holes, cur, mapReady, pending]);

  async function geocode(e: React.FormEvent) {
    e.preventDefault(); const q = search.trim(); if (!q) return;
    try { const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&limit=1&types=place,locality,address,poi,region`); const f = (await r.json()).features?.[0]; if (f?.center) mapRef.current?.flyTo({ center: f.center, zoom: 16 }); } catch {}
  }
  async function setLocationToCenter() {
    const map = mapRef.current; if (!map) return; const c = map.getCenter(); let city = "", state = "";
    try { const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${c.lng},${c.lat}.json?access_token=${TOKEN}&types=place,region&limit=1`); const feats = (await r.json()).features || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const f of feats as any[]) { if (f.id?.startsWith("place")) city = city || f.text; const region = (f.context || []).find((x: { id: string }) => x.id.startsWith("region")); if (region) state = state || region.text; if (f.id?.startsWith("region")) state = state || f.text; }
    } catch {}
    setLoc({ lat: c.lat, lng: c.lng, city, state });
  }

  const goMap = () => {
    if (!name.trim()) return setError("Add a course name.");
    if (holeCount < 1) return setError("Enter how many holes (1–27).");
    if (!description.trim()) return setError("Add a short description.");
    if (!loc) return setError("Set the course location.");
    setError(""); setHoles((hs) => { const n = [...hs]; while (n.length < holeCount) n.push(blankHole()); n.length = holeCount; return n; });
    setCur(0); setMode("tee"); setStep(1); if (loc) mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 16 });
  };
  const allMapped = holes.length === holeCount && holes.every(mapped);
  const focusHole = (i: number) => { setPending(null); setCur(i); setMode(holes[i] && holes[i].teeLat == null ? "tee" : holes[i].basketLat == null ? "basket" : "tee"); const h = holes[i]; if (h?.teeLat != null) mapRef.current?.flyTo({ center: [h.teeLng, h.teeLat], zoom: 17 }); };
  const doUndo = () => setUndo((u) => { if (!u.length) return u; setHoles(snapshot(u[u.length - 1])); return u.slice(0, -1); });
  const clearHole = () => { setUndo((u) => [...u.slice(-29), snapshot(holes)]); setHoles((hs) => hs.map((h, i) => (i === cur ? { ...blankHole(), par: h.par, notes: h.notes } : h))); setMode("tee"); setPending(null); };
  const setPar = (p: number) => setHoles((hs) => hs.map((h, i) => (i === cur ? { ...h, par: p } : h)));
  const setNotes = (v: string) => setHoles((hs) => hs.map((h, i) => (i === cur ? { ...h, notes: v } : h)));
  const mutateCur = (fn: (h: Hole) => Hole) => { setUndo((u) => [...u.slice(-29), snapshot(holes)]); setHoles((hs) => hs.map((h, i) => (i === cur ? fn(h) : h))); };

  const confirmPending = () => {
    if (!pending) return; const p = pending;
    mutateCur((h) => {
      if (p.mode === "altTee") return { ...h, altTees: [...h.altTees, { id: newId(), label: p.label.trim() || `Alt ${h.altTees.length + 1}`, lat: p.lat, lng: p.lng }] };
      if (p.mode === "altBasket") return { ...h, altBaskets: [...h.altBaskets, { id: newId(), label: p.label.trim() || `Alt ${h.altBaskets.length + 1}`, lat: p.lat, lng: p.lng, colorHex: p.colorHex }] };
      return { ...h, mandos: renumberMandos([...h.mandos, { id: newId(), lat: p.lat, lng: p.lng, direction: p.direction, label: "" }]) };
    });
    setPending(null);
  };
  const removeAltTee = (id: string) => mutateCur((h) => ({ ...h, altTees: h.altTees.filter((t) => t.id !== id) }));
  const removeAltBasket = (id: string) => mutateCur((h) => ({ ...h, altBaskets: h.altBaskets.filter((b) => b.id !== id) }));
  const removeMando = (id: string) => mutateCur((h) => ({ ...h, mandos: renumberMandos(h.mandos.filter((m) => m.id !== id)) }));
  const removeTee = () => mutateCur((h) => ({ ...h, teeLat: undefined, teeLng: undefined }));
  const removeBasket = () => mutateCur((h) => ({ ...h, basketLat: undefined, basketLng: undefined }));
  const removeElbow = (idx: number) => mutateCur((h) => ({ ...h, elbows: h.elbows.filter((_, i) => i !== idx) }));
  const renameAltTee = (id: string, v: string) => setHoles((hs) => hs.map((h, i) => (i === cur ? { ...h, altTees: h.altTees.map((t) => (t.id === id ? { ...t, label: v } : t)) } : h)));
  const editAltBasket = (id: string, patch: Partial<AltBasket>) => setHoles((hs) => hs.map((h, i) => (i === cur ? { ...h, altBaskets: h.altBaskets.map((b) => (b.id === id ? { ...b, ...patch } : b)) } : h)));
  const setMandoDir = (id: string, d: Dir) => setHoles((hs) => hs.map((h, i) => (i === cur ? { ...h, mandos: h.mandos.map((m) => (m.id === id ? { ...m, direction: d } : m)) } : h)));

  async function onCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true); setError("");
    try { const r = storageRef(storage, `courses/${uid}/${courseId}/cover.jpg`); await uploadBytes(r, file, { contentType: file.type || "image/jpeg" }); setCoverPhotoUrl(await getDownloadURL(r)); }
    catch (err) { const er = err as { code?: string; message?: string }; setError(`Photo upload failed: ${er.code || er.message || "unknown error"}`); }
    setUploading(false);
  }

  async function submit() {
    setError("");
    const built: HoleDraft[] = holes.filter(mapped).map((h) => ({ par: h.par, teeLat: h.teeLat!, teeLng: h.teeLng!, basketLat: h.basketLat!, basketLng: h.basketLng!, notes: h.notes, elbows: h.elbows.map(([lng, lat]) => ({ lat, lng })), alternateTees: h.altTees, alternateBaskets: h.altBaskets, mandos: h.mandos }));
    if (built.length === 0) { setError("Map at least one hole."); return; }
    if (dupes === null && loc) { const near = await findNearbyCourses(loc.lat, loc.lng, name); if (near.length > 0) { setDupes(near); return; } setDupes([]); }
    setStatus("saving");
    const id = await createCourse(uid, { name, city: loc?.city, state: loc?.state, latitude: loc?.lat, longitude: loc?.lng, description, courseType, terrain, manualDifficulty: difficulty, amenities: [...amenities], isFree, courseFeeAmount: isFree ? 0 : Number(feeAmount) || 0, coverPhotoUrl, holes: built }, courseId);
    if (!id) { setStatus("error"); setError("Couldn't save the course. Please try again."); return; }
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    router.push(`/courses/${slugify(name, id)}`);
  }

  const curHole = holes[cur];
  const mappedCount = holes.filter(mapped).length;
  const totalPar = holes.reduce((s, h) => s + (h.par || 0), 0);
  const MODES: { k: Mode; label: string; color: string; on: boolean }[] = [
    { k: "tee", label: curHole?.teeLat != null ? "✓ Tee" : "Tee", color: "#16331f", on: true },
    { k: "basket", label: curHole?.basketLat != null ? "✓ Basket" : "Basket", color: "#F6C165", on: true },
    { k: "elbow", label: `Dogleg${curHole?.elbows.length ? ` (${curHole.elbows.length})` : ""}`, color: "#E0752A", on: true },
    { k: "altTee", label: `Alt tee${curHole?.altTees.length ? ` (${curHole.altTees.length})` : ""}`, color: "#16331f", on: !!curHole?.teeLat },
    { k: "altBasket", label: `Alt basket${curHole?.altBaskets.length ? ` (${curHole.altBaskets.length})` : ""}`, color: "#3498DB", on: !!curHole?.basketLat },
    { k: "mando", label: `Mando${curHole?.mandos.length ? ` (${curHole.mandos.length})` : ""}`, color: "#caa106", on: true },
  ];
  const modePreview = (k: Mode, active: boolean) => {
    if (k === "tee") return <span className="h-3.5 w-6 shrink-0 rounded-[3px]" style={{ background: active ? "#fff" : "#16331f" }} />;
    if (k === "altTee") return <span className="h-3 w-5 shrink-0 rounded-[3px]" style={{ background: active ? "#fff" : "#16331f" }} />;
    if (k === "elbow") return <span className="h-3.5 w-3.5 shrink-0 rotate-45 rounded-[2px]" style={{ background: active ? "#fff" : "#E0752A" }} />;
    if (k === "mando") return <span className="grid h-5 w-4 shrink-0 place-items-center rounded-[3px] text-[10px] font-bold text-[#16221b]" style={{ background: active ? "#fff" : "#F1C40F" }}>→</span>;
    return <span className="h-7 w-7 shrink-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url(/basket-icon.svg)", filter: active ? "brightness(0) invert(1)" : "none" }} />;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/courses/mine" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7a70] transition-colors hover:text-[#16221b]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Back to my courses
      </Link>
      <div className="mb-7">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9a7a3a]">Course builder</div>
        <h1 className="mt-1.5 font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] text-[#16221b]">Build a course</h1>
        <p className="mt-2 max-w-xl text-sm text-[#6b7a70]">Map your local course hole by hole. It auto-saves as a private <span className="font-semibold text-[#46554c]">draft</span> — only you can see it until it&apos;s reviewed and published.</p>
        <div className="mt-5 inline-flex items-center gap-1 rounded-2xl border border-black/[0.06] bg-white p-1.5 shadow-sm">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${i === step ? "bg-[#16221b] text-[var(--cream)]" : "text-[#8a968d]"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i === step ? "bg-[var(--gold)] text-[#16221b]" : i < step ? "bg-[var(--gold)]/30 text-[#9a7a3a]" : "bg-black/[0.06] text-[#8a968d]"}`}>{i < step ? "✓" : i + 1}</span>
                {s}
              </div>
              {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-6 bg-black/10" />}
            </div>
          ))}
        </div>
      </div>

      {resume && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-3">
          <span className="text-sm font-semibold text-[#9a7a3a]">You have an unfinished course draft.</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => resume()} className="rounded-full bg-[#16221b] px-4 py-2 text-xs font-bold text-[var(--cream)] hover:bg-[#22332a]">Resume draft</button>
            <button onClick={() => { try { localStorage.removeItem(DRAFT_KEY); } catch {} setResume(null); }} className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold text-[#46554c] hover:border-black/20">Start fresh</button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        <div className="min-w-0">
          <div className="rounded-3xl border border-black/[0.07] bg-white p-6 shadow-[0_18px_50px_-26px_rgba(15,24,19,0.32)]">
          {step === 0 && (
            <div className="space-y-4">
              <label className="block"><span className={LABEL}>Course name *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maple Hill" className={FIELD} /></label>
              <div>
                <span className={LABEL}>Location *</span>
                <form onSubmit={geocode} className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search an address or town…" className={FIELD} /><button type="submit" className="shrink-0 rounded-xl border border-black/[0.08] bg-white px-4 text-sm font-bold text-[#16221b] transition-colors hover:border-[var(--gold)]">Find</button></form>
                <button onClick={setLocationToCenter} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 py-2.5 text-sm font-bold text-[#9a7a3a] transition-colors hover:bg-[var(--gold)]/20">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
                  Set location to map center
                </button>
                {loc && <p className="mt-2 rounded-lg bg-[#faf9f5] px-3 py-2 text-xs text-[#46554c]">📍 {loc.city || "—"}{loc.state ? `, ${loc.state}` : ""} <span className="text-[#a3aca4]">· {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span></p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className={LABEL}>Holes *</span><input type="number" min={1} max={27} value={holeCountText} onChange={(e) => setHoleCountText(e.target.value)} className={FIELD} /></label>
                <div><span className={LABEL}>Course type</span><div className="flex gap-2">{["Public", "Private"].map((t) => <button key={t} onClick={() => setCourseType(t)} className={seg(courseType === t)}>{t}</button>)}</div></div>
              </div>
              <label className="block"><span className={LABEL}>Description *</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What makes this course great?" className={`${FIELD} resize-none`} /></label>
              <div><span className={LABEL}>Terrain</span><div className="grid grid-cols-3 gap-2">{TERRAINS.map((t) => <button key={t} onClick={() => setTerrain(t)} className={pill(terrain === t)}>{t}</button>)}</div></div>
              <div><span className={LABEL}>Difficulty</span><div className="grid grid-cols-3 gap-2"><button onClick={() => setDifficulty("")} className={pill(difficulty === "")}>Auto</button>{DIFFICULTIES.map((dd) => <button key={dd} onClick={() => setDifficulty(dd)} style={diffStyle(dd, difficulty === dd)} className="rounded-xl py-2 text-xs font-extrabold transition-all">{dd}</button>)}</div></div>
              <div><span className={LABEL}>Cost</span><div className="flex items-center gap-2"><button onClick={() => setIsFree(true)} className={seg(isFree)}>Free</button><button onClick={() => setIsFree(false)} className={seg(!isFree)}>Pay to play</button>{!isFree && <input type="number" value={feeAmount} onChange={(e) => setFeeAmount(Number(e.target.value))} placeholder="$" className="w-20 rounded-xl border border-black/[0.08] bg-[#faf9f5] px-2 py-2.5 text-sm outline-none focus:border-[var(--gold)]" />}</div></div>
              <div><span className={LABEL}>Amenities</span><div className="grid grid-cols-2 gap-2">{AMENITIES.map((a) => { const on = amenities.has(a); return <button key={a} onClick={() => setAmenities((s) => { const n = new Set(s); if (n.has(a)) n.delete(a); else n.add(a); return n; })} className={pill(on)}>{on ? "✓ " : ""}{a}</button>; })}</div></div>
              <div>
                <span className={LABEL}>Cover photo</span>
                {coverPhotoUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-black/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverPhotoUrl} alt="Cover" className="h-32 w-full object-cover" />
                    <button onClick={() => setCoverPhotoUrl("")} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                  </div>
                ) : (
                  <label className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/15 bg-[#faf9f5] py-7 text-sm font-semibold text-[#6b7a70] transition-colors hover:border-[var(--gold)] hover:text-[#16221b] ${uploading ? "pointer-events-none opacity-60" : ""}`}>
                    <svg className="h-6 w-6 text-[#9a7a3a]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                    {uploading ? "Uploading…" : "Upload a cover photo"}
                    <input type="file" accept="image/*" disabled={uploading} onChange={onCoverFile} className="hidden" />
                  </label>
                )}
              </div>
              {error && <p className="text-sm font-medium text-[#d9473f]">{error}</p>}
              <button onClick={goMap} className="w-full rounded-full bg-[#16221b] px-5 py-3.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a]">Next: map the holes →</button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#16221b]">{mappedCount}<span className="text-[#8a968d]">/{holeCount} mapped</span></span>
                <button onClick={doUndo} disabled={!undo.length} className="rounded-full border border-black/[0.08] px-3.5 py-1.5 text-xs font-bold text-[#46554c] transition-colors disabled:opacity-40 hover:border-[var(--gold)]">↶ Undo</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {holes.map((h, i) => (
                  <button key={i} onClick={() => focusHole(i)} className={`relative grid h-9 w-9 place-items-center rounded-xl text-xs font-bold transition-colors ${i === cur ? "bg-[#16221b] text-[var(--cream)] shadow-md" : "bg-[#faf9f5] text-[#46554c] hover:bg-black/[0.06]"}`}>
                    {i + 1}
                    <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${mapped(h) ? "bg-[#5fb87a]" : "bg-[#e0a23f]"}`} />
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-black/[0.07] bg-[#faf9f5] p-4">
                <div className="mb-3 flex items-center justify-between"><span className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-[#16221b]">Hole {cur + 1}</span>{curHole && mapped(curHole) && <span className="rounded-full bg-[var(--gold)]/20 px-2.5 py-1 text-xs font-bold text-[#9a7a3a]">{holeDistFt(curHole)} ft</span>}</div>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {MODES.map((m) => <button key={m.k} disabled={!m.on} onClick={() => { setMode(m.k); setPending(null); }} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold leading-tight transition-all disabled:opacity-35 ${mode === m.k ? "text-white shadow" : "border border-black/[0.08] bg-white text-[#46554c]"}`} style={mode === m.k ? { background: m.color } : undefined}>{modePreview(m.k, mode === m.k)}<span>{m.label}</span></button>)}
                </div>
                <p className="mb-3 text-xs text-[#6b7a70]">{pending ? "Set the details below, then Add." : mode === "tee" ? "Click the map to drop the TEE." : mode === "basket" ? "Click the map to drop the BASKET." : mode === "elbow" ? "Click to add a dogleg bend along the fairway." : mode === "altTee" ? "Click to place an alternate tee (max 3)." : mode === "altBasket" ? "Click to place an alternate basket (max 3)." : "Click to place a mando (max 4)."}</p>

                {pending && (
                  <div className="mb-3 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3">
                    {pending.mode === "altTee" && <input autoFocus value={pending.label} onChange={(e) => setPending({ ...pending, label: e.target.value })} maxLength={15} placeholder="Tee label (e.g. Pro, Back)" className={FIELD.replace("bg-[#faf9f5]", "bg-white")} />}
                    {pending.mode === "altBasket" && (<>
                      <input autoFocus value={pending.label} onChange={(e) => setPending({ ...pending, label: e.target.value })} maxLength={15} placeholder="Basket label (e.g. A, Long)" className={FIELD.replace("bg-[#faf9f5]", "bg-white")} />
                      <div className="mt-2 flex flex-wrap gap-1.5">{ALT_COLORS.map((c) => <button key={c.hex} onClick={() => setPending({ ...pending, colorHex: c.hex })} title={c.name} className={`h-7 w-7 rounded-full border-2 ${pending.colorHex === c.hex ? "border-[#16221b]" : "border-white"} shadow`} style={{ background: `#${c.hex}` }} />)}</div>
                    </>)}
                    {pending.mode === "mando" && <div className="flex gap-2">{(["Left", "Right", "Down"] as Dir[]).map((d) => <button key={d} onClick={() => setPending({ ...pending, direction: d })} className={`flex-1 rounded-lg border py-2 text-sm font-bold ${pending.direction === d ? "border-[var(--gold)] bg-[var(--gold)] text-[#16221b]" : "border-black/10 bg-white text-[#46554c]"}`}>{d === "Left" ? "← Left" : d === "Right" ? "Right →" : "↓ Under"}</button>)}</div>}
                    <div className="mt-2 flex gap-2"><button onClick={confirmPending} className="flex-1 rounded-full bg-[#16221b] py-2 text-xs font-bold text-[var(--cream)] hover:bg-[#22332a]">Add</button><button onClick={() => setPending(null)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-bold text-[#46554c]">Cancel</button></div>
                  </div>
                )}

                {/* placed objects on this hole — remove each individually */}
                {curHole && (curHole.teeLat != null || curHole.basketLat != null || curHole.elbows.length > 0 || curHole.altTees.length > 0 || curHole.altBaskets.length > 0 || curHole.mandos.length > 0) && (
                  <div className="mb-3 space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#8a968d]">Placed on this hole</div>
                    {curHole.teeLat != null && <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5"><span className="h-3 w-4 rounded-sm bg-[#16331f]" /><span className="flex-1 text-xs font-semibold text-[#16221b]">Tee</span><button onClick={removeTee} className="text-[#b3bbb2] hover:text-[#d9473f]">✕</button></div>}
                    {curHole.basketLat != null && <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5"><span className="h-3.5 w-3.5 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url(/basket-icon.svg)" }} /><span className="flex-1 text-xs font-semibold text-[#16221b]">Basket</span><button onClick={removeBasket} className="text-[#b3bbb2] hover:text-[#d9473f]">✕</button></div>}
                    {curHole.elbows.map((_, ei) => <div key={`e${ei}`} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5"><span className="h-2.5 w-2.5 rotate-45 rounded-sm bg-[#E0752A]" /><span className="flex-1 text-xs font-semibold text-[#16221b]">Dogleg {ei + 1}</span><button onClick={() => removeElbow(ei)} className="text-[#b3bbb2] hover:text-[#d9473f]">✕</button></div>)}
                    {curHole.altTees.map((t) => <div key={t.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5"><span className="h-3 w-4 rounded-sm bg-[#16331f]" /><input value={t.label} onChange={(e) => renameAltTee(t.id, e.target.value)} className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#16221b] outline-none" /><button onClick={() => removeAltTee(t.id)} className="text-[#b3bbb2] hover:text-[#d9473f]">✕</button></div>)}
                    {curHole.altBaskets.map((b) => <div key={b.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5"><span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white shadow" style={{ background: `#${b.colorHex}` }} /><input value={b.label} onChange={(e) => editAltBasket(b.id, { label: e.target.value })} className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#16221b] outline-none" /><div className="flex gap-0.5">{ALT_COLORS.map((c) => <button key={c.hex} onClick={() => editAltBasket(b.id, { colorHex: c.hex })} className={`h-3.5 w-3.5 rounded-full ${b.colorHex === c.hex ? "ring-2 ring-[#16221b]" : ""}`} style={{ background: `#${c.hex}` }} />)}</div><button onClick={() => removeAltBasket(b.id)} className="text-[#b3bbb2] hover:text-[#d9473f]">✕</button></div>)}
                    {curHole.mandos.map((m) => <div key={m.id} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5"><span className="grid h-4 w-4 place-items-center rounded bg-[#F1C40F] text-[9px] font-bold text-black">{m.direction === "Left" ? "←" : m.direction === "Right" ? "→" : "↓"}</span><span className="flex-1 text-xs font-semibold text-[#16221b]">{m.label}</span><div className="flex gap-1">{(["Left", "Right", "Down"] as Dir[]).map((d) => <button key={d} onClick={() => setMandoDir(m.id, d)} className={`rounded px-1.5 text-xs font-bold ${m.direction === d ? "bg-[#F1C40F] text-black" : "text-[#8a968d]"}`}>{d === "Left" ? "←" : d === "Right" ? "→" : "↓"}</button>)}</div><button onClick={() => removeMando(m.id)} className="text-[#b3bbb2] hover:text-[#d9473f]">✕</button></div>)}
                  </div>
                )}

                <div className="mb-3"><span className={LABEL}>Par</span><div className="grid grid-cols-4 gap-2">{[2, 3, 4, 5].map((p) => <button key={p} onClick={() => setPar(p)} className={pill(curHole?.par === p) + " py-2.5"}>{p}</button>)}</div></div>
                <label className="block"><span className={LABEL}>Notes</span><input value={curHole?.notes ?? ""} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — OB, tips…" className={FIELD.replace("bg-[#faf9f5]", "bg-white")} /></label>
                {curHole && (curHole.teeLat != null || curHole.basketLat != null || curHole.elbows.length > 0 || curHole.altTees.length > 0 || curHole.altBaskets.length > 0 || curHole.mandos.length > 0) && <button onClick={clearHole} className="mt-3 text-xs font-bold text-[#e0857d] hover:underline">Clear this hole</button>}
              </div>
              {error && <p className="text-sm font-medium text-[#d9473f]">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep(0)} className="rounded-full border border-black/[0.08] bg-white px-5 py-3.5 text-sm font-bold text-[#16221b] transition-colors hover:border-[var(--gold)]">← Back</button>
                <button onClick={() => { if (!allMapped) { setError("Map a tee and basket for every hole first."); return; } setError(""); setStep(2); }} className="flex-1 rounded-full bg-[#16221b] px-5 py-3.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a]">Next: review →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-black/[0.07] bg-[#faf9f5] p-5">
                <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight text-[#16221b]">{name}</h2>
                <p className="text-sm text-[#6b7a70]">{[loc?.city, loc?.state].filter(Boolean).join(", ")}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white py-3 shadow-sm"><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#16221b]">{holeCount}</div><div className="text-[10px] uppercase tracking-wide text-[#8a968d]">Holes</div></div>
                  <div className="rounded-xl bg-white py-3 shadow-sm"><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#16221b]">{totalPar}</div><div className="text-[10px] uppercase tracking-wide text-[#8a968d]">Par</div></div>
                  <div className="rounded-xl bg-white py-3 shadow-sm"><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#16221b]">{holes.reduce((s, h) => s + (mapped(h) ? holeDistFt(h) : 0), 0).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-[#8a968d]">Feet</div></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-white px-2.5 py-1 font-bold text-[#46554c] shadow-sm">{courseType}</span>
                  <span className="rounded-full bg-white px-2.5 py-1 font-bold text-[#46554c] shadow-sm">{terrain}</span>
                  {difficulty && <span className="rounded-full bg-white px-2.5 py-1 font-bold text-[#46554c] shadow-sm">{difficulty}</span>}
                  <span className="rounded-full bg-white px-2.5 py-1 font-bold text-[#46554c] shadow-sm">{isFree ? "Free" : `$${feeAmount}`}</span>
                </div>
              </div>
              {dupes && dupes.length > 0 && (
                <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3 text-sm">
                  <p className="font-bold text-[#9a7a3a]">Possible duplicate{dupes.length > 1 ? "s" : ""} nearby</p>
                  <ul className="mt-1 list-disc pl-5 text-[#46554c]">{dupes.map((d) => <li key={d.id}>{d.name}{d.city ? ` · ${d.city}` : ""}</li>)}</ul>
                  <p className="mt-1.5 text-xs text-[#6b7a70]">If yours is different, tap Create again to proceed.</p>
                </div>
              )}
              {error && <p className="text-sm font-medium text-[#d9473f]">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="rounded-full border border-black/[0.08] bg-white px-5 py-3.5 text-sm font-bold text-[#16221b] transition-colors hover:border-[var(--gold)]">← Back</button>
                <button onClick={submit} disabled={status === "saving"} className="flex-1 rounded-full bg-[#16221b] px-5 py-3.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a] disabled:opacity-60">{status === "saving" ? "Saving…" : dupes && dupes.length > 0 ? "Create anyway (draft)" : "Create course (draft)"}</button>
              </div>
            </div>
          )}
          </div>
        </div>

        <div className="lg:sticky lg:top-24">
          <div className="relative">
            <div ref={elRef} className="h-[460px] w-full overflow-hidden rounded-3xl border border-black/[0.07] bg-[#e9e4d8] shadow-[0_18px_50px_-26px_rgba(15,24,19,0.32)] lg:h-[640px]" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              {step === 0 && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/basket-pin.svg" alt="" className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]" />
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--bg-deep)]/85 px-4 py-1.5 text-xs font-semibold text-[var(--cream)] backdrop-blur">Center the map, then “Set location”</div>
                </>
              )}
              {step === 1 && <div className="absolute left-3 top-3 whitespace-nowrap rounded-xl bg-[var(--bg-deep)]/85 px-3 py-2 text-xs font-bold text-[var(--cream)] backdrop-blur">Hole {cur + 1} · {pending ? "confirm in panel" : `placing ${mode === "elbow" ? "dogleg" : mode === "altTee" ? "alt tee" : mode === "altBasket" ? "alt basket" : mode}`}</div>}
              {mapErr && <div className="absolute inset-x-3 bottom-3 rounded-xl bg-[#d9473f] px-3 py-2 text-xs font-semibold text-white shadow-lg">Map error: {mapErr}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
