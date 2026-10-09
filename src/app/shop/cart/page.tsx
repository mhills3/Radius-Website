"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FLAT_SHIPPING, PRODUCTS, productForSku, readCart, stockForSku, updateCartLine, type CartLine } from "@/lib/shop";

const TILE_BG = "radial-gradient(76% 76% at 50% 34%, #1E2C23 0%, #141D18 100%)";

function Thumb({ sku, name, size = 104 }: { sku: string; name: string; size?: number }) {
  const product = productForSku(sku);
  const img = product?.images[0];
  return (
    <Link
      href={product ? `/shop/${product.slug}` : "/shop"}
      aria-label={name}
      className="group inline-flex flex-none items-center justify-center overflow-hidden rounded-2xl border border-[var(--shop-hair)] transition-colors hover:border-[rgba(215,160,0,.42)]"
      style={{ width: size, height: size, background: TILE_BG }}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.src} alt="" className="h-full w-full object-cover transition-transform duration-[350ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]" />
      ) : (
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 200 200" fill="none" stroke="var(--shop-gold-soft)" strokeOpacity=".55" strokeWidth="3.4" aria-hidden="true">
          <ellipse cx="100" cy="104" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="26" ry="22" />
        </svg>
      )}
    </Link>
  );
}

/** The cart. Line-item cards on the product tiles, a sticky glowing summary,
 *  and a cross-sell row — checkout itself goes live with Square. */
