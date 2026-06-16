"use client";

import { useEffect, useState } from "react";
import { type Bag, type Cat, type Tier, type FlightDisc, type RawDisc, type DbDisc, CAT_META, TIER_META, tierFor, normCat, plasticColor } from "@/lib/bag";
import { setFavorites, saveBag, newDisc, freshId, moveToCollection, markAsLost, recoverToBag, deleteStoredDisc } from "@/lib/bagWrite";
import FlightChart from "@/components/bag/FlightChart";
import DiscDetail from "@/components/bag/DiscDetail";
import DiscGraphic from "@/components/bag/DiscGraphic";
import AddDiscModal from "@/components/bag/AddDiscModal";
import StabilityMap from "@/components/bag/StabilityMap";
import { CountUp } from "@/components/dashboard/charts";

// Add disc from the web (catalog search modal -> saveBag merge). Verified cross-platform.
const SHOW_ADD_DISC = true;

type SortKey = "speed" | "stability" | "throws" | "name";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "speed", label: "Speed" },
  { key: "stability", label: "Stability" },
  { key: "throws", label: "Most thrown" },
  { key: "name", label: "A–Z" },
];
function sortDiscs(list: FlightDisc[], key: SortKey): FlightDisc[] {
  const arr = [...list];
  if (key === "speed") arr.sort((a, b) => (b.speed ?? 0) - (a.speed ?? 0) || (a.stability ?? 0) - (b.stability ?? 0));
  else if (key === "stability") arr.sort((a, b) => (a.stability ?? 99) - (b.stability ?? 99) || (b.speed ?? 0) - (a.speed ?? 0));
  else if (key === "throws") arr.sort((a, b) => b.throwCount - a.throwCount);
  else arr.sort((a, b) => (a.nickname || a.name).localeCompare(b.nickname || b.name));
  return arr;
}

const card = "rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6";
const cardTight = "rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5";
const ORDER: Cat[] = ["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER", "UNKNOWN"];
const TIERS: Tier[] = ["US", "ST", "OS"];

const gradeColor = (s: number) => (s >= 85 ? "#5fb87a" : s >= 75 ? "#F6C165" : s >= 65 ? "#e0a23f" : "#d9473f");

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const size = 184;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [off, setOff] = useState(c);
  const color = gradeColor(score);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOff(c * (1 - score / 100)));
    return () => cancelAnimationFrame(id);
  }, [c, score]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--sage-dim)]">Bag Score</span>
        <CountUp value={score} className="font-[family-name:var(--font-heading)] text-6xl font-extrabold leading-none tracking-tight text-[var(--cream)]" />
        <span className="mt-1.5 rounded-full px-3 py-0.5 text-sm font-extrabold" style={{ background: `${color}22`, color }}>Grade {grade}</span>
      </div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-body)]">{label}</span>
        <span className="font-bold text-[var(--cream)]">{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full origin-left rounded-full bg-gradient-to-r from-[#d4a04a] to-[#f8cf80] animate-[growX_0.9s_cubic-bezier(0.22,1,0.36,1)_both]" style={{ width: `${Math.max(3, value)}%` }} />
      </div>
    </div>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={filled ? "var(--gold)" : "none"} stroke={filled ? "var(--gold)" : "currentColor"} strokeWidth="2" strokeLinejoin="round">
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.8l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z" />
    </svg>
  );
}

