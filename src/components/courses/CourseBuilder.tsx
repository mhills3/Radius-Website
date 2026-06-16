"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "mapbox-gl/dist/mapbox-gl.css";
import { createCourse, findNearbyCourses, distanceFt, slugify, type HoleDraft, type Course } from "@/lib/courses";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "pk.eyJ1IjoibWlrZXkzIiwiYSI6ImNtb3Fra25hZzB6dnIycHB6ZHMxcjIwNHYifQ.tyyS7i-aoR54_l11rW0Khg";

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const FIELD = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-[#16221b] outline-none placeholder-[#b3bbb2] focus:border-[var(--gold)]";

export default function CourseBuilder({ uid }: { uid: string }) {
  const router = useRouter();
  const elRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  const [form, setForm] = useState({ name: "", city: "", state: "", description: "", courseType: "", terrain: "", amenities: "", isFree: true, courseFeeAmount: 0, coverPhotoUrl: "" });
  const [holes, setHoles] = useState<HoleDraft[]>([]);
  const [pendingTee, setPendingTee] = useState<[number, number] | null>(null);
  const [placing, setPlacing] = useState(false); // actively placing a hole
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const [dupes, setDupes] = useState<Course[] | null>(null);

  // refs so map click handler always sees latest placement state
  const placingRef = useRef(placing); placingRef.current = placing;
  const pendingRef = useRef(pendingTee); pendingRef.current = pendingTee;

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // ---- map ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !elRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({ container: elRef.current, style: "mapbox://styles/mapbox/satellite-v9", projection: "mercator", center: [-98.5, 39.5], zoom: 3.4, attributionControl: false });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        if (cancelled) return;
        // basket pin image
        const img = new Image();
        img.onload = () => { try { const s = 2, w = 32 * s, h = 40 * s; const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const c = cv.getContext("2d"); if (c) { c.drawImage(img, 0, 0, w, h); if (!map.hasImage("basket-pin")) map.addImage("basket-pin", c.getImageData(0, 0, w, h), { pixelRatio: 2 }); } } catch {} };
        img.src = "/basket-pin.svg";

        const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
        map.addSource("lines", { type: "geojson", data: empty });
        map.addSource("tees", { type: "geojson", data: empty });
        map.addSource("baskets", { type: "geojson", data: empty });
        map.addSource("pending", { type: "geojson", data: empty });
        map.addLayer({ id: "lines-casing", type: "line", source: "lines", layout: { "line-cap": "round" }, paint: { "line-color": "#0f1813", "line-width": 5, "line-opacity": 0.6 } });
        map.addLayer({ id: "lines", type: "line", source: "lines", layout: { "line-cap": "round" }, paint: { "line-color": "#F6C165", "line-width": 2.5, "line-dasharray": [2, 1.4] } });
        map.addLayer({ id: "baskets", type: "symbol", source: "baskets", layout: { "icon-image": "basket-pin", "icon-size": 0.85, "icon-anchor": "bottom", "icon-allow-overlap": true } });
        map.addLayer({ id: "tees", type: "symbol", source: "tees", layout: { "icon-image": ["get", "icon"], "icon-size": 0.95, "icon-allow-overlap": true } });
        map.addLayer({ id: "pending", type: "circle", source: "pending", paint: { "circle-radius": 7, "circle-color": "#F6C165", "circle-stroke-width": 2, "circle-stroke-color": "#fff" } });
        setReady(true);
      });

      map.on("click", (e: { lngLat: { lng: number; lat: number } }) => {
        if (!placingRef.current) return;
        const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        if (!pendingRef.current) {
          setPendingTee(pt); // first click = tee
        } else {
          const tee = pendingRef.current;
          setHoles((hs) => [...hs, { par: 3, teeLng: tee[0], teeLat: tee[1], basketLng: pt[0], basketLat: pt[1] }]);
          setPendingTee(null);
          setPlacing(false);
        }
      });
      map.getCanvas().style.cursor = "";
    })();
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  // cursor reflects placing mode
  useEffect(() => { const m = mapRef.current; if (m?.getCanvas) m.getCanvas().style.cursor = placing ? "crosshair" : ""; }, [placing]);

  // generate tee number icons + push features whenever holes/pending change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource) return;
    for (let n = 1; n <= holes.length; n++) {
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
    map.getSource("lines").setData(fc(holes.map((hh) => ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[hh.teeLng, hh.teeLat], [hh.basketLng, hh.basketLat]] } }))));
    map.getSource("tees").setData(fc(holes.map((hh, i) => ({ type: "Feature", properties: { icon: `tee-${i + 1}` }, geometry: { type: "Point", coordinates: [hh.teeLng, hh.teeLat] } }))));
    map.getSource("baskets").setData(fc(holes.map((hh) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [hh.basketLng, hh.basketLat] } }))));
    map.getSource("pending").setData(fc(pendingTee ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: pendingTee } }] : []));
  }, [holes, pendingTee, ready]);

  async function geocode(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    try {
      const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&limit=1&types=place,locality,address,poi,region`);
      const j = await r.json();
      const f = j.features?.[0];
      if (f?.center) {
        mapRef.current?.flyTo({ center: f.center, zoom: 16 });
        const ctx: { id: string; text: string }[] = f.context || [];
        const region = ctx.find((c) => c.id.startsWith("region"))?.text;
        const place = ctx.find((c) => c.id.startsWith("place"))?.text || (f.id?.startsWith("place") ? f.text : undefined);
        setForm((prev) => ({ ...prev, city: prev.city || place || "", state: prev.state || region || "" }));
      }
    } catch {}
  }

  const removeHole = (i: number) => setHoles((hs) => hs.filter((_, idx) => idx !== i));
  const setPar = (i: number, par: number) => setHoles((hs) => hs.map((h, idx) => (idx === i ? { ...h, par } : h)));
  const totalPar = holes.reduce((s, h) => s + (h.par || 0), 0);

  async function submit() {
    setError("");
    if (!form.name.trim()) { setError("Give your course a name."); return; }
    if (holes.length === 0) { setError("Add at least one hole by dropping a tee and basket on the map."); return; }
    // duplicate check (only when we have a location)
    if (dupes === null) {
      const lat = holes.reduce((s, h) => s + h.teeLat, 0) / holes.length;
      const lng = holes.reduce((s, h) => s + h.teeLng, 0) / holes.length;
      const near = await findNearbyCourses(lat, lng, form.name);
      if (near.length > 0) { setDupes(near); return; } // show warning; submit again to proceed
      setDupes([]);
    }
    setStatus("saving");
    const id = await createCourse(uid, {
      name: form.name, city: form.city, state: form.state, description: form.description,
      courseType: form.courseType, terrain: form.terrain,
      amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
      isFree: form.isFree, courseFeeAmount: form.isFree ? 0 : Number(form.courseFeeAmount) || 0,
      coverPhotoUrl: form.coverPhotoUrl, holes,
    });
    if (!id) { setStatus("error"); setError("Couldn't save the course. Please try again."); return; }
    router.push(`/courses/${slugify(form.name, id)}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em] text-[#16221b]">Build a course</h1>
        <p className="mt-1 text-sm text-[#6b7a70]">New courses are saved as a <span className="font-semibold">draft</span> — only you can see them until they&apos;re reviewed and published.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* map + holes */}
        <div>
          <form onSubmit={geocode} className="mb-2 flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a place to find your course…" className={FIELD} />
            <button type="submit" className="shrink-0 rounded-xl border border-black/10 bg-white px-4 text-sm font-bold text-[#16221b] hover:border-[var(--gold)]">Find</button>
          </form>
          <div className="relative overflow-hidden rounded-2xl border border-black/10">
            <div ref={elRef} className="h-[460px] w-full" />
            <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-[var(--bg-deep)]/85 px-3 py-2 text-xs text-[var(--cream)] backdrop-blur">
              {placing ? (pendingTee ? "Now click the BASKET location" : "Click the TEE location") : `${holes.length} hole${holes.length === 1 ? "" : "s"} placed`}
            </div>
            <button onClick={() => { setPlacing((v) => !v); setPendingTee(null); }} className={`absolute bottom-3 left-3 rounded-full px-4 py-2 text-sm font-bold shadow-lg transition-colors ${placing ? "bg-[#d9473f] text-white" : "bg-[var(--gold)] text-[#16221b] hover:bg-[var(--gold-bright)]"}`}>
              {placing ? "Cancel" : "+ Add hole"}
            </button>
          </div>

          {holes.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-black/8 bg-white">
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-black/[0.06] px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#8a968d]">
                <div>Hole</div><div>Par</div><div className="text-right">Distance</div><div></div>
              </div>
              {holes.map((h, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-black/[0.04] px-4 py-2 text-sm last:border-0">
                  <div className="w-6 font-bold text-[#16221b]">{i + 1}</div>
                  <div><input type="number" value={h.par} min={1} max={8} onChange={(e) => setPar(i, Number(e.target.value))} className="w-16 rounded-lg border border-black/10 bg-[#faf8f3] px-2 py-1 text-sm outline-none focus:border-[var(--gold)]" /></div>
                  <div className="text-right font-mono text-[#46554c]">{distanceFt(h.teeLat, h.teeLng, h.basketLat, h.basketLng)} ft</div>
                  <button onClick={() => removeHole(i)} aria-label="Remove hole" className="justify-self-end rounded-full p-1.5 text-[#b3bbb2] hover:bg-black/5 hover:text-[#d9473f]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
                </div>
              ))}
              <div className="flex justify-between px-4 py-2.5 text-sm font-bold text-[#16221b]"><span>{holes.length} holes</span><span>Par {totalPar}</span></div>
            </div>
          )}
        </div>

        {/* details */}
        <div className="space-y-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Course name *</span><input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Maple Hill" className={FIELD} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">City</span><input value={form.city} onChange={(e) => set("city", e.target.value)} className={FIELD} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">State / region</span><input value={form.state} onChange={(e) => set("state", e.target.value)} className={FIELD} /></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Description</span><textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} className={`${FIELD} resize-none`} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Type</span><input value={form.courseType} onChange={(e) => set("courseType", e.target.value)} placeholder="Wooded, Park…" className={FIELD} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Terrain</span><input value={form.terrain} onChange={(e) => set("terrain", e.target.value)} placeholder="Hilly, Flat…" className={FIELD} /></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Amenities (comma separated)</span><input value={form.amenities} onChange={(e) => set("amenities", e.target.value)} placeholder="Restrooms, Parking" className={FIELD} /></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Cover photo URL</span><input value={form.coverPhotoUrl} onChange={(e) => set("coverPhotoUrl", e.target.value)} className={FIELD} /></label>
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm font-semibold text-[#16221b]"><input type="checkbox" checked={form.isFree} onChange={(e) => set("isFree", e.target.checked)} /> Free to play</label>
            {!form.isFree && <input type="number" value={form.courseFeeAmount} onChange={(e) => set("courseFeeAmount", Number(e.target.value))} placeholder="Fee $" className="w-24 rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--gold)]" />}
          </div>

          {dupes && dupes.length > 0 && (
            <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3 text-sm">
              <p className="font-bold text-[#9a7a3a]">Possible duplicate{dupes.length > 1 ? "s" : ""} nearby</p>
              <ul className="mt-1 list-disc pl-5 text-[#46554c]">{dupes.map((d) => <li key={d.id}>{d.name}{d.city ? ` · ${d.city}` : ""}</li>)}</ul>
              <p className="mt-1.5 text-xs text-[#6b7a70]">If yours is different, tap Create again to proceed.</p>
            </div>
          )}
          {error && <p className="text-sm font-medium text-[#d9473f]">{error}</p>}

          <button onClick={submit} disabled={status === "saving"} className="w-full rounded-full bg-[#16221b] px-5 py-3 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a] disabled:opacity-60">
            {status === "saving" ? "Saving…" : dupes && dupes.length > 0 ? "Create anyway (draft)" : "Create course (draft)"}
          </button>
          <p className="text-center text-[11px] text-[#a3aca4]">Saved as a private draft for review before it goes live.</p>
        </div>
      </div>
    </div>
  );
}
