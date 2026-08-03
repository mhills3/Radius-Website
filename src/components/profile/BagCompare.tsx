"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getBagNames, getDiscCatalog, getCustomDiscs, normCat, tierFor, type FlightDisc } from "@/lib/bag";
import { buildDiscs, customToDiscData, type DiscData } from "@/lib/discs";
import DiscGraphic from "@/components/bag/DiscGraphic";
import BagCompareChart from "@/components/profile/BagCompareChart";

const fnum = (n: number) => (n > 0 ? `+${n}` : `${n}`);
function toFlight(d: DiscData): FlightDisc {
  return { id: d.slug, name: d.name, brand: d.manufacturer, category: normCat(d.category), speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade, stability: d.stability, tier: tierFor(d.stability), color: d.color || "#9aa6b2", throwCount: 0, known: true, isFavorite: false };
}

function Tile({ d }: { d: DiscData }) {
  return (
    <Link href={`/discs/${d.slug}`} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-[var(--gold)]/40">
      <span className="shrink-0"><DiscGraphic color={d.color || "#9aa6b2"} speed={d.speed} size={34} /></span>
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-[var(--cream)]">{d.name}</div>
        <div className="truncate text-[11px] text-[var(--sage-dim)]">{d.manufacturer} · {d.speed}/{d.glide}/{fnum(d.turn)}/{fnum(d.fade)}</div>
      </div>
    </Link>
  );
}

export default function BagCompare({ canonicalId, theirBag, theirName, username }: { canonicalId: string; theirBag: DiscData[]; theirName: string; username?: string }) {
  const { user, profile } = useAuth();
  const [mine, setMine] = useState<DiscData[] | null>(null);
  const [busy, setBusy] = useState(false);

  if (!theirBag.length || (profile && profile.canonicalId === canonicalId)) return null;

  const load = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [names, rows, custom] = await Promise.all([getBagNames(user.uid), getDiscCatalog(), getCustomDiscs(user.uid)]);
      const byName = new Map(buildDiscs(rows).map((d) => [d.name.toLowerCase(), d]));
      // Custom discs override the catalog by name (iOS allAvailableDiscs); custom-only discs resolve too.
      const customMap = new Map(custom.map((c) => [c.name.toLowerCase(), customToDiscData(c)]));
      const seen = new Set<string>(); const out: DiscData[] = [];
      for (const n of names) { const k = n.trim().toLowerCase(); const d = customMap.get(k) ?? byName.get(k); if (d && !seen.has(d.slug)) { seen.add(d.slug); out.push(d); } }
      setMine(out);
    } finally { setBusy(false); }
  };

  const card = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";
  const first = (theirName || "they").split(" ")[0];

  if (mine === null) {
    return (
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Compare bags</div>
            <p className="mt-0.5 text-sm text-[var(--text-body)]">Overlay {first}&apos;s flight paths against yours and spot the gaps to fill.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {user ? (
              <button onClick={load} disabled={busy} className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:opacity-60">{busy ? "Loading…" : "Compare with my bag"}</button>
            ) : (
              <Link href="/login" className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b]">Sign in to compare</Link>
            )}
            {username && <Link href={`/compare?a=${username}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:border-white/40">⚔️ Another player</Link>}
          </div>
        </div>
      </div>
    );
  }

  const mySlugs = new Set(mine.map((d) => d.slug));
  const theirSlugs = new Set(theirBag.map((d) => d.slug));
  const both = theirBag.filter((d) => mySlugs.has(d.slug));
  const onlyThem = theirBag.filter((d) => !mySlugs.has(d.slug));
  const onlyYou = mine.filter((d) => !theirSlugs.has(d.slug));

  const Stat = ({ label, value, color }: { label: string; value: number; color?: string }) => (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center">
      <div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold" style={color ? { color } : { color: "var(--cream)" }}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{label}</div>
    </div>
  );
  const Group = ({ title, discs, accent }: { title: string; discs: DiscData[]; accent?: boolean }) => (
    discs.length ? (
      <div>
        <div className={`mb-2 text-xs font-bold uppercase tracking-wide ${accent ? "text-[var(--gold)]" : "text-[var(--sage)]"}`}>{title} · {discs.length}</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{discs.map((d) => <Tile key={d.slug} d={d} />)}</div>
      </div>
    ) : null
  );

  return (
    <div className={`${card} space-y-5 p-5`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Bag comparison · {theirName} vs you</div>
        <button onClick={() => setMine(null)} className="text-xs font-semibold text-[var(--sage-dim)] hover:text-[var(--sage)]">Reset</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        <div className="rounded-2xl bg-[var(--bg-deep)]/40 p-3"><BagCompareChart theirs={theirBag.map(toFlight)} yours={mine.map(toFlight)} theirName={first} /></div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={`${first}'s bag`} value={theirBag.length} color="#F6C165" />
            <Stat label="Your bag" value={mine.length} color="#4d94fa" />
            <Stat label="Shared" value={both.length} />
            <Stat label="Their gaps" value={onlyThem.length} color="#F6C165" />
          </div>
          <Group title={`Only ${first} carries — discs to try`} discs={onlyThem} accent />
        </div>
      </div>

      <Group title="You both carry" discs={both} />
      <Group title="Only in your bag" discs={onlyYou} />
    </div>
  );
}
