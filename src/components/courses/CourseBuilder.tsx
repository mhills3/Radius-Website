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
// Mirror the app (radiusDifficultyColor): green / blue / orange, Pro = amber→gold gradient + glow.
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

type Hole = { par: number; teeLat?: number; teeLng?: number; basketLat?: number; basketLng?: number; notes: string };
const blankHole = (): Hole => ({ par: 3, notes: "" });
const mapped = (h: Hole) => h.teeLat != null && h.basketLat != null;

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
  const [mode, setMode] = useState<"tee" | "basket">("tee");
  const [undo, setUndo] = useState<Hole[][]>([]);

  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const [dupes, setDupes] = useState<Course[] | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError("");
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const r = storageRef(storage, `courseCovers/${uid}/${Date.now()}-${safe}`);
      await uploadBytes(r, file);
      setCoverPhotoUrl(await getDownloadURL(r));
    } catch {
      setError("Photo upload failed — try a smaller image.");
    }
    setUploading(false);
  }

  const stepRef = useRef(step); stepRef.current = step;
  const modeRef = useRef(mode); modeRef.current = mode;
  const curRef = useRef(cur); curRef.current = cur;

  const holeCount = Math.max(0, Math.min(27, parseInt(holeCountText, 10) || 0));

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | undefined;
    (async () => {
     try {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!elRef.current) { setMapErr("Map container didn't mount."); return; }
      mapboxgl.accessToken = TOKEN;
      // satellite-streets shows roads + town/state boundaries & labels over the imagery (helps
      // place pins accurately) vs plain satellite.
      const map = new mapboxgl.Map({ container: elRef.current, style: "mapbox://styles/mapbox/satellite-streets-v12", projection: "mercator", center: [-98.5, 39.5], zoom: 3.4, attributionControl: false });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showUserLocation: true }), "top-right");
      // Keep the canvas sized to its container (fixes a map rendered into a 0-size box).
      ro = new ResizeObserver(() => { try { map.resize(); } catch {} });
      ro.observe(elRef.current);
      // Surface the real Mapbox failure (token 403, WebGL, etc.) instead of a silent blank map.
      map.on("error", (e: { error?: { message?: string; status?: number } }) => {
        const m = e?.error?.message || (e?.error?.status ? `HTTP ${e.error.status}` : "");
        if (m) setMapErr(m);
      });
      map.on("load", () => {
        if (cancelled) return;
        map.resize();
        // Default to the user's current location, zoomed in (they can pan/zoom from there).
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => { if (!cancelled) map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16, duration: 1200 }); },
            () => {},
            { enableHighAccuracy: true, timeout: 8000 },
          );
        }
        const img = new Image();
        img.onload = () => { try { const s = 2, w = 32 * s, h = 40 * s; const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d"); if (c) { c.drawImage(img, 0, 0, w, h); if (!map.hasImage("basket-pin")) map.addImage("basket-pin", c.getImageData(0, 0, w, h), { pixelRatio: 2 }); } } catch {} };
        img.src = "/basket-pin.svg";
        const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        for (const id of ["lines", "tees", "baskets"]) map.addSource(id, { type: "geojson", data: empty });
        map.addLayer({ id: "lines-casing", type: "line", source: "lines", layout: { "line-cap": "round" }, paint: { "line-color": "#0f1813", "line-width": 5, "line-opacity": ["case", ["get", "cur"], 0.6, 0.25] } });
        map.addLayer({ id: "lines", type: "line", source: "lines", layout: { "line-cap": "round" }, paint: { "line-color": "#F6C165", "line-width": 2.5, "line-dasharray": [2, 1.4], "line-opacity": ["case", ["get", "cur"], 1, 0.4] } });
        map.addLayer({ id: "baskets", type: "symbol", source: "baskets", layout: { "icon-image": "basket-pin", "icon-size": ["case", ["get", "cur"], 0.9, 0.6], "icon-anchor": "bottom", "icon-allow-overlap": true }, paint: { "icon-opacity": ["case", ["get", "cur"], 1, 0.45] } });
        map.addLayer({ id: "tees", type: "symbol", source: "tees", layout: { "icon-image": ["get", "icon"], "icon-size": ["case", ["get", "cur"], 0.95, 0.65], "icon-allow-overlap": true }, paint: { "icon-opacity": ["case", ["get", "cur"], 1, 0.5] } });
        setMapReady(true);
      });
      map.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
        if (stepRef.current !== 1) return;
        const i = curRef.current;
        const pt = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        setHoles((hs) => {
          setUndo((u) => [...u.slice(-29), hs.map((h) => ({ ...h }))]);
          const next = hs.map((h) => ({ ...h }));
          if (!next[i]) return hs;
          if (modeRef.current === "tee") { next[i].teeLat = pt.lat; next[i].teeLng = pt.lng; }
          else { next[i].basketLat = pt.lat; next[i].basketLng = pt.lng; }
          return next;
        });
        if (modeRef.current === "tee") setMode("basket");
      });
     } catch (err) {
      setMapErr(err instanceof Error ? err.message : String(err));
     }
    })();
    return () => { cancelled = true; ro?.disconnect(); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  useEffect(() => { const m = mapRef.current; if (m?.getCanvas) m.getCanvas().style.cursor = step === 1 ? "crosshair" : ""; }, [step]);
  useEffect(() => { setTimeout(() => mapRef.current?.resize(), 60); }, [step]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getSource) return;
    for (let n = 1; n <= Math.max(holes.length, 1); n++) {
      const id = `tee-${n}`;
      if (map.hasImage(id)) continue;
      const s = 2, w = 30 * s, h = 30 * s, pad = 3 * s, r = 7 * s;
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d"); if (!c) continue;
      roundRectPath(c, pad, pad, w - 2 * pad, h - 2 * pad, r); c.fillStyle = "#F6C165"; c.fill();
      c.lineWidth = 2 * s; c.strokeStyle = "#fff"; c.stroke();
      c.fillStyle = "#16221b"; c.font = `bold ${13 * s}px sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(String(n), w / 2, h / 2 + s * 0.5);
      map.addImage(id, c.getImageData(0, 0, w, h), { pixelRatio: 2 });
    }
    const fc = (features: unknown[]) => ({ type: "FeatureCollection", features } as unknown as GeoJSON.FeatureCollection);
    const lines: unknown[] = [], tees: unknown[] = [], baskets: unknown[] = [];
    holes.forEach((h, i) => {
      const isCur = i === cur;
      if (h.teeLat != null && h.basketLat != null) lines.push({ type: "Feature", properties: { cur: isCur }, geometry: { type: "LineString", coordinates: [[h.teeLng, h.teeLat], [h.basketLng, h.basketLat]] } });
      if (h.teeLat != null) tees.push({ type: "Feature", properties: { icon: `tee-${i + 1}`, cur: isCur }, geometry: { type: "Point", coordinates: [h.teeLng, h.teeLat] } });
      if (h.basketLat != null) baskets.push({ type: "Feature", properties: { cur: isCur }, geometry: { type: "Point", coordinates: [h.basketLng, h.basketLat] } });
    });
    map.getSource("lines").setData(fc(lines));
    map.getSource("tees").setData(fc(tees));
    map.getSource("baskets").setData(fc(baskets));
  }, [holes, cur, mapReady]);

  async function geocode(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim(); if (!q) return;
    try {
      const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&limit=1&types=place,locality,address,poi,region`);
      const f = (await r.json()).features?.[0];
      if (f?.center) mapRef.current?.flyTo({ center: f.center, zoom: 15 });
    } catch {}
  }

  async function setLocationToCenter() {
    const map = mapRef.current; if (!map) return;
    const c = map.getCenter();
    let city = "", state = "";
    try {
      const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${c.lng},${c.lat}.json?access_token=${TOKEN}&types=place,region&limit=1`);
      const feats = (await r.json()).features || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const f of feats as any[]) {
        if (f.id?.startsWith("place")) city = city || f.text;
        const region = (f.context || []).find((x: { id: string }) => x.id.startsWith("region"));
        if (region) state = state || region.text;
        if (f.id?.startsWith("region")) state = state || f.text;
      }
    } catch {}
    setLoc({ lat: c.lat, lng: c.lng, city, state });
  }

  const goMap = () => {
    if (!name.trim()) return setError("Add a course name.");
    if (holeCount < 1) return setError("Enter how many holes (1–27).");
    if (!description.trim()) return setError("Add a short description.");
    if (!loc) return setError("Set the course location (search, center the map, then Set location).");
    setError("");
    setHoles((hs) => { const n = [...hs]; while (n.length < holeCount) n.push(blankHole()); n.length = holeCount; return n; });
    setCur(0); setMode("tee"); setStep(1);
    if (loc) mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 16 });
  };
  const allMapped = holes.length === holeCount && holes.every(mapped);

  const focusHole = (i: number) => {
    setCur(i); setMode(holes[i] && holes[i].teeLat == null ? "tee" : holes[i].basketLat == null ? "basket" : "tee");
    const h = holes[i];
    if (h?.teeLat != null) mapRef.current?.flyTo({ center: [h.teeLng, h.teeLat], zoom: 17 });
  };
  const doUndo = () => setUndo((u) => { if (!u.length) return u; const prev = u[u.length - 1]; setHoles(prev.map((h) => ({ ...h }))); return u.slice(0, -1); });
  const clearHole = () => { setUndo((u) => [...u.slice(-29), holes.map((h) => ({ ...h }))]); setHoles((hs) => hs.map((h, i) => (i === cur ? { ...h, teeLat: undefined, teeLng: undefined, basketLat: undefined, basketLng: undefined } : h))); setMode("tee"); };
  const setPar = (p: number) => setHoles((hs) => hs.map((h, i) => (i === cur ? { ...h, par: p } : h)));
  const setNotes = (v: string) => setHoles((hs) => hs.map((h, i) => (i === cur ? { ...h, notes: v } : h)));

  async function submit() {
    setError("");
    const built: HoleDraft[] = holes.filter(mapped).map((h) => ({ par: h.par, teeLat: h.teeLat!, teeLng: h.teeLng!, basketLat: h.basketLat!, basketLng: h.basketLng!, notes: h.notes }));
    if (built.length === 0) { setError("Map at least one hole."); return; }
    if (dupes === null && loc) {
      const near = await findNearbyCourses(loc.lat, loc.lng, name);
      if (near.length > 0) { setDupes(near); return; }
      setDupes([]);
    }
    setStatus("saving");
    const id = await createCourse(uid, {
      name, city: loc?.city, state: loc?.state, latitude: loc?.lat, longitude: loc?.lng, description,
      courseType, terrain, manualDifficulty: difficulty, amenities: [...amenities],
      isFree, courseFeeAmount: isFree ? 0 : Number(feeAmount) || 0, coverPhotoUrl, holes: built,
    });
    if (!id) { setStatus("error"); setError("Couldn't save the course. Please try again."); return; }
    router.push(`/courses/${slugify(name, id)}`);
  }

  const curHole = holes[cur];
  const mappedCount = holes.filter(mapped).length;
  const totalPar = holes.reduce((s, h) => s + (h.par || 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/courses/mine" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#6b7a70] transition-colors hover:text-[#16221b]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Back to my courses
      </Link>
      {/* header + stepper */}
      <div className="mb-7">
        <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9a7a3a]">Course builder</div>
        <h1 className="mt-1.5 font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] text-[#16221b]">Build a course</h1>
        <p className="mt-2 max-w-xl text-sm text-[#6b7a70]">Map your local course hole by hole. It&apos;s saved as a private <span className="font-semibold text-[#46554c]">draft</span> — only you can see it until it&apos;s reviewed and published.</p>
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

      <div className="grid gap-6 lg:grid-cols-[440px_1fr]">
        {/* LEFT — step controls in a premium card */}
        <div className="min-w-0">
          <div className="rounded-3xl border border-black/[0.07] bg-white p-6 shadow-[0_18px_50px_-26px_rgba(15,24,19,0.32)]">
          {step === 0 && (
            <div className="space-y-4">
              <label className="block"><span className={LABEL}>Course name *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maple Hill" className={FIELD} /></label>
              <div>
                <span className={LABEL}>Location *</span>
                <form onSubmit={geocode} className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a town to fly the map…" className={FIELD} /><button type="submit" className="shrink-0 rounded-xl border border-black/[0.08] bg-white px-4 text-sm font-bold text-[#16221b] transition-colors hover:border-[var(--gold)]">Find</button></form>
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
                <div className="mb-3 flex items-center justify-between"><span className="font-[family-name:var(--font-heading)] text-lg font-extrabold text-[#16221b]">Hole {cur + 1}</span>{curHole && mapped(curHole) && <span className="rounded-full bg-[var(--gold)]/20 px-2.5 py-1 text-xs font-bold text-[#9a7a3a]">{distanceFt(curHole.teeLat!, curHole.teeLng!, curHole.basketLat!, curHole.basketLng!)} ft</span>}</div>
                <div className="mb-3 flex gap-2">
                  <button onClick={() => setMode("tee")} className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-all ${mode === "tee" ? "bg-[#16221b] text-[var(--cream)]" : "border border-black/[0.08] bg-white text-[#46554c]"}`}>{curHole?.teeLat != null ? "✓ " : ""}Tee</button>
                  <button onClick={() => setMode("basket")} className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-all ${mode === "basket" ? "bg-[var(--gold)] text-[#16221b]" : "border border-black/[0.08] bg-white text-[#46554c]"}`}>{curHole?.basketLat != null ? "✓ " : ""}Basket</button>
                </div>
                <p className="mb-3 text-xs text-[#6b7a70]">{mode === "tee" ? "Click the map to drop the TEE." : "Click the map to drop the BASKET."}</p>
                <div className="mb-3"><span className={LABEL}>Par</span><div className="flex gap-2">{[2, 3, 4, 5].map((p) => <button key={p} onClick={() => setPar(p)} className={pill(curHole?.par === p) + " py-2"}>{p}</button>)}</div></div>
                <label className="block"><span className={LABEL}>Notes</span><input value={curHole?.notes ?? ""} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — OB, mando, tips…" className={FIELD.replace("bg-[#faf9f5]", "bg-white")} /></label>
                {curHole && (curHole.teeLat != null || curHole.basketLat != null) && <button onClick={clearHole} className="mt-3 text-xs font-bold text-[#e0857d] hover:underline">Clear this hole&apos;s pins</button>}
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
                  <div className="rounded-xl bg-white py-3 shadow-sm"><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[#16221b]">{(holes.reduce((s, h) => s + (mapped(h) ? distanceFt(h.teeLat!, h.teeLng!, h.basketLat!, h.basketLng!) : 0), 0)).toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-[#8a968d]">Feet</div></div>
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

        {/* RIGHT — map. Direct, explicit-height container (mirrors the working CourseMap/CourseHoleMap;
            an absolute-inset-0 container makes Mapbox build a 0-size canvas → blank map). */}
        <div className="relative lg:sticky lg:top-24">
          <div ref={elRef} className="h-[460px] w-full overflow-hidden rounded-3xl border border-black/[0.07] bg-[#e9e4d8] shadow-[0_18px_50px_-26px_rgba(15,24,19,0.32)] lg:h-[calc(100vh-8rem)]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
            {step === 0 && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/basket-pin.svg" alt="" className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.45)]" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--bg-deep)]/85 px-3.5 py-1.5 text-xs font-semibold text-[var(--cream)] backdrop-blur">Center the map on your course, then “Set location”</div>
              </>
            )}
            {step === 1 && <div className="absolute left-3 top-3 rounded-xl bg-[var(--bg-deep)]/85 px-3 py-2 text-xs font-bold text-[var(--cream)] backdrop-blur">Hole {cur + 1} · placing {mode}</div>}
            {mapErr && <div className="absolute inset-x-3 bottom-3 rounded-xl bg-[#d9473f] px-3 py-2 text-xs font-semibold text-white shadow-lg">Map error: {mapErr}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
