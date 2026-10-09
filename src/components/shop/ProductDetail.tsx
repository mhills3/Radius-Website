"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addToCart, FLAT_SHIPPING, hasVariantAxes, totalStock, type ShopProduct } from "@/lib/shop";

/** Detail pane: gallery, variant pickers (only when the product has real
 *  axes), quantity capped at the chosen variant's stock, add-to-cart with the
 *  live total, URL-synced selection, and the phone bottom bar that appears
 *  when the main button scrolls away. */
export default function ProductDetail({ product }: { product: ShopProduct }) {
  const router = useRouter();
  const params = useSearchParams();
  const axes = hasVariantAxes(product);

  const colors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of product.variants) if (!seen.has(v.color)) seen.set(v.color, v.colorHex);
    return [...seen.entries()].map(([id, hex]) => ({ id, hex }));
  }, [product.variants]);
  const sizes = useMemo(() => [...new Set(product.variants.map((v) => v.size))], [product.variants]);

  // Single-variant products are preselected; multi-axis start unselected per spec.
  const [color, setColor] = useState<string | null>(() => (axes ? (params.get("color") || null) : product.variants[0].color));
  const [size, setSize] = useState<string | null>(() => (axes ? (params.get("size") || null) : product.variants[0].size));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  // Selection is shareable and survives refresh.
  useEffect(() => {
    if (!axes) return;
    const q = new URLSearchParams();
    if (color) q.set("color", color);
    if (size) q.set("size", size);
    router.replace(`/shop/${product.slug}${q.size ? `?${q}` : ""}`, { scroll: false });
  }, [axes, color, size, product.slug, router]);

  const variantOf = (c: string | null, s: string | null) => product.variants.find((v) => v.color === c && v.size === s);
  const selected = variantOf(color, size);
  const inStock = (c: string | null, s: string | null) => {
    if (c !== null && s !== null) return (variantOf(c, s)?.stock ?? 0) > 0;
    if (c !== null) return product.variants.some((v) => v.color === c && v.stock > 0);
    if (s !== null) return product.variants.some((v) => v.size === s && v.stock > 0);
    return true;
  };
  // Clamp at use-time instead of syncing state — switching to a lower-stock
  // variant immediately caps the displayed quantity without an extra render.
  const maxQty = Math.max(1, selected ? selected.stock : 1);
  const qtyShown = Math.min(qty, maxQty);

  const stock = totalStock(product);
  const lowStock = product.lowStockThreshold != null && stock > 0 && stock <= product.lowStockThreshold;
  const canAdd = !!selected && selected.stock > 0;
  const total = product.price * qtyShown;

  const add = () => {
    if (!canAdd || !selected) return;
    addToCart({
      slug: product.slug, name: product.name, price: product.price, qty: qtyShown, sku: selected.sku,
      variantLabel: axes ? [selected.color !== "default" ? cap(selected.color) : null, selected.size !== "OS" ? selected.size : null].filter(Boolean).join(" / ") || undefined : undefined,
    });
    setAdded(true);
  };

  // Phone bottom bar appears once the real button is off-screen.
  const btnRef = useRef<HTMLButtonElement>(null);
  const [barVisible, setBarVisible] = useState(false);
  useEffect(() => {
    const el = btnRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const ob = new IntersectionObserver(([e]) => setBarVisible(!e.isIntersecting), { threshold: 0 });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  const img = product.images[imgIdx] ?? product.images[0];

  return (
    <>
      <div className="flex flex-wrap items-start gap-10 lg:gap-14">
        {/* gallery */}
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-3.5">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[18px] border border-[var(--shop-hair)]" style={{ background: "radial-gradient(76% 76% at 50% 34%, #1E2C23 0%, #141D18 100%)" }}>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.src} alt={`${product.name} — ${img.label}`} className="h-full w-full object-cover" />
            ) : (
              <>
                <svg width="300" height="300" viewBox="0 0 200 200" fill="none" stroke="var(--shop-gold-soft)" strokeOpacity=".55" strokeWidth="2" aria-hidden="true">
                  <ellipse cx="100" cy="104" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="54" ry="47" /><ellipse cx="100" cy="100" rx="26" ry="22" />
                </svg>
                <span className="absolute bottom-4 right-4 text-[10px] tracking-[0.15em] text-[var(--shop-dim)]">PHOTO COMING</span>
              </>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-3.5">
              {product.images.map((im, i) => (
                <button
                  key={im.src}
                  onClick={() => setImgIdx(i)}
                  aria-label={`View ${im.label}`}
                  aria-pressed={i === imgIdx}
                  className="aspect-square overflow-hidden rounded-xl bg-[var(--shop-card)]"
                  style={{ border: i === imgIdx ? "1.5px solid rgba(215,160,0,.5)" : "1px solid rgba(252,249,239,.10)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* details */}
        <div className="flex min-w-0 flex-[1_1_420px] flex-col pt-1.5">
          {lowStock && (
            <div className="mb-5 inline-flex self-start items-center gap-2 rounded-lg border border-[rgba(215,160,0,.42)] bg-[rgba(215,160,0,.12)] px-2.5 py-1.5 text-[10.5px] font-bold tracking-[0.15em] text-[var(--shop-gold)]">
              LAST RUN — {stock} LEFT
            </div>
          )}
          <h1 className="m-0 font-[family-name:var(--font-heading)] text-[32px] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--shop-cream)] sm:text-[40px]">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3.5">
            <span className="font-[family-name:var(--font-heading)] text-[28px] font-bold tracking-[-0.02em] text-[var(--shop-gold)]">${product.price}</span>
            <span className="text-[13.5px] text-[var(--shop-dim)]">+ ${FLAT_SHIPPING} flat US shipping</span>
          </div>
          <p className="mb-0 mt-5 max-w-[440px] text-[15.5px] leading-[1.6] text-[var(--shop-muted)]">{product.description}</p>

          {axes && colors.length > 1 && (
            <div className="mt-8">
              <div className="mb-3 flex items-baseline gap-2.5">
                <span className="text-[11px] font-bold tracking-[0.15em] text-[var(--shop-dim)]">COLOR</span>
                <span className="text-[13.5px] font-medium text-[var(--shop-cream)]">{color ? cap(color) : "Choose one"}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {colors.map((c) => {
                  const ok = inStock(c.id, size);
                  const on = color === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => ok && setColor(c.id)}
                      disabled={!ok}
                      aria-pressed={on}
                      aria-label={`${cap(c.id)}${ok ? "" : " — out of stock"}`}
                      className={`inline-flex h-[46px] w-[46px] items-center justify-center rounded-full bg-transparent ${ok ? "cursor-pointer" : "cursor-not-allowed opacity-35"}`}
                      style={{ border: on ? "2px solid var(--shop-gold)" : "1px solid rgba(252,249,239,.20)" }}
                    >
                      <span className="block h-[30px] w-[30px] rounded-full" style={{ background: c.hex, boxShadow: "inset 0 0 0 1px rgba(252,249,239,.14)" }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {axes && sizes.length > 1 && (
            <div className="mt-7">
              <div className="mb-3 flex items-baseline justify-between gap-2.5">
                <span className="text-[11px] font-bold tracking-[0.15em] text-[var(--shop-dim)]">SIZE</span>
                <Link href="/contact" className="text-[13px] text-[var(--shop-muted)] hover:text-[var(--shop-cream)]">Size guide</Link>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {sizes.map((s) => {
                  const ok = inStock(color, s);
                  const on = size === s;
                  return (
                    <button
                      key={s}
                      onClick={() => ok && setSize(s)}
                      disabled={!ok}
                      aria-pressed={on}
                      aria-label={`Size ${s}${ok ? "" : " — out of stock"}`}
                      className={`h-[46px] min-w-14 rounded-xl px-3.5 font-[family-name:var(--font-heading)] text-[14.5px] font-semibold transition-colors ${ok ? "" : "cursor-not-allowed line-through opacity-35"}`}
                      style={{
                        background: on ? "rgba(215,160,0,.12)" : "transparent",
                        color: on ? "var(--shop-cream)" : "var(--shop-muted)",
                        border: on ? "1.5px solid var(--shop-gold)" : "1px solid rgba(252,249,239,.16)",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-stretch gap-3">
            <div className="flex h-14 items-center overflow-hidden rounded-[13px] border border-[var(--shop-hair-2)]">
              <button onClick={() => { setQty((q) => Math.max(1, q - 1)); setAdded(false); }} aria-label="Decrease quantity" className="h-14 w-[46px] text-[19px] text-[var(--shop-muted)] transition-colors hover:text-[var(--shop-cream)]">−</button>
              <span className="min-w-8 text-center font-[family-name:var(--font-heading)] text-[16px] font-semibold text-[var(--shop-cream)]" style={{ fontVariantNumeric: "tabular-nums" }}>{qtyShown}</span>
              <button onClick={() => { setQty((q) => Math.min(Math.max(1, maxQty), q + 1)); setAdded(false); }} aria-label="Increase quantity" className="h-14 w-[46px] text-[19px] text-[var(--shop-muted)] transition-colors hover:text-[var(--shop-cream)]">+</button>
            </div>
            <button
              ref={btnRef}
              onClick={add}
              disabled={!canAdd}
              className={`h-14 flex-[1_1_240px] rounded-[13px] font-[family-name:var(--font-heading)] text-[16.5px] font-bold tracking-[-0.01em] text-[#1C1400] transition-colors ${canAdd ? "bg-[var(--shop-gold)] shadow-[0_8px_26px_rgba(215,160,0,.20)] hover:bg-[var(--shop-gold-soft)]" : "cursor-not-allowed bg-[var(--shop-gold)] opacity-45"}`}
            >
              {added ? "Added to cart ✓" : !selected && axes ? "Choose your options" : `Add to cart — $${total}`}
            </button>
          </div>
          <p className="mt-2.5 text-[12px] text-[var(--shop-dim)]">
            Preview build — checkout switches on at launch.
            {added && <Link href="/shop/cart" className="ml-2 font-semibold text-[var(--shop-gold)] hover:underline">View cart →</Link>}
          </p>

          {product.details.length > 0 && (
            <div className="mt-7 border-t border-[var(--shop-hair)]">
              {product.details.map((d, i) => (
                <div key={d.label} className={`flex justify-between gap-5 py-4 text-[14px] ${i < product.details.length - 1 ? "border-b border-[var(--shop-hair)]" : ""}`}>
                  <span className="text-[var(--shop-muted)]">{d.label}</span>
                  <span className="text-right text-[var(--shop-cream)]">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* phone bottom bar once the main button scrolls away */}
      {barVisible && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 px-4 pb-5 pt-3.5 sm:hidden" style={{ background: "linear-gradient(180deg, rgba(18,26,21,0) 0%, rgba(18,26,21,.94) 28%, #121A15 100%)" }}>
          <span className="font-[family-name:var(--font-heading)] text-[19px] font-bold text-[var(--shop-gold)]">${total}</span>
          <button onClick={add} disabled={!canAdd} className={`h-[52px] flex-1 rounded-2xl font-[family-name:var(--font-heading)] text-[15px] font-bold text-[#1C1400] ${canAdd ? "bg-[var(--shop-gold)]" : "cursor-not-allowed bg-[var(--shop-gold)] opacity-45"}`}>
            {added ? "Added ✓" : "Add to cart"}
          </button>
        </div>
      )}
    </>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
