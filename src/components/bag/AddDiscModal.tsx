"use client";

import { useEffect, useMemo, useState } from "react";
import { getDiscCatalog, plasticColor, normCat, CAT_META, type DbDisc } from "@/lib/bag";
import { type CustomDiscInput } from "@/lib/bagWrite";

// iOS DiscCategory rawValues — the canonical cross-platform category strings for custom discs.
const CATEGORIES = ["Putter", "Midrange", "Fairway Driver", "Distance Driver"];
const num = (s: string, fallback: number) => { const n = parseFloat(s); return Number.isNaN(n) ? fallback : n; };

// Module-scoped so it isn't remounted each render (which would drop input focus per keystroke).
function NumField({ label, value, set, step = "1" }: { label: string; value: string; set: (v: string) => void; step?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--sage-dim)]">{label}</span>
      <input value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" step={step} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-center text-sm text-[var(--cream)] outline-none focus:border-[var(--gold)]" />
    </label>
  );
}

export default function AddDiscModal({ existing, onAdd, onAddCustom, onClose }: { existing: Set<string>; onAdd: (d: DbDisc) => void; onAddCustom: (d: CustomDiscInput, dest: "bag" | "collection") => void; onClose: () => void }) {
  const [catalog, setCatalog] = useState<DbDisc[]>([]);
  const [tab, setTab] = useState<"search" | "custom">("search");
  const [q, setQ] = useState("");

  // custom-disc form (defaults match the apps)
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState("Midrange");
  const [speed, setSpeed] = useState("5");
  const [glide, setGlide] = useState("4");
  const [turn, setTurn] = useState("-1");
  const [fade, setFade] = useState("1");
  const [dest, setDest] = useState<"bag" | "collection">("bag");

  useEffect(() => {
    getDiscCatalog().then(setCatalog).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog.slice(0, 0);
    return catalog.filter((d) => d.name.toLowerCase().includes(s) || d.manufacturer?.toLowerCase().includes(s)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 40);
  }, [q, catalog]);

  const catalogNames = useMemo(() => new Set(catalog.map((d) => d.name.toLowerCase())), [catalog]);
  const trimmed = name.trim();
  const collidesCatalog = trimmed !== "" && catalogNames.has(trimmed.toLowerCase());
  const inBagAlready = trimmed !== "" && existing.has(trimmed.toLowerCase());
  const canCreate = trimmed !== "" && !collidesCatalog && !inBagAlready;

  const create = () => {
    if (!canCreate) return;
    onAddCustom({ name: trimmed, manufacturer: manufacturer.trim() || "Custom", category, speed: num(speed, 5), glide: num(glide, 4), turn: num(turn, -1), fade: num(fade, 1) }, dest);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[8vh]">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-mid)] animate-[fadeIn_0.25s_ease]">
        {/* tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-4 pt-3">
          <div className="flex gap-1">
            {(["search", "custom"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-t-lg px-3 py-2 text-sm font-bold transition-colors ${tab === t ? "text-[var(--cream)]" : "text-[var(--sage-dim)] hover:text-[var(--sage)]"}`}>
                {t === "search" ? "Search catalog" : "Custom disc"}
                {tab === t && <span className="mt-1.5 block h-0.5 rounded-full bg-[var(--gold)]" />}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--sage)] hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {tab === "search" ? (
          <>
            <div className="flex items-center gap-3 border-b border-white/[0.07] p-4">
              <svg className="h-5 w-5 shrink-0 text-[var(--sage-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search discs by name or brand…" className="w-full bg-transparent text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {q.trim() === "" && <p className="px-4 py-10 text-center text-sm text-[var(--sage-dim)]">Start typing to find a disc — or <button onClick={() => setTab("custom")} className="font-semibold text-[var(--gold)] hover:underline">create a custom one</button>.</p>}
              {q.trim() !== "" && results.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-[var(--sage-dim)]">No discs match “{q}”. <button onClick={() => { setName(q.trim()); setTab("custom"); }} className="font-semibold text-[var(--gold)] hover:underline">Create “{q.trim()}” as a custom disc</button>.</p>
              )}
              {results.map((d) => {
                const inBag = existing.has(d.name.toLowerCase());
                const cat = CAT_META[normCat(d.category)];
                return (
                  <div key={`${d.manufacturer}-${d.name}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]">
                    <span className="h-7 w-7 shrink-0 rounded-full" style={{ background: plasticColor(d.color) }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-[var(--cream)]">{d.name}</div>
                      <div className="truncate text-xs text-[var(--sage-dim)]">{d.manufacturer} · <span style={{ color: cat.color }}>{cat.short}</span> · <span className="font-mono">{d.speed}/{d.glide}/{d.turn}/{d.fade}</span></div>
                    </div>
                    <button disabled={inBag} onClick={() => onAdd(d)} className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${inBag ? "cursor-default bg-white/[0.05] text-[var(--sage-dim)]" : "bg-[var(--gold)] text-[#16221b] hover:bg-[var(--gold-bright)]"}`}>{inBag ? "In bag" : "Add"}</button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <p className="mb-4 text-sm text-[var(--text-body)]">Build a disc that isn&apos;t in the catalog. It syncs to your iOS and Android apps too.</p>
            <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Name</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. My custom mid" className="mb-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
            {collidesCatalog && <p className="mb-2 text-xs font-medium text-[#e0857d]">A catalog disc is already named “{trimmed}” — search for it on the Search tab instead.</p>}
            {!collidesCatalog && inBagAlready && <p className="mb-2 text-xs font-medium text-[#e0857d]">“{trimmed}” is already in your bag.</p>}

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Manufacturer</label>
                <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} maxLength={30} placeholder="Custom" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:border-[var(--gold)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--sage)]">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[var(--bg-mid)] px-3 py-2 text-sm text-[var(--cream)] outline-none focus:border-[var(--gold)]">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <label className="mb-1 mt-4 block text-xs font-semibold text-[var(--sage)]">Flight numbers</label>
            <div className="grid grid-cols-4 gap-2">
              <NumField label="Speed" value={speed} set={setSpeed} />
              <NumField label="Glide" value={glide} set={setGlide} />
              <NumField label="Turn" value={turn} set={setTurn} step="0.5" />
              <NumField label="Fade" value={fade} set={setFade} step="0.5" />
            </div>

            <label className="mb-1 mt-4 block text-xs font-semibold text-[var(--sage)]">Add to</label>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
              {(["bag", "collection"] as const).map((d) => (
                <button key={d} onClick={() => setDest(d)} className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${dest === d ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{d === "bag" ? "My bag" : "Collection"}</button>
              ))}
            </div>

            <button onClick={create} disabled={!canCreate} className="mt-5 w-full rounded-full bg-[var(--gold)] py-3 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">
              Create disc
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
