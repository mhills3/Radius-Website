import { type DbDisc, type CustomDiscDef } from "./bag";

export interface DiscData extends DbDisc {
  stability: number;
  slug: string;
}

/** Convert a user's custom disc into a DiscData row so bag views can render it like any catalog
 *  disc. Custom discs win by name over the catalog (iOS UserProfile.allAvailableDiscs). */
export function customToDiscData(c: CustomDiscDef): DiscData {
  const manufacturer = c.manufacturer || "Custom";
  return {
    name: c.name,
    manufacturer,
    category: c.category ?? "",
    speed: c.speed ?? 0,
    glide: c.glide ?? 0,
    turn: c.turn ?? 0,
    fade: c.fade ?? 0,
    color: c.color ?? "#a673d9",
    stability: stabilityOf({ turn: c.turn, fade: c.fade }),
    slug: discSlug({ manufacturer, name: c.name }),
  };
}

export function discSlug(d: { manufacturer: string; name: string }): string {
  return `${d.manufacturer} ${d.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export const stabilityOf = (d: { turn?: number; fade?: number }) => (d.turn ?? 0) + (d.fade ?? 0);
export const stabilityLabel = (s: number) => (s < -0.5 ? "Understable" : s <= 1.5 ? "Stable" : "Overstable");
export const stabilityTier = (s: number): "US" | "ST" | "OS" => (s < -0.5 ? "US" : s <= 1.5 ? "ST" : "OS");
export const tierColor = (t: "US" | "ST" | "OS") => (t === "US" ? "#4d94fa" : t === "ST" ? "#5fcf80" : "#e0473f");
export function catLabel(c: string): string {
  const k = c.toLowerCase().replace(/[\s_]/g, "");
  return ({ putter: "Putter", midrange: "Midrange", fairwaydriver: "Fairway Driver", distancedriver: "Distance Driver", controldriver: "Fairway Driver" } as Record<string, string>)[k] ?? c;
}

/** Build the derived list from raw discs.json rows, with unique slugs. */
export function buildDiscs(rows: DbDisc[]): DiscData[] {
  const seen = new Map<string, number>();
  return rows.map((d) => {
    let s = discSlug(d);
    const n = (seen.get(s) ?? 0) + 1;
    seen.set(s, n);
    if (n > 1) s = `${s}-${n}`;
    return { ...d, stability: stabilityOf(d), slug: s };
  });
}
