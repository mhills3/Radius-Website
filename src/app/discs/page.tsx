"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDiscCatalog, normCat } from "@/lib/bag";
import { buildDiscs, stabilityTier, stabilityLabel, tierColor, discSlug, catLabel, type DiscData } from "@/lib/discs";
import { getTrendingDiscs, type TrendingDisc } from "@/lib/feed";
import { getDiscReviewCounts, type DiscBuzz } from "@/lib/discReviews";
import DiscCard from "@/components/discs/DiscCard";
import DiscCompare from "@/components/discs/DiscCompare";
import DiscGraphic from "@/components/bag/DiscGraphic";

const CATS = [{ key: "ALL", label: "All" }, { key: "PUTTER", label: "Putters" }, { key: "MIDRANGE", label: "Midranges" }, { key: "FAIRWAY", label: "Fairway" }, { key: "DISTANCE", label: "Distance" }];
const STABS = [{ key: "ALL", label: "Any" }, { key: "US", label: "Understable" }, { key: "ST", label: "Stable" }, { key: "OS", label: "Overstable" }];
const fnum = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Row({ title, subtitle, items, buzz }: { title: string; subtitle?: string; items: DiscData[]; buzz?: Map<string, DiscBuzz> }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-9">
      <div className="mb-4"><h2 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">{title}</h2>{subtitle && <p className="text-sm text-[#8a968d]">{subtitle}</p>}</div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{items.slice(0, 4).map((d) => <DiscCard key={d.slug} disc={d} buzz={buzz?.get(d.slug)} />)}</div>
    </section>
  );
}
function Num({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center justify-between"><span className="text-[#6b7a70]">{label}</span><span className="font-bold text-[#16221b]">{value}</span></div>;
}

export default function DiscsPage() {
  const [discs, setDiscs] = useState<DiscData[]>([]);
  const [trending, setTrending] = useState<TrendingDisc[]>([]);
  const [buzz, setBuzz] = useState<Map<string, DiscBuzz>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mfr, setMfr] = useState("");
  const [cat, setCat] = useState("ALL");
  const [stab, setStab] = useState("ALL");
  const [limit, setLimit] = useState(48);

  useEffect(() => {
    getDiscCatalog().then((rows) => setDiscs(buildDiscs(rows))).catch(() => setDiscs([])).finally(() => setLoading(false));
    getTrendingDiscs(12).then(setTrending).catch(() => {});
    getDiscReviewCounts().then(setBuzz).catch(() => {});
  }, []);

  const manufacturers = useMemo(() => [...new Set(discs.map((d) => d.manufacturer).filter(Boolean))].sort(), [discs]);
  const anyFilter = !!(search || mfr || cat !== "ALL" || stab !== "ALL");
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return discs.filter((d) => {
      if (s && !`${d.name} ${d.manufacturer}`.toLowerCase().includes(s)) return false;
      if (mfr && d.manufacturer !== mfr) return false;
      if (cat !== "ALL" && normCat(d.category) !== cat) return false;
      if (stab !== "ALL" && stabilityTier(d.stability) !== stab) return false;
      return true;
    });
  }, [discs, search, mfr, cat, stab]);

  const trendingDiscs = useMemo(() => { const m = new Map(discs.map((d) => [d.name.toLowerCase(), d])); return trending.map((t) => m.get(t.name.toLowerCase())).filter((d): d is DiscData => !!d); }, [trending, discs]);
  const beginner = useMemo(() => discs.filter((d) => d.speed <= 9 && d.stability <= 0 && d.glide >= 4).sort((a, b) => b.glide - a.glide || a.speed - b.speed), [discs]);
  const overstable = useMemo(() => [...discs].sort((a, b) => b.stability - a.stability), [discs]);
  const understable = useMemo(() => [...discs].sort((a, b) => a.stability - b.stability), [discs]);
  const discOfDay = useMemo(() => (discs.length ? discs[Math.floor(Date.now() / 86400000) % discs.length] : null), [discs]);

  const topBrands = useMemo(() => { const m = new Map<string, number>(); discs.forEach((d) => m.set(d.manufacturer, (m.get(d.manufacturer) ?? 0) + 1)); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8); }, [discs]);
  const maxBrand = topBrands[0]?.[1] || 1;
  const avgSpeed = useMemo(() => (discs.length ? (discs.reduce((s, d) => s + d.speed, 0) / discs.length).toFixed(1) : "—"), [discs]);
  const catCounts = useMemo(() => { const m: Record<string, number> = {}; discs.forEach((d) => { const c = normCat(d.category); m[c] = (m[c] ?? 0) + 1; }); return m; }, [discs]);
  const discByName = useMemo(() => new Map(discs.map((d) => [d.name.toLowerCase(), d] as const)), [discs]);
  const maxThrows = trending[0]?.throws || 1;

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <div className="relative overflow-hidden border-b border-black/[0.06]">
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#16221b", opacity: 0.04 }} />
        <div className="relative mx-auto max-w-7xl px-6 pb-7 pt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">Flight numbers & specs</div>
              <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Disc Database</h1>
            </div>
            <div className="flex gap-7">
              <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none">{discs.length || "—"}</div><div className="mt-1 text-xs text-[#8a968d]">discs</div></div>
              <div><div className="font-[family-name:var(--font-heading)] text-2xl font-extrabold leading-none">{manufacturers.length || "—"}</div><div className="mt-1 text-xs text-[#8a968d]">brands</div></div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <div className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-sm focus-within:border-[var(--gold)] sm:max-w-xs">
              <svg className="h-4 w-4 shrink-0 text-[#8a968d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search discs, brands…" className="w-full bg-transparent text-sm text-[#16221b] placeholder-[#8a968d] outline-none" />
            </div>
            <select value={mfr} onChange={(e) => setMfr(e.target.value)} className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#16221b] shadow-sm outline-none focus:border-[var(--gold)]"><option value="">All brands</option>{manufacturers.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            <div className="inline-flex rounded-full border border-black/10 bg-white p-1 shadow-sm">{CATS.map((c) => <button key={c.key} onClick={() => setCat(c.key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${cat === c.key ? "bg-[#16221b] text-white" : "text-[#46554c] hover:text-[#16221b]"}`}>{c.label}</button>)}</div>
            <div className="inline-flex rounded-full border border-black/10 bg-white p-1 shadow-sm">{STABS.map((s) => <button key={s.key} onClick={() => setStab(s.key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${stab === s.key ? "bg-[var(--gold)] text-[#16221b]" : "text-[#46554c] hover:text-[#16221b]"}`}>{s.label}</button>)}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {!loading && !anyFilter && discOfDay && (
          <Link href={`/discs/${discSlug(discOfDay)}`} className="group relative mb-9 block overflow-hidden rounded-3xl border border-black/8 shadow-sm" style={{ background: `linear-gradient(135deg, ${discOfDay.color || "#9aa6b2"}, #16221b 72%)` }}>
            <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.08 }} />
            <div className="relative flex flex-col items-center gap-5 p-6 text-[var(--cream)] sm:flex-row sm:gap-7 md:p-8">
              <div className="shrink-0 drop-shadow-2xl transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3"><DiscGraphic color={discOfDay.color || "#9aa6b2"} speed={discOfDay.speed} size={104} /></div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="text-[11px] font-bold uppercase tracking-widest text-white/80">☀️ Disc of the day · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
                <div className="mt-1 text-sm font-bold uppercase tracking-wide text-white/70">{discOfDay.manufacturer}</div>
                <div className="font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-none tracking-[-0.02em] md:text-4xl">{discOfDay.name}</div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  {[["S", discOfDay.speed], ["G", discOfDay.glide], ["T", fnum(discOfDay.turn)], ["F", fnum(discOfDay.fade)]].map(([k, v]) => (
                    <span key={k} className="inline-flex items-baseline gap-1 rounded-lg bg-black/25 px-2.5 py-1 backdrop-blur-sm"><span className="font-[family-name:var(--font-heading)] text-sm font-extrabold text-white">{v}</span><span className="text-[10px] font-bold text-white/55">{k}</span></span>
                  ))}
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tierColor(stabilityTier(discOfDay.stability)), color: "#16221b" }}>{stabilityLabel(discOfDay.stability)}</span>
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">{catLabel(discOfDay.category)}</span>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#16221b] shadow-lg transition-transform group-hover:-translate-y-0.5">Explore →</span>
            </div>
          </Link>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-8 lg:items-start">
          <div className="min-w-0">
            {!loading && !anyFilter && (
              <>
                {trendingDiscs.length > 0 && <Row title="🔥 Trending now" subtitle="Most-thrown by the Radius community" items={trendingDiscs} buzz={buzz} />}
                <Row title="🎯 Best for beginners" subtitle="Understable & high-glide — easy to throw far" items={beginner} buzz={buzz} />
                <Row title="💪 Most overstable" subtitle="Reliable fade in wind & for forehands" items={overstable} buzz={buzz} />
                <Row title="🪃 Most understable" subtitle="Turn-friendly — great for rollers & touch shots" items={understable} buzz={buzz} />
                <div className="mb-9"><DiscCompare catalog={discs} /></div>
              </>
            )}

            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">{anyFilter ? `${filtered.length.toLocaleString()} result${filtered.length === 1 ? "" : "s"}` : "All discs"}</h2>
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-black/5" />)}</div>
            ) : filtered.length === 0 ? (
              <p className="rounded-2xl border border-black/8 bg-white p-12 text-center text-sm text-[#6b7a70]">No discs match your filters.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{filtered.slice(0, limit).map((d) => <DiscCard key={d.slug} disc={d} buzz={buzz.get(d.slug)} />)}</div>
                {limit < filtered.length && <div className="mt-8 text-center"><button onClick={() => setLimit((l) => l + 48)} className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-bold text-[#16221b] shadow-sm hover:border-[var(--gold)]">Show more ({(filtered.length - limit).toLocaleString()} more)</button></div>}
              </>
            )}
          </div>

          <aside className="mt-10 lg:mt-0">
            <div className="space-y-4 lg:sticky lg:top-24">
              {trending.length > 0 && (
                <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">Most thrown on Radius</div>
                  <div className="mb-3 text-[11px] text-[#8a968d]">By throws logged across the community</div>
                  <div className="space-y-2.5">
                    {trending.slice(0, 8).map((t, i) => {
                      const d = discByName.get(t.name.toLowerCase());
                      const inner = (
                        <>
                          <span className="w-3 shrink-0 text-[11px] font-bold text-[#9a7a3a]">{i + 1}</span>
                          <span className="w-[66px] shrink-0 truncate text-left font-semibold text-[#16221b] group-hover:text-[#9a7a3a]">{t.name}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-[#d4a04a] to-[#f8cf80]" style={{ width: `${Math.max(8, (t.throws / maxThrows) * 100)}%` }} /></div>
                          <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-[#6b7a70]">{t.throws.toLocaleString()}</span>
                        </>
                      );
                      return d ? (
                        <Link key={t.name} href={`/discs/${discSlug(d)}`} className="group flex items-center gap-2 text-sm">{inner}</Link>
                      ) : (
                        <div key={t.name} className="flex items-center gap-2 text-sm">{inner}</div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">📚 Disc guides</div>
                <div className="flex flex-col gap-1.5 text-sm">
                  {[["beginners", "Best for beginners"], ["overstable", "Most overstable"], ["understable", "Most understable"], ["putters", "All putters"], ["midranges", "All midranges"], ["distance-drivers", "Distance drivers"]].map(([slug, label]) => (
                    <Link key={slug} href={`/discs/best/${slug}`} className="font-semibold text-[#46554c] hover:text-[#9a7a3a]">{label} →</Link>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">🏭 Top brands</div>
                <div className="space-y-2.5">
                  {topBrands.map(([b, n]) => (
                    <button key={b} onClick={() => setMfr(b)} className="flex w-full items-center gap-2.5 text-sm group">
                      <span className="w-16 shrink-0 truncate text-left font-semibold text-[#16221b] group-hover:text-[#9a7a3a]">{b}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.max(8, (n / maxBrand) * 100)}%` }} /></div>
                      <span className="w-8 shrink-0 text-right text-xs font-semibold text-[#6b7a70]">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-black/8 bg-white p-4 shadow-sm">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#9a7a3a]">📊 By the numbers</div>
                <div className="space-y-2.5 text-sm">
                  <Num label="Total discs" value={discs.length.toLocaleString()} />
                  <Num label="Brands" value={manufacturers.length} />
                  <Num label="Putters" value={catCounts.PUTTER ?? 0} />
                  <Num label="Midranges" value={catCounts.MIDRANGE ?? 0} />
                  <Num label="Fairway drivers" value={catCounts.FAIRWAY ?? 0} />
                  <Num label="Distance drivers" value={catCounts.DISTANCE ?? 0} />
                  <Num label="Avg speed" value={avgSpeed} />
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--bg-mid)] p-5 text-[var(--cream)]">
                <div className="font-[family-name:var(--font-heading)] text-lg font-bold">Build your bag</div>
                <p className="mt-1 text-sm text-[var(--text-body)]">Scan your discs, get a bag rating, and see what to throw — in the Radius app.</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
