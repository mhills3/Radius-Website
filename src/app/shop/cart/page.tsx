"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FLAT_SHIPPING, productForSku, readCart, stockForSku, updateCartLine, type CartLine } from "@/lib/shop";

/** The cart screen. Line items with steppers capped at live stock, remove,
 *  order summary with the flat shipping, and the checkout button that goes
 *  live with Square. */
export default function CartPage() {
  const [lines, setLines] = useState<CartLine[] | null>(null);

  useEffect(() => {
    const sync = () => setLines(readCart());
    sync();
    window.addEventListener("radius-cart", sync);
    return () => window.removeEventListener("radius-cart", sync);
  }, []);

  const subtotal = (lines || []).reduce((n, l) => n + l.price * l.qty, 0);
  const empty = lines !== null && lines.length === 0;

  return (
    <div className="mx-auto max-w-[860px] px-6 pb-24 pt-24 sm:px-8 sm:pt-28">
      <div className="text-[13px] text-[var(--shop-dim)]">
        <Link href="/shop" className="text-[var(--shop-muted)] hover:text-[var(--shop-cream)]">Shop</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span>Cart</span>
      </div>
      <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[34px] font-bold tracking-[-0.03em] text-[var(--shop-cream)] sm:text-[40px]">Your cart</h1>

      {lines === null ? null : empty ? (
        <div className="mt-10 rounded-2xl border border-[var(--shop-hair)] bg-[var(--shop-card)] px-6 py-14 text-center">
          <p className="m-0 text-[15px] text-[var(--shop-muted)]">Nothing in here yet.</p>
          <Link href="/shop" className="mt-5 inline-flex h-12 items-center rounded-xl bg-[var(--shop-gold)] px-6 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[#1C1400] transition-colors hover:bg-[var(--shop-gold-soft)]">
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-start gap-8 lg:gap-12">
          {/* lines */}
          <div className="min-w-0 flex-[1_1_440px]">
            {lines.map((l) => {
              const product = productForSku(l.sku);
              const max = Math.max(1, stockForSku(l.sku));
              const img = product?.images[0];
              return (
                <div key={l.sku} className="flex items-center gap-4 border-b border-[var(--shop-hair)] py-5 first:pt-0">
                  <Link href={product ? `/shop/${product.slug}` : "/shop"} className="inline-flex h-[82px] w-[82px] flex-none items-center justify-center overflow-hidden rounded-xl" style={{ background: "radial-gradient(76% 76% at 50% 34%, #1E2C23 0%, #141D18 100%)" }} aria-label={l.name}>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.src} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <svg width="48" height="48" viewBox="0 0 200 200" fill="none" stroke="var(--shop-gold-soft)" strokeOpacity=".5" strokeWidth="4" aria-hidden="true"><ellipse cx="100" cy="104" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="26" ry="22" /></svg>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-[family-name:var(--font-heading)] text-[16px] font-semibold text-[var(--shop-cream)]">{l.name}</span>
                      <span className="shrink-0 font-[family-name:var(--font-heading)] text-[15.5px] font-bold text-[var(--shop-gold)]">${l.price * l.qty}</span>
                    </div>
                    {l.variantLabel && <div className="mt-0.5 text-[13px] text-[var(--shop-muted)]">{l.variantLabel}</div>}
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="flex h-11 items-center overflow-hidden rounded-xl border border-[var(--shop-hair-2)]">
                        <button onClick={() => updateCartLine(l.sku, l.qty - 1)} aria-label={`Fewer ${l.name}`} className="h-11 w-11 text-[17px] text-[var(--shop-muted)] transition-colors hover:text-[var(--shop-cream)]">−</button>
                        <span className="min-w-6 text-center text-[14px] font-semibold text-[var(--shop-cream)]" style={{ fontVariantNumeric: "tabular-nums" }}>{l.qty}</span>
                        <button onClick={() => updateCartLine(l.sku, Math.min(max, l.qty + 1))} disabled={l.qty >= max} aria-label={`More ${l.name}`} className="h-11 w-11 text-[17px] text-[var(--shop-muted)] transition-colors hover:text-[var(--shop-cream)] disabled:cursor-not-allowed disabled:opacity-35">+</button>
                      </div>
                      <button onClick={() => updateCartLine(l.sku, 0)} className="min-h-11 text-[13px] text-[var(--shop-dim)] transition-colors hover:text-[var(--shop-muted)]">Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Link href="/shop" className="mt-5 inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold text-[var(--shop-gold)] hover:underline">
              ← Keep shopping
            </Link>
          </div>

          {/* summary */}
          <div className="w-full flex-[0_1_300px] rounded-2xl border border-[var(--shop-hair)] bg-[var(--shop-card)] p-6">
            <h2 className="m-0 font-[family-name:var(--font-heading)] text-[18px] font-bold text-[var(--shop-cream)]">Summary</h2>
            <div className="mt-4 flex justify-between text-[14px] text-[var(--shop-muted)]">
              <span>Subtotal</span><span className="text-[var(--shop-cream)]">${subtotal}</span>
            </div>
            <div className="mt-2.5 flex justify-between text-[14px] text-[var(--shop-muted)]">
              <span>US shipping</span><span className="text-[var(--shop-cream)]">${FLAT_SHIPPING}</span>
            </div>
            <div className="mt-4 flex justify-between border-t border-[var(--shop-hair)] pt-4">
              <span className="font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--shop-cream)]">Total</span>
              <span className="font-[family-name:var(--font-heading)] text-[18px] font-bold text-[var(--shop-gold)]">${subtotal + FLAT_SHIPPING}</span>
            </div>
            <button disabled title="Square checkout wires up at launch" className="mt-5 w-full cursor-not-allowed rounded-xl bg-[var(--shop-gold)] py-3.5 font-[family-name:var(--font-heading)] text-[15px] font-bold text-[#1C1400] opacity-55">
              Checkout
            </button>
            <p className="mb-0 mt-2.5 text-center text-[12px] text-[var(--shop-dim)]">Preview build — payments switch on at launch.</p>
          </div>
        </div>
      )}
    </div>
  );
}
