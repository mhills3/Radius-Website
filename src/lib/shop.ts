import { db } from "./firebase";
import { collection, getCountFromServer, query, where } from "firebase/firestore";

// Radius Shop — physical merch Michael ships himself (distinct from the apps'
// "Pro Shop" affiliate disc buying). One source of truth: the index and the
// detail page both render these records; adding a product = adding a record.
// At launch this module is fed from the Square catalog (so in-person sales
// decrement the same stock) and checkout goes through Square's hosted page.

export type ShopCategory = "apparel" | "discs" | "accessories";

export interface ShopVariant {
  color: string;      // id, e.g. "forest"
  colorHex: string;
  size: string;       // "OS" for one-size products
  sku: string;
  stock: number;
}

export interface ShopProduct {
  slug: string;
  name: string;
  category: ShopCategory;
  price: number;              // USD
  compareAtPrice?: number;
  blurb: string;              // one line, for the card
  description: string;        // paragraph, for the detail page
  badge?: string;             // only when TRUE — never invented scarcity
  /** Below this stock total the detail page shows the remaining count. */
  lowStockThreshold?: number;
  images: { src: string; label: string }[]; // empty → awaiting-photo frame
  variants: ShopVariant[];    // single "default/OS" variant = no pickers rendered
  details: { label: string; value: string }[]; // only true facts
  relatedSlugs: string[];
}

/** Flat US shipping per order — a disc in a rigid mailer is ~10 oz, which is
 *  $4.15–$5.50 commercial Ground Advantage to almost any US zone. */
export const FLAT_SHIPPING = 5;

export const CATEGORY_LABEL: Record<ShopCategory, string> = { apparel: "Apparel", discs: "Discs", accessories: "Accessories" };

// ---------------------------------------------------------------- catalog
// Real inventory only. Stock below is a placeholder count Michael confirms
// before launch; photos land in /public/shop/.
export const PRODUCTS: ShopProduct[] = [
  {
    slug: "rope-hat",
    name: "Rope Hat",
    category: "apparel",
    price: 32,
    blurb: "Radius rope hat, snapback",
    description: "The Radius hat from the builder boxes — rope front, snapback, one size. Packed and shipped by the person who built the app.",
    images: [],
    variants: [{ color: "default", colorHex: "#F4F1E8", size: "OS", sku: "ROPE-HAT", stock: 10 }],
    details: [
      { label: "Fit", value: "One size, snapback" },
      { label: "Ships", value: "USPS, flat $5 US" },
    ],
    relatedSlugs: ["lobster-disc", "sticker-pack"],
  },
  {
    slug: "lobster-disc",
    name: "Lobster Disc",
    category: "discs",
    price: 20,
    blurb: "The Radius lobster stamp",
    description: "The Radius lobster, hot-stamped. Every one is packed and shipped by the person who built the app.",
    images: [],
    variants: [{ color: "default", colorHex: "#E7B45F", size: "OS", sku: "LOBSTER-DISC", stock: 25 }],
    details: [
      { label: "Stamp", value: "Radius lobster" },
      { label: "Ships", value: "USPS, flat $5 US" },
    ],
    relatedSlugs: ["rope-hat", "sticker-pack"],
  },
  {
    slug: "sticker-pack",
    name: "Sticker Pack",
    category: "accessories",
    price: 8,
    blurb: "Weatherproof Radius vinyl",
    description: "Weatherproof vinyl Radius stickers — bag, cart, car, basket. The same ones that ride along in every builder box.",
    images: [],
    variants: [{ color: "default", colorHex: "#E7B45F", size: "OS", sku: "STICKER-PACK", stock: 30 }],
    details: [
      { label: "Material", value: "Weatherproof vinyl" },
      { label: "Ships", value: "USPS, flat $5 US" },
    ],
    relatedSlugs: ["lobster-disc", "rope-hat"],
  },
];
// Stock counts above (hat 10, disc 25, stickers 30) are placeholders —
// Michael confirms real counts before launch; they cap the quantity steppers.

export const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
export const totalStock = (p: ShopProduct) => p.variants.reduce((n, v) => n + v.stock, 0);
/** True multi-variant products render color/size pickers; a lone OS variant doesn't. */
export const hasVariantAxes = (p: ShopProduct) => p.variants.length > 1 || p.variants[0]?.size !== "OS";

/** Live count of builders who earned the 50-course bag — same source of truth
 *  as the rewards program (users.courseRewards.awarded). Returns null on any
 *  failure so callers HIDE the number rather than showing a stale or fake one. */
export async function getBagEarnerCount(): Promise<number | null> {
  try {
    const c = await getCountFromServer(query(collection(db, "users"), where("courseRewards.awarded", "array-contains", "builder-50")));
    return c.data().count;
  } catch { return null; }
}

// ---------------------------------------------------------------- cart
// Client-side line items only — checkout hands these to Square's hosted page
// at launch. localStorage keyed per browser; "radius-cart" event keeps the
// nav badge in sync.
export interface CartLine { slug: string; name: string; price: number; qty: number; sku: string; variantLabel?: string }

const CART_KEY = "radiusShopCart";

export function readCart(): CartLine[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
}
export function cartCount(): number { return readCart().reduce((n, l) => n + l.qty, 0); }
export function addToCart(line: CartLine): void {
  try {
    const cart = readCart();
    const existing = cart.find((l) => l.sku === line.sku);
    if (existing) existing.qty += line.qty; else cart.push(line);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("radius-cart"));
  } catch { /* private mode etc. — the buy still works at checkout time */ }
}
export function clearCart(): void {
  try { localStorage.removeItem(CART_KEY); window.dispatchEvent(new Event("radius-cart")); } catch { /* ignore */ }
}
