import type { Metadata } from "next";
import ProductCard from "@/components/shop/ProductCard";
import { PRODUCTS } from "@/lib/shop";

// Hidden until launch: no nav link anywhere, and noindex keeps crawlers out
// of the preview. Launch = wire Square checkout, drop the preview copy,
// remove the robots block, add the nav link.
export const metadata: Metadata = {
  title: "Shop — Radius",
  description: "Radius gear, packed and shipped from Beverly: stamped discs, hats, stickers.",
  robots: { index: false, follow: false },
};

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
      <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Radius Shop</p>
      <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[40px] font-black leading-[1.02] tracking-[-0.03em] text-[var(--cream)] sm:text-[56px]">
        Gear from the home course.
      </h1>
      <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-[var(--sage)]">
        Small batches, stamped and packed in Beverly, Massachusetts. When it&apos;s gone, it&apos;s gone until the next run.
      </p>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        {PRODUCTS.map((p) => <ProductCard key={p.id} product={p} />)}

        {/* coming soon — tees & hoodies (Printful phase) */}
        <div className="grid place-items-center rounded-3xl border border-dashed border-[var(--c-line)] bg-[var(--c-raise)] p-10 text-center">
          <div>
            <span className="text-3xl">👕</span>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[20px] font-extrabold tracking-tight text-[var(--cream)]">Tees &amp; hoodies</h2>
            <p className="mt-2 max-w-60 text-[14px] leading-relaxed text-[var(--sage-dim)]">Designs in the works. The lobster may be involved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
