import Link from "next/link";
import { CATEGORY_LABEL, type ShopProduct } from "@/lib/shop";

/** Index grid card — image, badge (only when the data says so), then
 *  category / name+price baseline row / one-line blurb. */
export default function ProductCard({ product }: { product: ShopProduct }) {
  return (
    <Link
      href={`/shop/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--shop-hair)] bg-[var(--shop-card)] text-[var(--shop-cream)] transition-[border-color,transform] duration-[220ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] hover:-translate-y-[3px] hover:border-[rgba(215,160,0,.42)]"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden" style={{ background: "radial-gradient(78% 78% at 50% 36%, #1E2C23 0%, #141D18 100%)" }}>
        {product.badge && (
          <span className="absolute left-3.5 top-3.5 rounded-md border border-[rgba(215,160,0,.45)] bg-[rgba(215,160,0,.12)] px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-[var(--shop-gold)]">{product.badge}</span>
        )}
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0].src} alt={product.name} className="h-full w-full object-cover transition-transform duration-[350ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.035]" />
        ) : (
          <>
            <svg className="transition-transform duration-[350ms] [transition-timing-function:cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.035]" width="190" height="190" viewBox="0 0 200 200" fill="none" stroke="var(--shop-gold-soft)" strokeOpacity=".5" strokeWidth="2.2" aria-hidden="true">
              <ellipse cx="100" cy="104" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="66" ry="58" /><ellipse cx="100" cy="100" rx="54" ry="47" /><ellipse cx="100" cy="100" rx="26" ry="22" />
            </svg>
            <span className="absolute bottom-3 right-3.5 text-[9.5px] tracking-[0.14em] text-[var(--shop-dim)]">PHOTO COMING</span>
          </>
        )}
      </div>
      <div className="flex flex-col gap-[5px] px-5 pb-5 pt-4">
        <div className="text-[11px] font-semibold tracking-[0.13em] text-[var(--shop-dim)]">{CATEGORY_LABEL[product.category].toUpperCase()}</div>
        <div className="flex items-baseline justify-between gap-3.5">
          <span className="font-[family-name:var(--font-heading)] text-[17.5px] font-semibold tracking-[-0.015em]">{product.name}</span>
          <span className="font-[family-name:var(--font-heading)] text-[17px] font-bold text-[var(--shop-gold)]">${product.price}</span>
        </div>
        <div className="text-[13.5px] leading-snug text-[var(--shop-muted)]">{product.blurb}</div>
      </div>
    </Link>
  );
}
