// Radius Shop — physical merch Michael ships himself (distinct from the apps'
// "Pro Shop" affiliate disc buying). Mockup phase: products live here; at
// launch this moves to the Square catalog (source of truth, so in-person
// sales at a table decrement the same stock) with checkout via Square's
// hosted page and a webhook into shopOrders.
export interface ShopProduct {
  id: string;
  name: string;
  price: number;        // USD
  description: string;
  image?: string;       // /shop/<file> in /public — absent renders the awaiting-photo frame
  fulfillment: "self" | "printful";
  // Filled in by Michael before launch: mold, plastic, available weights.
  details?: string[];
  soldOut?: boolean;
}

/** Flat US shipping per order — a disc in a rigid mailer is ~10 oz, which is
 *  $4.15–$5.50 commercial Ground Advantage to almost any US zone. */
export const FLAT_SHIPPING = 5;

export const PRODUCTS: ShopProduct[] = [
  {
    id: "lobster-disc",
    name: "Lobster Disc",
    price: 20,
    description: "The Radius lobster stamp, straight from Beverly. Each one packed and shipped by the person who built the app.",
    fulfillment: "self",
  },
];
