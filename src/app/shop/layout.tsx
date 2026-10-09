import type { Metadata } from "next";

// Shop sub-theme: the artboards run a deeper gold + near-black ground than the
// marketing pages, so the values are scoped here instead of widening the
// global token set. Hidden until launch — noindex covers /shop and /shop/[slug];
// launch = remove robots + the preview copy in ProductDetail, merge, done.
export const metadata: Metadata = {
  title: "Shop — Radius",
  description: "Small-run Radius gear, packed and shipped by hand.",
  robots: { index: false, follow: false },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        ["--shop-ground" as string]: "#121A15",
        ["--shop-card" as string]: "#16201A",
        ["--shop-gold" as string]: "#D7A000",
        ["--shop-gold-soft" as string]: "#E7B45F",
        ["--shop-cream" as string]: "#FCF9EF",
        ["--shop-muted" as string]: "#8C958D",
        ["--shop-dim" as string]: "#5B655E",
        ["--shop-hair" as string]: "rgba(252,249,239,.10)",
        ["--shop-hair-2" as string]: "rgba(252,249,239,.16)",
        background: "var(--shop-ground)",
        color: "var(--shop-cream)",
      }}
      className="min-h-screen"
    >
      {children}
    </div>
  );
}
