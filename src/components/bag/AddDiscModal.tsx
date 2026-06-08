"use client";

import { useEffect, useMemo, useState } from "react";
import { getDiscCatalog, plasticColor, normCat, CAT_META, type DbDisc } from "@/lib/bag";

export default function AddDiscModal({ existing, onAdd, onClose }: { existing: Set<string>; onAdd: (d: DbDisc) => void; onClose: () => void }) {
  const [catalog, setCatalog] = useState<DbDisc[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    getDiscCatalog().then(setCatalog).catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog.slice(0, 0);
    return catalog
      .filter((d) => d.name.toLowerCase().includes(s) || d.manufacturer?.toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [q, catalog]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[8vh]">
      <div className="absolute inset-0 bg-black/65 animate-[fadeIn_0.2s_ease]" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[var(--bg-mid)] animate-[fadeIn_0.25s_ease]">
        <div className="flex items-center gap-3 border-b border-white/[0.07] p-5">
          <svg className="h-5 w-5 shrink-0 text-[var(--sage-dim)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 1,200+ discs by name or brand…"
            className="w-full bg-transparent text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none"
          />
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--sage)] hover:bg-white/10 hover:text-[var(--cream)]" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {q.trim() === "" && <p className="px-4 py-10 text-center text-sm text-[var(--sage-dim)]">Start typing to find a disc to add to your bag.</p>}
          {q.trim() !== "" && results.length === 0 && <p className="px-4 py-10 text-center text-sm text-[var(--sage-dim)]">No discs match “{q}”.</p>}
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
                <button
                  disabled={inBag}
                  onClick={() => onAdd(d)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${inBag ? "cursor-default bg-white/[0.05] text-[var(--sage-dim)]" : "bg-[var(--gold)] text-[#16221b] hover:bg-[var(--gold-bright)]"}`}
                >
                  {inBag ? "In bag" : "Add"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
