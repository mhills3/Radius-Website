"use client";

import { useEffect, useMemo, useState } from "react";
import { getDiscCatalog } from "@/lib/bag";
import { buildDiscs, type DiscData } from "@/lib/discs";
import DiscGraphic from "@/components/bag/DiscGraphic";
import type { DiscTag } from "@/lib/feed";

export default function DiscTagPicker({ onSelect, onClose }: { onSelect: (d: DiscTag) => void; onClose: () => void }) {
  const [discs, setDiscs] = useState<DiscData[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => { getDiscCatalog().then((rows) => setDiscs(buildDiscs(rows))).catch(() => setDiscs([])); }, []);

  const results = useMemo(() => {
    if (!discs) return [];
    const s = q.trim().toLowerCase();
    const list = s ? discs.filter((d) => `${d.name} ${d.manufacturer}`.toLowerCase().includes(s)) : discs;
    return list.slice(0, 40);
  }, [discs, q]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[var(--bg-mid)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-white/10 p-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search discs to tag…" className="w-full rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none focus:bg-white/[0.1]" />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {discs === null ? (
            <div className="p-6 text-center text-sm text-[var(--sage-dim)]">Loading discs…</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-sm text-[var(--sage-dim)]">No discs match.</div>
          ) : (
            results.map((d) => (
              <button key={d.slug} onClick={() => { onSelect({ name: d.name, brand: d.manufacturer, slug: d.slug }); onClose(); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]">
                <span className="grid h-9 w-9 shrink-0 place-items-center drop-shadow"><DiscGraphic color={d.color || "#9aa6b2"} speed={d.speed} size={34} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--cream)]">{d.name}</span>
                  <span className="block truncate text-xs text-[var(--sage-dim)]">{d.manufacturer} · {d.speed}/{d.glide}/{d.turn}/{d.fade}</span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-white/10 p-2 text-right">
          <button onClick={onClose} className="rounded-full px-4 py-1.5 text-sm font-semibold text-[var(--sage)] hover:text-[var(--cream)]">Cancel</button>
        </div>
      </div>
    </div>
  );
}