export default function CartPage() {
  const [lines, setLines] = useState<CartLine[] | null>(null);

  useEffect(() => {
    const sync = () => setLines(readCart());
    sync();
    window.addEventListener("radius-cart", sync);
    return () => window.removeEventListener("radius-cart", sync);
  }, []);

  const count = (lines || []).reduce((n, l) => n + l.qty, 0);
  const subtotal = (lines || []).reduce((n, l) => n + l.price * l.qty, 0);
  const empty = lines !== null && lines.length === 0;
  const inCart = new Set((lines || []).map((l) => l.slug));
  const crossSell = PRODUCTS.filter((p) => !inCart.has(p.slug)).slice(0, 3);

  return (
    <div className="pb-32 sm:pb-24">
      {/* header band — same glow language as the shop hero */}
      <div className="relative overflow-hidden border-b border-[var(--shop-hair)]">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 150% at 50% 130%, rgba(70,226,129,.14) 0%, rgba(34,145,75,.06) 46%, rgba(24,85,47,0) 76%)" }} />
        <div className="relative mx-auto max-w-[1040px] px-6 pb-9 pt-24 sm:px-8 sm:pt-28">
          <div className="text-[13px] text-[var(--shop-dim)]">
            <Link href="/shop" className="text-[var(--shop-muted)] transition-colors hover:text-[var(--shop-cream)]">Shop</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <span>Cart</span>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="m-0 font-[family-name:var(--font-heading)] text-[36px] font-extrabold tracking-[-0.03em] text-[var(--shop-cream)] sm:text-[44px]">Your cart</h1>
            {count > 0 && <span className="text-[15px] font-medium text-[var(--shop-muted)]">{count} item{count === 1 ? "" : "s"}</span>}
          </div>
        </div>
      </div>

      {lines === null ? null : empty ? (
        /* empty state — a reason to go back, not a dead end */
        <div className="mx-auto max-w-[1040px] px-6 sm:px-8">
          <div className="mx-auto mt-14 max-w-[480px] text-center">
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border border-[var(--shop-hair)]" style={{ background: TILE_BG }}>
              <svg width="88" height="88" viewBox="0 0 200 200" fill="none" stroke="var(--shop-gold-soft)" strokeOpacity=".6" strokeWidth="3" aria-hidden="true">
                <ellipse cx="100" cy="104" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="26" ry="22" />
              </svg>
            </div>
            <h2 className="mt-7 font-[family-name:var(--font-heading)] text-[24px] font-bold tracking-[-0.02em] text-[var(--shop-cream)]">Empty cart, full backswing.</h2>
            <p className="mx-auto mt-2.5 max-w-[360px] text-[14.5px] leading-relaxed text-[var(--shop-muted)]">The runs are small and they don&apos;t come back. Grab yours while it&apos;s here.</p>
            <Link href="/shop" className="mt-7 inline-flex h-[52px] items-center rounded-2xl bg-[var(--shop-gold)] px-7 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[#1C1400] shadow-[0_10px_32px_rgba(215,160,0,.22)] transition-colors hover:bg-[var(--shop-gold-soft)]">
              Browse the shop
            </Link>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[1040px] px-6 sm:px-8">
          <div className="mt-9 flex flex-wrap items-start gap-8 lg:flex-nowrap lg:gap-12">
            {/* line items */}
            <div className="min-w-0 flex-[1_1_480px]">
              <div className="flex flex-col gap-4">
                {lines.map((l) => {
                  const max = Math.max(1, stockForSku(l.sku));
                  const atMax = l.qty >= max;
                  return (
                    <div key={l.sku} className="flex items-center gap-5 rounded-3xl border border-[var(--shop-hair)] bg-[var(--shop-card)] p-4 transition-colors hover:border-[var(--shop-hair-2)] sm:p-5">
                      <Thumb sku={l.sku} name={l.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="truncate font-[family-name:var(--font-heading)] text-[17px] font-semibold tracking-[-0.01em] text-[var(--shop-cream)]">{l.name}</div>
                            <div className="mt-0.5 text-[13px] text-[var(--shop-muted)]">{l.variantLabel ? `${l.variantLabel} · ` : ""}${l.price} each</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-[family-name:var(--font-heading)] text-[18px] font-bold text-[var(--shop-gold)]" style={{ fontVariantNumeric: "tabular-nums" }}>${l.price * l.qty}</div>
                          </div>
                        </div>
                        <div className="mt-3.5 flex items-center justify-between gap-3">
                          <div className="flex h-11 items-center overflow-hidden rounded-full border border-[var(--shop-hair-2)] bg-[rgba(252,249,239,.03)]">
                            <button onClick={() => updateCartLine(l.sku, l.qty - 1)} aria-label={`Fewer ${l.name}`} className="h-11 w-11 text-[17px] text-[var(--shop-muted)] transition-colors hover:text-[var(--shop-gold)]">−</button>
                            <span className="min-w-7 text-center font-[family-name:var(--font-heading)] text-[14.5px] font-semibold text-[var(--shop-cream)]" style={{ fontVariantNumeric: "tabular-nums" }}>{l.qty}</span>
                            <button onClick={() => updateCartLine(l.sku, Math.min(max, l.qty + 1))} disabled={atMax} title={atMax ? "That's all of them" : undefined} aria-label={`More ${l.name}`} className="h-11 w-11 text-[17px] text-[var(--shop-muted)] transition-colors hover:text-[var(--shop-gold)] disabled:cursor-not-allowed disabled:opacity-35">+</button>
                          </div>
                          <div className="flex items-center gap-3">
                            {atMax && <span className="hidden text-[11.5px] font-semibold tracking-[0.08em] text-[var(--shop-gold)] sm:inline">ALL {max} IN CART</span>}
                            <button onClick={() => updateCartLine(l.sku, 0)} aria-label={`Remove ${l.name}`} className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-[var(--shop-dim)] transition-colors hover:text-[#ef9a9a]">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* cross-sell — the rest of the catalog, one tap from the cart */}
              {crossSell.length > 0 && (
                <div className="mt-10">
                  <h2 className="m-0 font-[family-name:var(--font-heading)] text-[18px] font-bold tracking-[-0.02em] text-[var(--shop-cream)]">Forgetting something?</h2>
                  <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {crossSell.map((p) => (
                      <Link key={p.slug} href={`/shop/${p.slug}`} className="flex items-center gap-4 rounded-2xl border border-[var(--shop-hair)] bg-[var(--shop-card)] p-3.5 transition-colors hover:border-[rgba(215,160,0,.42)]">
                        <span className="inline-flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl" style={{ background: TILE_BG }}>
                          {p.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.images[0].src} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <svg width="36" height="36" viewBox="0 0 200 200" fill="none" stroke="var(--shop-gold-soft)" strokeOpacity=".5" strokeWidth="4" aria-hidden="true"><ellipse cx="100" cy="104" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="26" ry="22" /></svg>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-[family-name:var(--font-heading)] text-[14.5px] font-semibold text-[var(--shop-cream)]">{p.name}</span>
                          <span className="block truncate text-[12.5px] text-[var(--shop-muted)]">{p.blurb}</span>
                        </span>
                        <span className="shrink-0 font-[family-name:var(--font-heading)] text-[14.5px] font-bold text-[var(--shop-gold)]">${p.price}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* summary — sticky, glowing, decisive */}
            <div className="w-full flex-[0_0_320px] lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-3xl border border-[var(--shop-hair)] bg-[var(--shop-card)]">
                <div className="p-6">
                  <h2 className="m-0 font-[family-name:var(--font-heading)] text-[18px] font-bold text-[var(--shop-cream)]">Summary</h2>
                  <div className="mt-5 flex justify-between text-[14px] text-[var(--shop-muted)]">
                    <span>Subtotal · {count} item{count === 1 ? "" : "s"}</span>
                    <span className="text-[var(--shop-cream)]" style={{ fontVariantNumeric: "tabular-nums" }}>${subtotal}</span>
                  </div>
                  <div className="mt-3 flex justify-between text-[14px] text-[var(--shop-muted)]">
                    <span>US shipping, flat</span>
                    <span className="text-[var(--shop-cream)]" style={{ fontVariantNumeric: "tabular-nums" }}>${FLAT_SHIPPING}</span>
                  </div>
                  <div className="mt-5 flex items-baseline justify-between border-t border-[var(--shop-hair)] pt-5">
                    <span className="font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--shop-cream)]">Total</span>
                    <span className="font-[family-name:var(--font-heading)] text-[26px] font-extrabold tracking-[-0.02em] text-[var(--shop-gold)]" style={{ fontVariantNumeric: "tabular-nums" }}>${subtotal + FLAT_SHIPPING}</span>
                  </div>
                  <button disabled title="Square checkout wires up at launch" className="mt-5 w-full cursor-not-allowed rounded-2xl bg-[var(--shop-gold)] py-4 font-[family-name:var(--font-heading)] text-[16px] font-bold text-[#1C1400] opacity-55 shadow-[0_10px_32px_rgba(215,160,0,.22)]">
                    Checkout
                  </button>
                  <p className="mb-0 mt-2.5 text-center text-[12px] text-[var(--shop-dim)]">Preview build — payments switch on at launch.</p>
                </div>
                <div className="border-t border-[var(--shop-hair)] bg-[rgba(252,249,239,.02)] px-6 py-4">
                  <p className="m-0 text-[12.5px] leading-relaxed text-[var(--shop-muted)]">Packed and shipped by hand, by the person who built the app. Small runs — when it&apos;s gone, it&apos;s gone.</p>
                </div>
              </div>

              {/* builder rewards — quiet, not needy */}
              <Link href="/rewards" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(215,160,0,.3)] px-5 py-4 text-[var(--shop-cream)] transition-transform duration-[220ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:-translate-y-0.5" style={{ background: "linear-gradient(130deg, #18552F 0%, #0B361A 100%)" }}>
                <span className="flex flex-col leading-tight">
                  <span className="font-[family-name:var(--font-heading)] text-[14px] font-bold">Builders earn gear free</span>
                  <span className="mt-0.5 text-[12px] text-[rgba(252,249,239,.66)]">25 courses = gear · 50 = a bag</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--shop-gold-soft)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* phone: sticky checkout bar */}
      {!empty && lines !== null && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 px-4 pb-5 pt-3.5 lg:hidden" style={{ background: "linear-gradient(180deg, rgba(18,26,21,0) 0%, rgba(18,26,21,.94) 28%, #121A15 100%)" }}>
          <span className="flex flex-col leading-tight">
            <span className="text-[11px] text-[var(--shop-dim)]">Total</span>
            <span className="font-[family-name:var(--font-heading)] text-[19px] font-bold text-[var(--shop-gold)]" style={{ fontVariantNumeric: "tabular-nums" }}>${subtotal + FLAT_SHIPPING}</span>
          </span>
          <button disabled title="Square checkout wires up at launch" className="h-[52px] flex-1 cursor-not-allowed rounded-2xl bg-[var(--shop-gold)] font-[family-name:var(--font-heading)] text-[15px] font-bold text-[#1C1400] opacity-55">
            Checkout
          </button>
        </div>
      )}
    </div>
  );
}
