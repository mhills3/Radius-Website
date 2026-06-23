"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { updateCourse, updateCourseHoles, type Course, type HoleEdit } from "@/lib/courses";
import { useMetricPref } from "@/lib/useMetricPref";
import { fmtDist, distValue, FT_TO_M } from "@/lib/units";

export default function CourseEditForm({ course, onSaved, onClose }: { course: Course; onSaved: (patch: Partial<Course>) => void; onClose: () => void }) {
  const { user } = useAuth();
  const metric = useMetricPref();
  const [tab, setTab] = useState<"details" | "holes">("details");
  const [f, setF] = useState({
    name: course.name, city: course.city, state: course.state, description: course.description,
    courseType: course.courseType, terrain: course.terrain, manualDifficulty: course.manualDifficulty ?? "",
    coverPhotoUrl: course.coverPhotoUrl ?? "", isFree: course.isFree, isPublic: course.isPublic,
    courseFeeAmount: course.courseFeeAmount ?? 0,
    amenities: (course.amenities ?? []).join(", "), gallery: (course.galleryPhotoUrls ?? []).join(", "),
  });
  const [holes, setHoles] = useState<HoleEdit[]>(course.holes.map((h) => ({ holeNumber: h.holeNumber, par: h.par, distance: h.distance })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof typeof f, v: string | number | boolean) => setF((p) => ({ ...p, [k]: v }));
  const setHole = (i: number, k: "par" | "distance", v: number) => setHoles((p) => p.map((h, idx) => (idx === i ? { ...h, [k]: v } : h)));
  const field = "w-full rounded-xl border border-black/10 bg-[#faf8f3] px-3.5 py-2.5 text-sm text-[#16221b] outline-none focus:border-[var(--gold)]";
  const totalPar = holes.reduce((s, h) => s + (Number(h.par) || 0), 0);
  const totalDist = holes.reduce((s, h) => s + (Number(h.distance) || 0), 0);

  const save = async () => {
    if (!user || busy) return;
    setBusy(true); setErr("");
    const top = {
      name: f.name, city: f.city, state: f.state, description: f.description, courseType: f.courseType,
      terrain: f.terrain, manualDifficulty: f.manualDifficulty, coverPhotoUrl: f.coverPhotoUrl,
      isFree: f.isFree, isPublic: f.isPublic, courseFeeAmount: Number(f.courseFeeAmount) || 0,
      amenities: f.amenities.split(",").map((s) => s.trim()).filter(Boolean),
      galleryPhotoUrls: f.gallery.split(",").map((s) => s.trim()).filter(Boolean),
    };
    const ok1 = await updateCourse(user.uid, course.id, top);
    const holesChanged = JSON.stringify(holes) !== JSON.stringify(course.holes.map((h) => ({ holeNumber: h.holeNumber, par: h.par, distance: h.distance })));
    const ok2 = holesChanged && holes.length ? await updateCourseHoles(user.uid, course.id, holes) : true;
    setBusy(false);
    if (ok1 && ok2) {
      onSaved({ ...top, ...(holesChanged && holes.length ? { holeCount: holes.length, par: totalPar, distanceFt: totalDist, holes: course.holes.map((h, i) => ({ ...h, par: holes[i]?.par ?? h.par, distance: holes[i]?.distance ?? h.distance })) } : {}) });
      onClose();
    } else setErr("Couldn't save — only the course owner can edit this.");
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[7vh] backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/8 px-5 py-3">
          <span className="font-[family-name:var(--font-heading)] font-bold text-[#16221b]">Edit {course.name}</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#6b7a70] hover:bg-black/5" aria-label="Close"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>

        <div className="flex gap-1 border-b border-black/8 px-4 pt-2">
          {(["details", "holes"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-t-lg px-4 py-2 text-sm font-bold capitalize transition-colors ${tab === t ? "border-b-2 border-[var(--gold)] text-[#16221b]" : "text-[#8a968d] hover:text-[#46554c]"}`}>{t === "holes" ? `Holes (${holes.length})` : "Details"}</button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "details" ? (
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Course name</span><input value={f.name} onChange={(e) => set("name", e.target.value)} className={field} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">City</span><input value={f.city} onChange={(e) => set("city", e.target.value)} className={field} /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">State / region</span><input value={f.state} onChange={(e) => set("state", e.target.value)} className={field} /></label>
              </div>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Description</span><textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} className={`${field} resize-none`} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Type</span><input value={f.courseType} onChange={(e) => set("courseType", e.target.value)} placeholder="Wooded, Park…" className={field} /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Terrain</span><input value={f.terrain} onChange={(e) => set("terrain", e.target.value)} placeholder="Hilly, Flat…" className={field} /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Difficulty</span><input value={f.manualDifficulty} onChange={(e) => set("manualDifficulty", e.target.value)} placeholder="Intermediate" className={field} /></label>
                <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Fee ($, 0 = free)</span><input type="number" value={f.courseFeeAmount} onChange={(e) => set("courseFeeAmount", Number(e.target.value))} className={field} /></label>
              </div>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Amenities (comma separated)</span><input value={f.amenities} onChange={(e) => set("amenities", e.target.value)} placeholder="Restrooms, Parking, Pro shop" className={field} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Cover photo URL</span><input value={f.coverPhotoUrl} onChange={(e) => set("coverPhotoUrl", e.target.value)} className={field} /></label>
              <label className="block"><span className="mb-1 block text-xs font-semibold text-[#46554c]">Gallery photo URLs (comma separated)</span><input value={f.gallery} onChange={(e) => set("gallery", e.target.value)} className={field} /></label>
              <div className="flex gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm font-semibold text-[#16221b]"><input type="checkbox" checked={f.isFree} onChange={(e) => set("isFree", e.target.checked)} /> Free to play</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#16221b]"><input type="checkbox" checked={f.isPublic} onChange={(e) => set("isPublic", e.target.checked)} /> Public</label>
              </div>
            </div>
          ) : holes.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#8a968d]">No holes mapped for this layout yet. Add holes in the Radius app.</p>
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#8a968d]"><span>Par & distance per hole — tee/basket map data is preserved.</span><span className="text-[#16221b]">Par {totalPar} · {fmtDist(totalDist, metric)}</span></div>
              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2">
                <div className="text-[10px] font-bold uppercase text-[#8a968d]">Hole</div>
                <div className="text-[10px] font-bold uppercase text-[#8a968d]">Par</div>
                <div className="text-[10px] font-bold uppercase text-[#8a968d]">Distance ({metric ? "m" : "ft"})</div>
                {holes.map((h, i) => (
                  <div key={i} className="contents">
                    <div className="text-sm font-bold text-[#16221b]">{h.holeNumber || i + 1}</div>
                    <input type="number" value={h.par} onChange={(e) => setHole(i, "par", Number(e.target.value))} className="rounded-lg border border-black/10 bg-[#faf8f3] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--gold)]" />
                    <input type="number" value={metric ? distValue(h.distance, true) : h.distance} onChange={(e) => setHole(i, "distance", metric ? Math.round(Number(e.target.value) / FT_TO_M) : Number(e.target.value))} className="rounded-lg border border-black/10 bg-[#faf8f3] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--gold)]" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {err && <p className="mt-3 text-sm font-semibold text-[#dc2626]">{err}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-black/8 p-4">
          <button onClick={onClose} className="rounded-full px-5 py-2.5 text-sm font-semibold text-[#46554c] hover:text-[#16221b]">Cancel</button>
          <button onClick={save} disabled={busy || !f.name.trim()} className="rounded-full bg-[#16221b] px-6 py-2.5 text-sm font-bold text-[var(--cream)] hover:bg-[#22332a] disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}
