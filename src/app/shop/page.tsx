import Link from "next/link";
import ProductCard from "@/components/shop/ProductCard";
import RewardsTile from "@/components/shop/RewardsTile";
import { CATEGORY_LABEL, PRODUCTS, type ShopCategory } from "@/lib/shop";

const CHIPS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "apparel", label: "Apparel" },
  { key: "discs", label: "Discs" },
  { key: "accessories", label: "Accessories" },
];

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const active = CHIPS.some((c) => c.key === category) && category !== "all" ? (category as ShopCategory) : null;
  const shown = active ? PRODUCTS.filter((p) => p.category === active) : PRODUCTS;

  return (
    <div className="pb-24 sm:pb-0">
      {/* hero — paywall glow treatment, don't flatten it */}
      <section className="relative overflow-hidden border-b border-[var(--shop-hair)]">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 120% at 50% 118%, rgba(70,226,129,.20) 0%, rgba(34,145,75,.09) 42%, rgba(24,85,47,0) 74%)" }} />
        <div className="relative mx-auto max-w-[1200px] px-6 pb-16 pt-28 text-center sm:px-8 sm:pb-[72px] sm:pt-[120px]">
          <div className="mb-5 text-[11px] font-bold tracking-[0.22em] text-[var(--shop-gold)]">RADIUS SHOP</div>
          <h1 className="mx-auto font-[family-name:var(--font-heading)] text-[34px] font-extrabold leading-[1.04] tracking-[-0.035em] text-[var(--shop-cream)] sm:text-[60px]">
            Wear it. Throw it. <span className="text-[var(--shop-gold)]">Earn it.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[540px] text-[15px] leading-[1.55] text-[var(--shop-muted)] sm:text-[16.5px]">
            Small-run kit for players who log every throw. Stamped and packed by hand in Massachusetts.
          </p>
        </div>
      </section>

      {/* trust strip — only claims that are true today */}
      <section className="border-b border-[var(--shop-hair)] bg-[rgba(252,249,239,.022)]">
        <div className="mx-auto flex min-h-[58px] max-w-[1200px] flex-wrap items-center justify-center gap-x-3.5 gap-y-1 px-6 py-2 text-[13px] text-[var(--shop-muted)] sm:px-8">
          {["Packed by hand in Beverly, MA", "Small runs on purpose", "Builder rewards ship free, always"].map((t, i) => (
            <span key={t} className="inline-flex items-center gap-2">
              {i > 0 && <span className="mr-3.5 text-[var(--shop-dim)]" aria-hidden="true">·</span>}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--shop-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* filter row — chips are links; the grid is server-filtered on ?category= */}
      <section className="mx-auto max-w-[1200px] px-6 pt-10 sm:px-8 sm:pt-11">
        <div className="flex flex-wrap items-baseline justify-between gap-5">
          <h2 className="m-0 font-[family-name:var(--font-heading)] text-[25px] font-bold tracking-[-0.02em] text-[var(--shop-cream)]">
            {active ? CATEGORY_LABEL[active] : "Everything"}
          </h2>
          <div className="-mx-6 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {CHIPS.map((c) => {
              const on = (c.key === "all" && !active) || c.key === active;
              return (
                <Link
                  key={c.key}
                  href={c.key === "all" ? "/shop" : `/shop?category=${c.key}`}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-[13px] ${on ? "bg-[var(--shop-gold)] font-semibold text-[#1C1400]" : "border border-[var(--shop-hair-2)] font-medium text-[var(--shop-muted)] transition-colors hover:border-[rgba(252,249,239,.42)] hover:text-[var(--shop-cream)]"}`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* grid — products from the data source, rewards tile always last */}
      <section className="mx-auto max-w-[1200px] px-6 pt-6 sm:px-8">
        {shown.length === 0 && (
          <p className="rounded-2xl border border-[var(--shop-hair)] bg-[var(--shop-card)] px-6 py-10 text-center text-[14.5px] text-[var(--shop-muted)]">
            Nothing in this run right now — new drops land first in <a href="https://discord.gg/radius" className="font-semibold text-[var(--shop-gold)] hover:underline">the Discord</a>.
          </p>
        )}
        <div className="mt-2 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-[26px] lg:grid-cols-3">
          {shown.map((p) => <ProductCard key={p.slug} product={p} />)}
          <RewardsTile />
        </div>
      </section>

      {/* support band */}
      <section className="mx-auto mt-16 max-w-[1200px] px-6 sm:mt-[70px] sm:px-8">
        <div className="grid grid-cols-1 gap-8 border-t border-[var(--shop-hair)] pt-10 sm:grid-cols-3 sm:gap-10 sm:pt-[46px]">
          {[
            { title: "Shipped from Massachusetts", body: "Packed by hand in Beverly and shipped USPS, flat $5 anywhere in the US.", icon: <><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></> },
            { title: "Small runs, on purpose", body: "We make a little of each. When a run sells out, the next one looks different.", icon: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></> },
            { title: "Questions? Ask in Discord", body: "Sizing, restocks, order help. Usually answered the same day.", icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
          ].map((s) => (
            <div key={s.title}>
              <div className="mb-4 flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-[rgba(215,160,0,.34)] bg-[rgba(215,160,0,.10)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--shop-gold)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{s.icon}</svg>
              </div>
              <div className="mb-1.5 font-[family-name:var(--font-heading)] text-[16px] font-semibold text-[var(--shop-cream)]">{s.title}</div>
              <p className="m-0 text-[14px] leading-[1.55] text-[var(--shop-muted)]">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="h-16 sm:h-20" />
      </section>

      {/* phone: fixed rewards bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-5 pt-3.5 sm:hidden" style={{ background: "linear-gradient(180deg, rgba(18,26,21,0) 0%, rgba(18,26,21,.92) 32%, #121A15 100%)" }}>
        <RewardsTile variant="bar" />
      </div>
    </div>
  );
}