function DiscToken({ d, onClick, onFav }: { d: FlightDisc; onClick: () => void; onFav: () => void }) {
  return (
    <div className="group relative flex flex-col items-center gap-2 text-center">
      <button onClick={onFav} aria-label="Favorite" className={`absolute right-1 top-0 z-10 grid h-6 w-6 place-items-center rounded-full bg-[var(--bg-deep)]/85 ring-1 ring-white/10 backdrop-blur transition-opacity ${d.isFavorite ? "text-[var(--gold)] opacity-100" : "text-[var(--sage-dim)] opacity-0 hover:text-[var(--cream)] group-hover:opacity-100"}`}>
        <Star filled={d.isFavorite} />
      </button>
      <button onClick={onClick} className="flex flex-col items-center gap-2">
        <div className="transition-transform duration-200 group-hover:-translate-y-1">
          <div className="drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]">
            {d.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photoUrl} alt={d.name} className="h-[88px] w-[88px] rounded-full object-cover ring-2 ring-white/15" />
            ) : (
              <DiscGraphic color={d.color} speed={d.speed} size={88} />
            )}
          </div>
        </div>
        <div className="w-[104px]">
          <div className="truncate text-sm font-semibold text-[var(--cream)]">{d.nickname || d.name}</div>
          <div className="truncate font-mono text-[11px] text-[var(--sage-dim)]">{d.known ? `${d.customSpeed ?? d.speed}/${d.customGlide ?? d.glide}/${d.customTurn ?? d.turn}/${d.customFade ?? d.fade}` : "—"}</div>
          {d.throwCount > 0 && <div className="text-[10px] text-[var(--sage-dim)]">{d.throwCount} throws</div>}
        </div>
      </button>
    </div>
  );
}

function DiscListRow({ d, onClick }: { d: FlightDisc; onClick: () => void }) {
  return (
    <button onClick={onClick} className="grid w-full grid-cols-[1.6fr_repeat(5,minmax(0,0.6fr))_0.8fr] items-center gap-2 border-t border-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/[0.03] sm:grid-cols-[2fr_repeat(5,minmax(0,0.55fr))_0.7fr]">
      <div className="flex items-center gap-2.5">
        {d.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.photoUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: d.color }} />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate font-semibold text-[var(--cream)]">{d.nickname || d.name}{d.isFavorite && <span className="text-[var(--gold)]"><Star filled /></span>}</div>
          <div className="truncate text-xs text-[var(--sage-dim)]">{d.brand || (d.known ? "" : "Unknown")}</div>
        </div>
      </div>
      <Cell v={d.customSpeed ?? d.speed} /><Cell v={d.customGlide ?? d.glide} /><Cell v={d.customTurn ?? d.turn} /><Cell v={d.customFade ?? d.fade} />
      <div className="text-center text-sm font-semibold" style={{ color: d.tier ? TIER_META[d.tier].color : "var(--sage-dim)" }}>{(() => { const s = (typeof (d.customTurn ?? d.turn) === "number" && typeof (d.customFade ?? d.fade) === "number") ? (d.customTurn ?? d.turn)! + (d.customFade ?? d.fade)! : d.stability; return s != null ? (s > 0 ? `+${s}` : s) : "—"; })()}</div>
      <div className="text-right text-sm font-semibold text-[var(--cream)]">{d.throwCount || "—"}</div>
    </button>
  );
}
function Cell({ v }: { v?: number }) {
  return <div className="text-center text-sm text-[var(--text-body)]">{v != null ? v : "—"}</div>;
}

