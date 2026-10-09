"use client";

import { useEffect, useState } from "react";
import { cartCount, readCart, clearCart, FLAT_SHIPPING, type CartLine } from "@/lib/shop";

/** Nav cart — rendered only on /shop routes. Dropdown lists the line items;
 *  checkout hands them to Square's hosted page at launch. */
export default function CartButton() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    const sync = () => { setCount(cartCount()); setLines(readCart()); };
    sync();
    window.addEventListener("radius-cart", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("radius-cart", sync); window.removeEventListener("storage", sync); };
  }, []);

  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
        aria-expanded={open}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--shop-hair-2)] text-[var(--shop-cream)] transition-colors hover:border-[rgba(252,249,239,.42)]"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[var(--shop-gold)] px-1 text-[11px] font-bold text-[#1C1400]">{count}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[52px] z-50 w-72 rounded-2xl border border-[var(--shop-hair)] bg-[var(--shop-card)] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
          {lines.length === 0 ? (
            <p className="py-4 text-center text-[13.5px] text-[var(--shop-muted)]">Nothing in the cart yet.</p>
          ) : (
            <>
              {lines.map((l) => (
                <div key={l.sku} className="flex items-baseline justify-between gap-3 border-b border-[var(--shop-hair)] py-2.5 text-[13.5px] last:border-0">
                  <span className="min-w-0 truncate text-[var(--shop-cream)]">{l.qty}× {l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</span>
                  <span className="shrink-0 font-bold text-[var(--shop-gold)]">${l.price * l.qty}</span>
                </div>
              ))}
              <div className="mt-3 flex items-baseline justify-between text-[13px] text-[var(--shop-muted)]">
                <span>Subtotal + ${FLAT_SHIPPING} shipping</span>
                <span className="font-[family-name:var(--font-heading)] text-[15px] font-bold text-[var(--shop-cream)]">${subtotal + FLAT_SHIPPING}</span>
              </div>
              <button disabled title="Square checkout wires up at launch" className="mt-3 w-full cursor-not-allowed rounded-xl bg-[var(--shop-gold)] py-2.5 text-[13.5px] font-bold text-[#1C1400] opacity-60">
                Checkout — at launch
              </button>
              <button onClick={clearCart} className="mt-2 w-full text-center text-[12px] text-[var(--shop-dim)] hover:text-[var(--shop-muted)]">Empty cart</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
