"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getMentionableUsers, findUserByUsername, type MentionUser } from "@/lib/leaderboard";
import { getBagNames, getDiscCatalog, getCustomDiscs, normCat, tierFor, type FlightDisc } from "@/lib/bag";
import { buildDiscs, customToDiscData, type DiscData } from "@/lib/discs";
import DiscGraphic from "@/components/bag/DiscGraphic";
import BagCompareChart from "@/components/profile/BagCompareChart";
import UserTagPicker from "@/components/community/UserTagPicker";

const fnum = (n: number) => (n > 0 ? `+${n}` : `${n}`);
function toFlight(d: DiscData): FlightDisc {
  return { id: d.slug, name: d.name, brand: d.manufacturer, category: normCat(d.category), speed: d.speed, glide: d.glide, turn: d.turn, fade: d.fade, stability: d.stability, tier: tierFor(d.stability), color: d.color || "#9aa6b2", throwCount: 0, known: true, isFavorite: false };
}

function Tile({ d }: { d: DiscData }) {
  return (
    <Link href={`/discs/${d.slug}`} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-[var(--gold)]/40">
      <span className="shrink-0"><DiscGraphic color={d.color || "#9aa6b2"} speed={d.speed} size={32} /></span>
      <div className="min-w-0"><div className="truncate text-sm font-bold text-[var(--cream)]">{d.name}</div><div className="truncate text-[11px] text-[var(--sage-dim)]">{d.manufacturer} · {d.speed}/{d.glide}/{fnum(d.turn)}/{fnum(d.fade)}</div></div>
    </Link>
  );
}

function CompareInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [catMap, setCatMap] = useState<Map<string, DiscData> | null>(null);
  const [a, setA] = useState<MentionUser | null>(null);
  const [b, setB] = useState<MentionUser | null>(null);
  const [aBag, setABag] = useState<DiscData[] | null>(null);
  const [bBag, setBBag] = useState<DiscData[] | null>(null);
  const [picker, setPicker] = useState<"a" | "b" | null>(null);

  useEffect(() => {
    Promise.all([getMentionableUsers(), getDiscCatalog()]).then(([us, rows]) => {
      setUsers(us);
      setCatMap(new Map(buildDiscs(rows).map((d) => [d.name.toLowerCase(), d])));
    }).catch(() => { setUsers([]); setCatMap(new Map()); });
  }, []);

  // resolve ?a / ?b usernames once the catalog is ready (direct lookup, not the capped picker list)
  useEffect(() => {
    if (!catMap) return;
    const ua = sp.get("a"), ub = sp.get("b");
    if (ua && !a) findUserByUsername(ua).then((u) => { if (u) pick("a", u, false); });
    if (ub && !b) findUserByUsername(ub).then((u) => { if (u) pick("b", u, false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catMap]);

  const loadBag = async (id: string): Promise<DiscData[]> => {
    if (!catMap) return [];
    const [names, custom] = await Promise.all([getBagNames(id), getCustomDiscs(id)]);
    // Custom discs override the catalog by name (iOS allAvailableDiscs); custom-only discs resolve too.
    const customMap = new Map(custom.map((c) => [c.name.toLowerCase(), customToDiscData(c)]));
    const seen = new Set<string>(); const out: DiscData[] = [];
    for (const n of names) { const k = n.trim().toLowerCase(); const d = customMap.get(k) ?? catMap.get(k); if (d && !seen.has(d.slug)) { seen.add(d.slug); out.push(d); } }
    return out;
  };

  const pick = (slot: "a" | "b", u: MentionUser, updateUrl = true) => {
    if (slot === "a") { setA(u); setABag(null); loadBag(u.id).then(setABag); }
    else { setB(u); setBBag(null); loadBag(u.id).then(setBBag); }
    if (updateUrl) {
      const params = new URLSearchParams();
      const av = slot === "a" ? u.username : a?.username; const bv = slot === "b" ? u.username : b?.username;
      if (av) params.set("a", av); if (bv) params.set("b", bv);
      router.replace(`/compare?${params.toString()}`);
    }
  };

  const Slot = ({ slot, u, color }: { slot: "a" | "b"; u: MentionUser | null; color: string }) => (
    <button onClick={() => setPicker(slot)} className="flex flex-1 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition-colors hover:border-[var(--gold)]/40">
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full text-lg font-bold text-[var(--cream)]" style={{ background: "var(--bg-mid)", border: `3px solid ${color}` }}>
        {u?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.photo} alt="" className="h-full w-full object-cover" />
        ) : u ? (u.name || u.username).charAt(0).toUpperCase() : "+"}
      </span>
      <div className="min-w-0">
        {u ? <><div className="truncate font-bold text-[var(--cream)]">{u.name || u.username}</div><div className="truncate text-xs text-[var(--sage-dim)]">@{u.username} · tap to change</div></> : <div className="font-bold text-[var(--cream)]">Add a player</div>}
      </div>
    </button>
  );

  const ready = a && b && aBag && bBag;
  const aSlugs = useMemo(() => new Set((aBag ?? []).map((d) => d.slug)), [aBag]);
  const bSlugs = useMemo(() => new Set((bBag ?? []).map((d) => d.slug)), [bBag]);
  const both = (aBag ?? []).filter((d) => bSlugs.has(d.slug));
  const onlyA = (aBag ?? []).filter((d) => !bSlugs.has(d.slug));
  const onlyB = (bBag ?? []).filter((d) => !aSlugs.has(d.slug));
  const aFirst = (a?.name || a?.username || "Player A").split(" ")[0];
  const bFirst = (b?.name || b?.username || "Player B").split(" ")[0];

  const Group = ({ title, discs, accent }: { title: string; discs: DiscData[]; accent?: string }) => (
    discs.length ? <div><div className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: accent || "var(--sage)" }}>{title} · {discs.length}</div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{discs.map((d) => <Tile key={d.slug} d={d} />)}</div></div> : null
  );

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.14),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-7 pt-12 text-center">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">⚔️ Bag battle</div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Compare any two bags</h1>
          <p className="mt-3 text-[var(--text-body)]">Pick two players and see their flight coverage head-to-head.</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex items-center gap-3">
          <Slot slot="a" u={a} color="#F6C165" />
          <span className="shrink-0 font-[family-name:var(--font-heading)] text-lg font-extrabold text-[var(--sage-dim)]">VS</span>
          <Slot slot="b" u={b} color="#4d94fa" />
        </div>

        {!ready ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-[var(--sage-dim)]">
            {(a && !aBag) || (b && !bBag) ? "Loading bags…" : "Pick two players above to compare their bags."}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
                <div className="rounded-2xl bg-[var(--bg-deep)]/40 p-3"><BagCompareChart theirs={aBag!.map(toFlight)} yours={bBag!.map(toFlight)} theirName={aFirst} yourName={bFirst} /></div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[[`${aFirst}'s bag`, aBag!.length, "#F6C165"], [`${bFirst}'s bag`, bBag!.length, "#4d94fa"], ["Shared", both.length, undefined], ["Total unique", new Set([...aSlugs, ...bSlugs]).size, undefined]].map(([l, v, c]) => (
                    <div key={l as string} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-center"><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold" style={{ color: (c as string) || "var(--cream)" }}>{v as number}</div><div className="text-[10px] font-bold uppercase tracking-wide text-[var(--sage-dim)]">{l as string}</div></div>
                  ))}
                </div>
              </div>
            </div>
            <Group title={`Only ${aFirst} carries`} discs={onlyA} accent="#F6C165" />
            <Group title="Both carry" discs={both} />
            <Group title={`Only ${bFirst} carries`} discs={onlyB} accent="#4d94fa" />
          </div>
        )}
      </div>

      {picker && <UserTagPicker exclude={[a?.id, b?.id].filter(Boolean) as string[]} onSelect={(u) => pick(picker, u)} onClose={() => setPicker(null)} />}
    </div>
  );
}

export default function ComparePage() {
  return <Suspense fallback={<div className="min-h-screen bg-[var(--bg-deep)]" />}><CompareInner /></Suspense>;
}