export default function BagView({ bag, uid }: { bag: Bag; uid: string }) {
  const { rating } = bag;
  const [discs, setDiscs] = useState<FlightDisc[]>(bag.discs);
  const [rawDiscs, setRawDiscs] = useState<RawDisc[]>(bag.rawDiscs);
  const [collection, setCollection] = useState<FlightDisc[]>(bag.collection);
  const [lost, setLost] = useState<FlightDisc[]>(bag.lost);
  const [selected, setSelected] = useState<FlightDisc | null>(null);
  const [view, setView] = useState<"cards" | "list">("cards");
  const [sort, setSort] = useState<SortKey>("speed");
  const [showAdd, setShowAdd] = useState(false);

  const toggleFav = (d: FlightDisc) => {
    const updated = discs.map((x) => (x.id === d.id ? { ...x, isFavorite: !x.isFavorite } : x));
    setDiscs(updated);
    if (selected?.id === d.id) setSelected({ ...selected, isFavorite: !selected.isFavorite });
    const favIds = updated.filter((x) => x.isFavorite).map((x) => x.id);
    setFavorites(uid, favIds).catch(() => setDiscs(discs));
  };

  const saveDisc = (d: FlightDisc, patch: { nickname: string; condition: string; custom: { speed?: number; glide?: number; turn?: number; fade?: number } }) => {
    const nickname = patch.nickname || undefined;
    const c = patch.custom;
    const customPatch = { customSpeed: c.speed, customGlide: c.glide, customTurn: c.turn, customFade: c.fade };
    // Edit-as-REPLACE: the apps' bag merge is "local wins" on a same-id conflict, so an in-place
    // field edit (nickname/condition/custom flight) won't reliably reach iOS. Instead we tombstone
    // the old id and re-add the disc under a NEW id carrying the edits — the two operations the apps
    // apply UNCONDITIONALLY (tombstone removes, new cloud id appends). Throw stats are keyed by disc
    // NAME, so nothing is lost. Every other raw field is preserved.
    const newId = freshId();
    const nextDiscs = discs.map((x) => (x.id === d.id ? { ...x, id: newId, nickname, condition: patch.condition, ...customPatch } : x));
    const nextRaw = rawDiscs.map((r) => (r.id === d.id ? { ...r, id: newId, nickname, wear: { ...(r.wear || {}), condition: patch.condition, customSpeed: c.speed, customGlide: c.glide, customTurn: c.turn, customFade: c.fade } } : r));
    setDiscs(nextDiscs);
    setRawDiscs(nextRaw);
    if (selected?.id === d.id) setSelected({ ...selected, id: newId, nickname, condition: patch.condition, ...customPatch });
    // Single atomic write: new bag (with new id) + tombstone the old id.
    saveBag(uid, nextRaw, [d.id]).catch(() => { setDiscs(discs); setRawDiscs(rawDiscs); });
    // Carry a favorite over to the new id (web/Android favorite by id) so editing doesn't unfavorite it.
    if (d.isFavorite) setFavorites(uid, nextDiscs.filter((x) => x.isFavorite).map((x) => x.id)).catch(() => {});
  };

  const removeDisc = (d: FlightDisc) => {
    // Drop the disc, preserving every other raw disc object losslessly, then merge-write the bag.
    const nextDiscs = discs.filter((x) => x.id !== d.id);
    const nextRaw = rawDiscs.filter((r) => r.id !== d.id);
    setDiscs(nextDiscs);
    setRawDiscs(nextRaw);
    setSelected(null);
    // Tombstone the id so iOS/Android honor the deletion instead of re-adding it from their local bag.
    saveBag(uid, nextRaw, [d.id]).catch(() => { setDiscs(discs); setRawDiscs(rawDiscs); });
  };

  // Move a bag disc out to collection/lost. Bag/collection/lost are mutually exclusive BY NAME.
  const moveOut = (d: FlightDisc, dest: "collection" | "lost") => {
    const nameKey = d.name.toLowerCase();
    const nextDiscs = discs.filter((x) => x.id !== d.id);
    const nextRaw = rawDiscs.filter((r) => r.id !== d.id);
    const stored: FlightDisc = { ...d, id: `${dest === "collection" ? "col" : "lost"}:${d.name}`, isFavorite: false };
    setDiscs(nextDiscs);
    setRawDiscs(nextRaw);
    setCollection((cur) => dest === "collection" ? (cur.some((c) => c.name.toLowerCase() === nameKey) ? cur : [...cur, stored]) : cur.filter((c) => c.name.toLowerCase() !== nameKey));
    setLost((cur) => dest === "lost" ? (cur.some((c) => c.name.toLowerCase() === nameKey) ? cur : [...cur, stored]) : cur.filter((c) => c.name.toLowerCase() !== nameKey));
    setSelected(null);
    const revert = () => { setDiscs(discs); setRawDiscs(rawDiscs); setCollection(collection); setLost(lost); };
    (dest === "collection" ? moveToCollection(uid, nextRaw, d.name) : markAsLost(uid, nextRaw, d.name)).catch(revert);
  };

  // Recover a collection/lost disc back into the bag (fresh bag entry under a new id, by name).
  const recover = (d: FlightDisc) => {
    const nameKey = d.name.toLowerCase();
    const raw = newDisc(d.name);
    const fd: FlightDisc = { ...d, id: raw.id, isFavorite: false, condition: "Brand New", customSpeed: undefined, customGlide: undefined, customTurn: undefined, customFade: undefined };
    const nextDiscs = [...discs, fd];
    const nextRaw = [...rawDiscs, raw];
    setDiscs(nextDiscs);
    setRawDiscs(nextRaw);
    setCollection((cur) => cur.filter((c) => c.name.toLowerCase() !== nameKey));
    setLost((cur) => cur.filter((c) => c.name.toLowerCase() !== nameKey));
    recoverToBag(uid, nextRaw, d.name).catch(() => { setDiscs(discs); setRawDiscs(rawDiscs); setCollection(collection); setLost(lost); });
  };

  // Permanently delete a disc that's in collection/lost (not in the bag).
  const deleteStored = (d: FlightDisc) => {
    const nameKey = d.name.toLowerCase();
    setCollection((cur) => cur.filter((c) => c.name.toLowerCase() !== nameKey));
    setLost((cur) => cur.filter((c) => c.name.toLowerCase() !== nameKey));
    deleteStoredDisc(uid, d.name).catch(() => { setCollection(collection); setLost(lost); });
  };

  const onAdd = (dbDisc: DbDisc) => {
    const raw = newDisc(dbDisc.name);
    const stab = dbDisc.turn + dbDisc.fade;
    const fd: FlightDisc = {
      id: raw.id, name: dbDisc.name, brand: dbDisc.manufacturer, category: normCat(dbDisc.category),
      speed: dbDisc.speed, glide: dbDisc.glide, turn: dbDisc.turn, fade: dbDisc.fade,
      stability: stab, tier: tierFor(stab), color: plasticColor(dbDisc.color),
      condition: "Brand New", throwCount: 0, known: true, isFavorite: false,
    };
    const nextDiscs = [...discs, fd];
    const nextRaw = [...rawDiscs, raw];
    setDiscs(nextDiscs);
    setRawDiscs(nextRaw);
    setShowAdd(false);
    saveBag(uid, nextRaw).catch(() => { setDiscs(discs); setRawDiscs(rawDiscs); });
  };

  const known = discs.filter((d) => d.speed != null);
  const byCat = (c: Cat) => discs.filter((d) => d.category === c);
  const presentCats = ORDER.filter((c) => byCat(c).length > 0);
  const speeds = known.map((d) => d.speed!) as number[];
  const speedRange = speeds.length ? `${Math.min(...speeds)}–${Math.max(...speeds)}` : "—";
  const workhorse = [...discs].sort((a, b) => b.throwCount - a.throwCount)[0];
  const workhorseId = workhorse && workhorse.throwCount > 0 ? workhorse.id : null;

  const slotCount = (c: Cat, t: Tier) => byCat(c).filter((d) => d.tier === t).length;
  const slotCats: Cat[] = ["DISTANCE", "FAIRWAY", "MIDRANGE", "PUTTER"];
  const covered = slotCats.reduce((n, c) => n + TIERS.filter((t) => slotCount(c, t) > 0).length, 0);
  const tierCount = (t: Tier) => known.filter((d) => d.tier === t).length;
  const avgSpeed = speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : "—";
  const brands = new Set(discs.map((d) => d.brand).filter(Boolean)).size;
  const b = rating.breakdown;

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <div className="mx-auto max-w-6xl px-6 pb-20 pt-12">
        <div className="mb-5">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Your arsenal</div>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl font-extrabold tracking-[-0.03em]">My Bag</h1>
        </div>

        {/* HERO */}
        <div className={`fade-up relative mb-4 overflow-hidden ${card}`}>
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full" style={{ background: `radial-gradient(circle, ${gradeColor(rating.overall)}22, transparent 70%)` }} />
          <div className="relative grid items-center gap-8 lg:grid-cols-[auto_1fr_1fr]">
            <div className="flex justify-center">
              <ScoreRing score={rating.overall} grade={rating.grade} />
            </div>

            <div>
              <p className="font-[family-name:var(--font-heading)] text-2xl font-bold leading-snug tracking-tight text-[var(--cream)]">{rating.tagline}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {rating.identity.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-[var(--text-body)]">{tag}</span>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/[0.06] pt-5">
                <div><div className="text-xs text-[var(--sage-dim)]">Discs</div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold">{discs.length}</div></div>
                <div><div className="text-xs text-[var(--sage-dim)]">Speed range</div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold">{speedRange}</div></div>
                <div><div className="text-xs text-[var(--sage-dim)]">Slots</div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold">{covered}/12</div></div>
                {workhorseId && <div className="min-w-0"><div className="text-xs text-[var(--sage-dim)]">Workhorse</div><div className="truncate font-[family-name:var(--font-heading)] text-2xl font-extrabold">{workhorse.nickname || workhorse.name}</div></div>}
              </div>
            </div>

            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Score breakdown</div>
              <div className="space-y-3">
                <Bar label="Slot coverage" value={b.slotCoverage} />
                <Bar label="Role coverage" value={b.roleCoverage} />
                <Bar label="Depth" value={b.depth} />
                <Bar label="Speed spread" value={b.speedSpread} />
                <Bar label="Player fit" value={b.playerFit} />
              </div>
            </div>
          </div>
        </div>

        {/* category breakdown bar */}
        <div className="mb-3 flex h-3 overflow-hidden rounded-full">
          {presentCats.filter((c) => c !== "UNKNOWN").map((c) => (
            <div key={c} style={{ flex: byCat(c).length, background: CAT_META[c].color }} title={`${CAT_META[c].label}: ${byCat(c).length}`} />
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--text-body)]">
          {presentCats.filter((c) => c !== "UNKNOWN").map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CAT_META[c].color }} />
              {byCat(c).length} {CAT_META[c].short}
            </span>
          ))}
        </div>

        {/* Flight chart + Slot coverage */}
        <div className="grid gap-4 lg:grid-cols-5">
          <div className={`fade-up lg:col-span-2 ${card}`}>
            <div className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Flight chart</div>
            <p className="mb-4 text-sm text-[var(--text-body)]">Every disc&apos;s flight, mapped.</p>
            <FlightChart discs={discs} />
          </div>

          <div className="flex flex-col gap-3 lg:col-span-3">
            <div className={`fade-up ${cardTight}`} style={{ animationDelay: "60ms" }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Slot coverage</span>
                <span className="text-xs text-[var(--text-body)]"><span className="font-bold text-[var(--cream)]">{covered}/12</span> covered</span>
              </div>
              <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 text-center">
                <div />
                {TIERS.map((t) => (
                  <div key={t} className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sage-dim)]">{TIER_META[t].label}</div>
                ))}
                {slotCats.map((c) => (
                  <Row key={c} cat={c} slotCount={slotCount} />
                ))}
              </div>
            </div>

            <div className={`fade-up grid grid-cols-3 gap-2.5 ${cardTight}`} style={{ animationDelay: "120ms" }}>
              <div className="col-span-3 -mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Bag DNA</div>
              {(["US", "ST", "OS"] as Tier[]).map((t) => (
                <div key={t} className="rounded-2xl bg-white/[0.03] p-3">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-body)]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_META[t].color }} />{TIER_META[t].label}</div>
                  <div className="mt-0.5 font-[family-name:var(--font-heading)] text-2xl font-extrabold text-[var(--cream)]">{tierCount(t)}</div>
                </div>
              ))}
              <div className="col-span-3 mt-0.5 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/[0.06] pt-3 text-sm">
                <div><span className="text-[var(--sage-dim)]">Avg speed </span><span className="font-bold text-[var(--cream)]">{avgSpeed}</span></div>
                <div><span className="text-[var(--sage-dim)]">Brands </span><span className="font-bold text-[var(--cream)]">{brands}</span></div>
                <div><span className="text-[var(--sage-dim)]">Arm </span><span className="font-bold text-[var(--cream)]">≤ speed {rating.ceiling}</span></div>
              </div>
            </div>

            {/* Stability Map — fills the gap; click to open the full, shareable branded version. */}
            <StabilityMap discs={discs} className="fade-up min-h-[200px] flex-1" />
          </div>
        </div>

        {/* Gap Report */}
        <div className={`fade-up mt-4 ${card}`}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Gap Report</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-[var(--text-body)]">{rating.gaps.length} gaps</span>
          </div>
          <p className="mb-5 text-sm text-[var(--text-body)]">Where your bag could grow — and a disc that fills each slot.</p>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div>
              {rating.gaps.length === 0 ? (
                <div className="rounded-2xl border border-[#5fb87a]/30 bg-[#5fb87a]/10 p-5 text-sm text-[var(--cream)]">🎉 Complete slot coverage — every category and stability is filled.</div>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {rating.gaps.map((g) => (
                    <div key={g.label} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: `${TIER_META[g.tier].color}22`, color: TIER_META[g.tier].color }}>+</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold capitalize text-[var(--cream)]">{g.label}</div>
                        <div className="truncate text-xs text-[var(--sage-dim)]">{g.suggestion ? <>Try <span className="text-[var(--gold)]">{g.suggestion}</span></> : "No match found"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--sage-dim)]">Shot roles</div>
              <div className="space-y-2">
                {rating.roles.map((r) => (
                  <div key={r.label} className="flex items-center gap-2.5 text-sm">
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${r.covered ? "bg-[#5fb87a]/20 text-[#5fb87a]" : "bg-white/[0.05] text-[var(--sage-dim)]"}`}>{r.covered ? "✓" : "—"}</span>
                    <span className={r.covered ? "text-[var(--cream)]" : "text-[var(--sage-dim)]"}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {rating.strengths.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-white/[0.06] pt-5">
              {rating.strengths.map((s) => (
                <span key={s} className="rounded-full bg-[#5fb87a]/12 px-3 py-1 text-xs font-medium text-[#7bd69a]">✓ {s}</span>
              ))}
            </div>
          )}
        </div>

        {/* Discs — toolbar */}
        <div className="mt-12 mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-tight">In the bag <span className="text-[var(--sage-dim)]">{discs.length}</span></h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-white/[0.05] p-1">
              {SORTS.map((s) => (
                <button key={s.key} onClick={() => setSort(s.key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${sort === s.key ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}>{s.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/[0.05] p-1">
              {(["cards", "list"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} aria-label={v} className={`grid h-7 w-8 place-items-center rounded-full transition-colors ${view === v ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}>
                  {v === "cards" ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                  )}
                </button>
              ))}
            </div>
            {SHOW_ADD_DISC && (
              <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 py-2 text-xs font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add disc
              </button>
            )}
          </div>
        </div>

        {/* Discs — cards (grouped by category) */}
        {view === "cards" && (
          <div className="space-y-9">
            {presentCats.map((c) => (
              <section key={c}>
                <div className="mb-5 flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full" style={{ background: CAT_META[c].color }} />
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">{CAT_META[c].label}</h3>
                  <span className="text-sm text-[var(--sage-dim)]">{byCat(c).length}</span>
                </div>
                <div className="grid grid-cols-3 gap-y-7 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {sortDiscs(byCat(c), sort).map((d) => (
                    <DiscToken key={d.id} d={d} onClick={() => setSelected(d)} onFav={() => toggleFav(d)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Discs — list (flat, sortable, pro view) */}
        {view === "list" && (
          <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.02]">
            <div className="grid grid-cols-[1.6fr_repeat(5,minmax(0,0.6fr))_0.8fr] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)] sm:grid-cols-[2fr_repeat(5,minmax(0,0.55fr))_0.7fr]">
              <div>Disc</div><div className="text-center">Spd</div><div className="text-center">Gld</div><div className="text-center">Trn</div><div className="text-center">Fde</div><div className="text-center">Stab</div><div className="text-right">Throws</div>
            </div>
            {sortDiscs(discs, sort).map((d) => (
              <DiscListRow key={d.id} d={d} onClick={() => setSelected(d)} />
            ))}
          </div>
        )}

        {collection.length > 0 && <StoredSection title="Collection" subtitle="Discs you own but aren't carrying" icon="📦" discs={collection} primaryLabel="Move to bag" onPrimary={recover} onDelete={deleteStored} />}
        {lost.length > 0 && <StoredSection title="Lost discs" subtitle="Marked lost — recover anytime" icon="❓" discs={lost} primaryLabel="Recover" onPrimary={recover} onDelete={deleteStored} />}
      </div>

      {selected && <DiscDetail disc={selected} onClose={() => setSelected(null)} onToggleFav={() => toggleFav(selected)} onSave={(patch) => saveDisc(selected, patch)} onRemove={() => removeDisc(selected)} onMoveToCollection={() => moveOut(selected, "collection")} onMarkLost={() => moveOut(selected, "lost")} />}
      {showAdd && <AddDiscModal existing={new Set(discs.map((d) => d.name.toLowerCase()))} onAdd={onAdd} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function StoredSection({ title, subtitle, icon, discs, primaryLabel, onPrimary, onDelete }: { title: string; subtitle: string; icon: string; discs: FlightDisc[]; primaryLabel: string; onPrimary: (d: FlightDisc) => void; onDelete: (d: FlightDisc) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-10">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]">
        <span className="text-lg">{icon}</span>
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">{title} <span className="text-[var(--sage-dim)]">{discs.length}</span></h3>
        <span className="ml-1 hidden text-sm text-[var(--sage-dim)] sm:inline">· {subtitle}</span>
        <svg className={`ml-auto h-5 w-5 text-[var(--sage-dim)] transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {discs.map((d) => (
          <div key={d.id} className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <DiscGraphic color={d.color} speed={d.speed} size={56} />
            <div className="w-full">
              <div className="truncate text-sm font-semibold text-[var(--cream)]">{d.name}</div>
              <div className="truncate font-mono text-[11px] text-[var(--sage-dim)]">{d.known ? `${d.speed}/${d.glide}/${d.turn}/${d.fade}` : "—"}</div>
            </div>
            <div className="mt-1 flex w-full items-center gap-1.5">
              <button onClick={() => onPrimary(d)} className="flex-1 rounded-full bg-[var(--gold)] py-1.5 text-xs font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">{primaryLabel}</button>
              <button onClick={() => onDelete(d)} aria-label="Delete" className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 text-[var(--sage-dim)] transition-colors hover:border-[#d9473f]/40 hover:text-[#e0857d]">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      )}
    </section>
  );
}

function Row({ cat, slotCount }: { cat: Cat; slotCount: (c: Cat, t: Tier) => number }) {
  return (
    <>
      <div className="flex items-center justify-start text-[11px] font-semibold text-[var(--text-body)]">{CAT_META[cat].short}</div>
      {TIERS.map((t) => {
        const n = slotCount(cat, t);
        return (
          <div key={t} className={`flex h-10 items-center justify-center rounded-lg text-sm font-bold ${n > 0 ? "text-[#16221b]" : "border border-dashed border-white/15 text-[var(--sage-dim)]"}`} style={n > 0 ? { background: TIER_META[t].color } : undefined}>
            {n > 0 ? n : "+"}
          </div>
        );
      })}
    </>
  );
}
