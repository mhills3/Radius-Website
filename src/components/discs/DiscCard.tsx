"use client";

import Link from "next/link";
import DiscGraphic from "@/components/bag/DiscGraphic";
import { type DiscData, stabilityTier, stabilityLabel, tierColor } from "@/lib/discs";

function Num({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/[0.04] py-1.5">
      <div className="font-[family-name:var(--font-heading)] text-sm font-extrabold text-[#16221b]">{value > 0 && label !== "S" && label !== "G" ? `+${value}` : value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wide text-[#8a968d]">{label}</div>
    </div>
  );
}

export default function DiscCard({ disc, buzz }: { disc: DiscData; buzz?: { count: number; avg: number } }) {
  const tier = stabilityTier(disc.stability);
  return (
    <Link href={`/discs/${disc.slug}`} className="group flex flex-col items-center rounded-2xl border border-black/8 bg-white p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]">
      <div className="transition-transform duration-300 group-hover:scale-105">
        <DiscGraphic color={disc.color || "#9aa6b2"} speed={disc.speed} size={84} />
      </div>
      <div className="mt-3 min-w-0">
        <div className="truncate font-bold text-[#16221b]">{disc.name}</div>
        <div className="truncate text-xs text-[#8a968d]">{disc.manufacturer}</div>
      </div>
      <div className="mt-3 grid w-full grid-cols-4 gap-1.5">
        <Num label="S" value={disc.speed} />
        <Num label="G" value={disc.glide} />
        <Num label="T" value={disc.turn} />
        <Num label="F" value={disc.fade} />
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${tierColor(tier)}1f`, color: tierColor(tier) }}>{stabilityLabel(disc.stability)}</span>
        {buzz && buzz.count > 0 && (
          <span className="rounded-full bg-black/[0.05] px-2 py-1 text-[10px] font-bold text-[#46554c]">
            {buzz.avg > 0 ? `★ ${buzz.avg.toFixed(1)} · ${buzz.count}` : `💬 ${buzz.count}`}
          </span>
        )}
      </div>
    </Link>
  );
}
