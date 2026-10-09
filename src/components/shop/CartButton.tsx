"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCount } from "@/lib/shop";

/** Nav cart — rendered only on /shop routes; opens the cart screen. */
export default function CartButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(cartCount());
    sync();
    window.addEventListener("radius-cart", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("radius-cart", sync); window.removeEventListener("storage", sync); };
  }, []);

  return (
    <Link
      href="/shop/cart"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--shop-hair-2,rgba(252,249,239,.16))] text-[var(--shop-cream,#FCF9EF)] transition-colors hover:border-[rgba(252,249,239,.42)]"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#D7A000] px-1 text-[11px] font-bold text-[#1C1400]">{count}</span>
      )}
    </Link>
  );
}
