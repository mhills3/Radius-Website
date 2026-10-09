import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ProductDetail from "@/components/shop/ProductDetail";
import { CATEGORY_LABEL, PRODUCTS, productBySlug } from "@/lib/shop";

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = productBySlug(slug);
  if (!product) notFound();

  const related = product.relatedSlugs.map(productBySlug).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div className="pb-24 sm:pb-0">
      {/* breadcrumb */}
      <div className="mx-auto max-w-[1200px] px-6 pt-24 text-[13px] text-[var(--shop-dim)] sm:px-8 sm:pt-28">
        <Link href="/shop" className="text-[var(--shop-muted)] hover:text-[var(--shop-cream)]">Shop</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <Link href={`/shop?category=${product.category}`} className="text-[var(--shop-muted)] hover:text-[var(--shop-cream)]">{CATEGORY_LABEL[product.category]}</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span>{product.name}</span>
      </div>

      <section className="mx-auto max-w-[1200px] px-6 pt-7 sm:px-8">
        {/* useSearchParams in the detail needs a Suspense boundary for prerender */}
        <Suspense>
          <ProductDetail product={product} />
        </Suspense>
      </section>

      {related.length > 0 && (
        <section className="mx-auto mt-16 max-w-[1200px] px-6 pb-20 sm:mt-[76px] sm:px-8">
          <h2 className="mb-6 font-[family-name:var(--font-heading)] text-[23px] font-bold tracking-[-0.02em] text-[var(--shop-cream)]">Goes with it</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {related.map((r) => (
              <Link key={r.slug} href={`/shop/${r.slug}`} className="flex items-center gap-4 rounded-[15px] border border-[var(--shop-hair)] bg-[var(--shop-card)] p-4 text-[var(--shop-cream)] transition-colors hover:border-[rgba(215,160,0,.42)]">
                <span className="inline-flex h-[82px] w-[82px] flex-none items-center justify-center overflow-hidden rounded-xl" style={{ background: "radial-gradient(76% 76% at 50% 34%, #1E2C23 0%, #141D18 100%)" }}>
                  {r.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.images[0].src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <svg width="52" height="52" viewBox="0 0 200 200" fill="none" stroke="var(--shop-gold-soft)" strokeOpacity=".5" strokeWidth="4" aria-hidden="true"><ellipse cx="100" cy="104" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="26" ry="22" /></svg>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="mb-1 block font-[family-name:var(--font-heading)] text-[16px] font-semibold">{r.name}</span>
                  <span className="mb-1.5 block truncate text-[13.5px] text-[var(--shop-muted)]">{r.blurb}</span>
                  <span className="block font-[family-name:var(--font-heading)] text-[14.5px] font-bold text-[var(--shop-gold)]">${r.price}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {related.length === 0 && <div className="h-20" />}
    </div>
  );
}
