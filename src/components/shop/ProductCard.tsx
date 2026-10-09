"use client";

import { useState } from "react";
import { FLAT_SHIPPING, type ShopProduct } from "@/lib/shop";

export default function ProductCard({ product }: { product: ShopProduct }) {
  const [qty, setQty] = useState(1);
  const subtotal = product.price * qty;

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--c-line)] bg-[var(--c-card)] shadow-[0_20px_50px_-24px_rgba(0,0,0,0.7)]">
      {/* photo */}
      <div className="relative aspect-square bg-[var(--c-raise)]">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <div className="text-center">
              <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-2 border-dashed border-[var(--gold)]/35">
                <span className="text-4xl">🥏</span>
              </div>
              <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--sage-dim)]">Photo coming</p>
            </div>
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-[var(--gold)] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#141B16]">
          Shipped by Mikey
        </span>
      </div>

      <div className="p-6 sm:p-7">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-[family-name:var(--font-heading)] text-[24px] font-extrabold tracking-tight text-[var(--cream)]">{product.name}</h2>
          <span className="shrink-0 font-[family-name:var(--font-heading)] text-[22px] font-extrabold text-[var(--gold)]">${product.price}</span>
        </div>
        <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--sage)]">{product.description}</p>
        {product.details && product.details.length > 0 && (
          <ul className="mt-3 space-y-1 text-[13px] text-[var(--sage-dim)]">
            {product.details.map((d) => <li key={d}>· {d}</li>)}
          </ul>
        )}

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center rounded-full border border-[var(--c-line)] bg-[var(--c-raise)]">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Fewer" className="px-4 py-2.5 text-[18px] font-bold text-[var(--cream)] transition-colors hover:text-[var(--gold)]">−</button>
            <span className="min-w-7 text-center text-[15px] font-bold text-[var(--cream)]" style={{ fontVariantNumeric: "tabular-nums" }}>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(9, q + 1))} aria-label="More" className="px-4 py-2.5 text-[18px] font-bold text-[var(--cream)] transition-colors hover:text-[var(--gold)]">+</button>
          </div>
          <div className="text-[13px] leading-tight text-[var(--sage-dim)]">
            <div className="text-[var(--sage)]">${subtotal} + ${FLAT_SHIPPING} shipping</div>
            <div>ships anywhere in the US</div>
          </div>
        </div>

        <button
          disabled
          title="Checkout goes live at launch — this is the design preview"
          className="mt-5 w-full cursor-not-allowed rounded-2xl bg-[var(--gold)] py-3.5 text-[15px] font-black uppercase tracking-[0.08em] text-[#141B16] opacity-60"
        >
          Checkout · ${subtotal + FLAT_SHIPPING}
        </button>
        <p className="mt-2.5 text-center text-[12px] text-[var(--sage-dim)]">Preview build — payments switch on at launch.</p>
      </div>
    </div>
  );
}
