import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { resolveCanonicalId } from "./account";
import { rateBag, type BagRating } from "./bagRating";
import { getDecodedRoundsForCanonical, outcomesByDisc, type DiscOutcomes } from "./rounds";

export type Cat = "DISTANCE" | "FAIRWAY" | "MIDRANGE" | "PUTTER" | "UNKNOWN";
export type Tier = "US" | "ST" | "OS";

// Category colors mirror the app: putter green, mid blue, fairway amber, distance red.
export const CAT_META: Record<Cat, { label: string; short: string; order: number; color: string }> = {
  DISTANCE: { label: "Distance Drivers", short: "Distance", order: 0, color: "#d9473f" },
  FAIRWAY: { label: "Fairway Drivers", short: "Fairway", order: 1, color: "#e0a23f" },
  MIDRANGE: { label: "Midranges", short: "Midrange", order: 2, color: "#4d94fa" },
  PUTTER: { label: "Putters", short: "Putter", order: 3, color: "#5fb87a" },
  UNKNOWN: { label: "Other", short: "Other", order: 4, color: "#8a968d" },
};

// Stability colors mirror the app (RadiusColors): understable blue, overstable red.
export const TIER_META: Record<Tier, { label: string; color: string }> = {
  US: { label: "Understable", color: "#4d94fa" },
  ST: { label: "Straight", color: "#5fb87a" },
  OS: { label: "Overstable", color: "#d9473f" },
};

/** RHBH flight path → SVG path string + end point, scalable to any canvas. */
export function buildFlightPath(
  d: Pick<FlightDisc, "speed" | "turn" | "fade">,
  W: number,
  H: number,
  pad: number
): { d: string; endX: number; endY: number } {
  const CX = W / 2;
  const BASE = H - pad;
  const K = W * 0.034;
  const maxL = H - pad * 2;
  const L = Math.max(60, Math.min(maxL, ((d.speed ?? 5) / 14) * (maxL - 40) + 60));
  const turnDrift = -(d.turn ?? 0);
  const midX = CX + turnDrift * K;
  const endX = CX + (turnDrift - (d.fade ?? 0)) * K;
  const c1 = `${CX},${(BASE - 0.34 * L).toFixed(1)}`;
  const c2 = `${(CX + turnDrift * K * 0.7).toFixed(1)},${(BASE - 0.56 * L).toFixed(1)}`;
  const mid = `${midX.toFixed(1)},${(BASE - 0.68 * L).toFixed(1)}`;
  const c3 = `${(CX + turnDrift * K * 1.05).toFixed(1)},${(BASE - 0.82 * L).toFixed(1)}`;
  const c4 = `${endX.toFixed(1)},${(BASE - 0.93 * L).toFixed(1)}`;
  return { d: `M${CX},${BASE} C${c1} ${c2} ${mid} C${c3} ${c4} ${endX.toFixed(1)},${(BASE - L).toFixed(1)}`, endX, endY: BASE - L };
}

export interface FlightDisc {
  id: string;
  name: string;
  nickname?: string;
  brand?: string;
  category: Cat;
  speed?: number;
  glide?: number;
  turn?: number;
  fade?: number;
  stability?: number;
  tier?: Tier;
  condition?: string;
  // Per-disc custom flight overrides (wear.custom*) — factory numbers stay in speed/glide/turn/fade.
  customSpeed?: number;
  customGlide?: number;
  customTurn?: number;
  customFade?: number;
  color: string;
  throwCount: number;
  known: boolean;
  isFavorite: boolean;
  isPuttingPutter?: boolean; // flagged putting putter — excluded from the bag SCORE (grades your throwing arsenal)
  photoUrl?: string;
  outcomes?: DiscOutcomes;
}

// Raw myBagJSON disc object (what iOS/Android store) — kept for lossless write-back.
export interface RawDisc {
  id: string;
  discName: string;
  wear?: { condition?: string; customSpeed?: number; customGlide?: number; customTurn?: number; customFade?: number };
  nickname?: string;
  isPuttingPutter?: boolean; // omit unless true (iOS encoder convention)
}

export interface BagMeta { id: string; name: string; discCount: number; active: boolean }

export interface Bag {
  discs: FlightDisc[];
  rating: BagRating;
  armSpeed?: string;
  rawDiscs: RawDisc[];
  favoriteIds: string[];
  collection: FlightDisc[]; // discs owned but not in the bag (myCollection — name only)
  lost: FlightDisc[];        // discs marked lost (lostDiscs — name only)
  bags: BagMeta[];           // every named bag (multiple-bags accounts; empty for legacy)
  selectedBagId?: string;    // which bag this view was built from
}

export interface DbDisc {
  name: string;
  manufacturer: string;
  category: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  color?: string;
}

export function normCat(raw?: string): Cat {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("distance")) return "DISTANCE";
  if (s.includes("fairway") || s.includes("control")) return "FAIRWAY";
  if (s.includes("mid")) return "MIDRANGE";
  if (s.includes("putt")) return "PUTTER";
  return "UNKNOWN";
}

export function tierFor(stab: number): Tier {
  return stab < -0.5 ? "US" : stab <= 1.5 ? "ST" : "OS";
}

function safeHttp(u: unknown): string | undefined {
  return typeof u === "string" && /^https?:\/\//.test(u) ? u : undefined;
}

// Plastic color names (from the disc DB) → display hex.
const COLOR_MAP: Record<string, string> = {
  orange: "#f0883e",
  green: "#5fb87a",
  yellow: "#e8d44d",
  indigo: "#6c63d9",
  purple: "#a673d9",
  red: "#e0584f",
  cyan: "#4cc7d9",
  pink: "#e87ab0",
  blue: "#4d94fa",
  teal: "#3fae9e",
  brown: "#b78c59",
  mint: "#7fd9b0",
};
export function plasticColor(name?: string): string {
  return (name && COLOR_MAP[name.toLowerCase()]) || "#8a968d";
}

let dbPromise: Promise<{ map: Map<string, DbDisc>; list: DbDisc[] }> | null = null;
function loadDiscDb(): Promise<{ map: Map<string, DbDisc>; list: DbDisc[] }> {
  if (!dbPromise) {
    dbPromise = fetch("/discs.json")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.discs as DbDisc[]) ?? [];
        const map = new Map<string, DbDisc>();
        for (const d of list) map.set(d.name.toLowerCase(), d);
        return { map, list };
      })
      .catch(() => ({ map: new Map<string, DbDisc>(), list: [] as DbDisc[] }));
  }
  return dbPromise;
}

export async function getDiscCatalog(): Promise<DbDisc[]> {
  return (await loadDiscDb()).list;
}

/** Names of every putter-category disc in the catalog — mirrors iOS `putterDiscNames`
 *  (DiscDatabase.allDiscs.filter { category == .putter }). Used to classify putts on rounds where
 *  the throw isn't lie-stamped (e.g. GPS putts, which carry no putt lie). */
export async function getPutterDiscNames(): Promise<Set<string>> {
  const cat = await getDiscCatalog();
  return new Set(cat.filter((d) => normCat(d.category) === "PUTTER").map((d) => d.name));
}

/** The user's OWN bag discs flagged `isPuttingPutter` — mirrors iOS `UserProfile.puttingPutterNames`
 *  (Set(myBag where isPuttingPutter)). This is the NARROW set that Round.puttTally / greenHitRate use.
 *  Do NOT use getPutterDiscNames() (whole-catalog putter CATEGORY) for per-round putting — that
 *  counts approach/tee shots thrown with any putter-molded disc as missed putts, halving C1 %. */
export async function getPuttingPutterNames(uid: string): Promise<Set<string>> {
  const bag = await getBag(uid);
  return new Set(bag.rawDiscs.filter((d) => d.isPuttingPutter).map((d) => d.discName));
}

// Decode a base64 string as UTF-8. `atob` alone yields a Latin-1 "binary string", which
// corrupts multibyte UTF-8 (accents/diacritics → mojibake like "bílý" → "bÃ­lÃ½"); reinterpret
// the decoded bytes through TextDecoder so disc names/nicknames keep their real characters.
function b64ToUtf8(b64: string): string {
  if (typeof atob !== "undefined") {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    const dec = (s: string) => {
      try { return JSON.parse(s); } catch { return null; }
    };
    let b64 = "";
    try { b64 = b64ToUtf8(v); } catch { /* not base64 */ }
    const a = dec(v) ?? (b64 ? dec(b64) : null);
    if (Array.isArray(a)) return a;
  }
  return [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asObject(v: unknown): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try { const o = JSON.parse(v); if (o && typeof o === "object") return o; } catch {}
  }
  return {};
}

/** Bag disc-names from users/{canonicalId}.bagDiscs (a simple string[]). Accepts a raw auth uid or canonical id. */
export async function getBagNames(uid: string): Promise<string[]> {
  try {
    const cid = await resolveCanonicalId(uid);
    const s = await getDoc(doc(db, "users", cid));
    const a = s.exists() ? s.data().bagDiscs : null;
    return Array.isArray(a) ? a.map((x: unknown) => String(x)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** A user's custom disc, in the cross-platform customDiscsJSON shape. */
export interface CustomDiscDef {
  name: string;
  manufacturer?: string;
  category?: string;
  speed?: number;
  glide?: number;
  turn?: number;
  fade?: number;
  color?: string;
}

/**
 * A user's custom discs (customDiscsJSON on userBackups/{cid}/data/current) — the SAME source
 * getBag reads. Custom discs override catalog molds by name (iOS UserProfile.allAvailableDiscs).
 * Used by the profile/compare bag views so they resolve custom discs like the owner's own bag.
 * Degrades to [] on any error (e.g. if a future rules lockdown restricts cross-user reads).
 */
export async function getCustomDiscs(uid: string): Promise<CustomDiscDef[]> {
  try {
    const cid = await resolveCanonicalId(uid);
    const s = await getDoc(doc(db, `userBackups/${cid}/data/current`));
    if (!s.exists()) return [];
    return asArray(s.data().customDiscsJSON)
      .filter((c) => c?.name)
      .map((c) => ({
        name: String(c.name),
        manufacturer: c.manufacturer ? String(c.manufacturer) : undefined,
        category: c.category ? String(c.category) : undefined,
        speed: typeof c.speed === "number" ? c.speed : undefined,
        glide: typeof c.glide === "number" ? c.glide : undefined,
        turn: typeof c.turn === "number" ? c.turn : undefined,
        fade: typeof c.fade === "number" ? c.fade : undefined,
        color: c.color ? String(c.color) : undefined,
      }));
  } catch {
    return [];
  }
}

export async function getBag(uid: string, bagId?: string): Promise<Bag> {
  const canonicalId = await resolveCanonicalId(uid);
  const [discDb, dataSnap, userSnap, decodedRounds] = await Promise.all([
    loadDiscDb(),
    getDoc(doc(db, `userBackups/${canonicalId}/data/current`)),
    getDoc(doc(db, "users", canonicalId)),
    getDecodedRoundsForCanonical(canonicalId),
  ]);
  const dbMap = discDb.map;
  const outcomeMap = outcomesByDisc(decodedRounds);

  const data = dataSnap.exists() ? dataSnap.data() : {};
  // Multiple bags (2026-07 app update): bagsJSON = base64 array of named bags of
  // {discName,id,wear} entries; activeBagId selects the live one and legacy
  // myBagJSON goes empty after migration. Prefer the active bag when present.
  const allBags = asArray(data.bagsJSON);
  const wantedId = bagId ?? String(data.activeBagId ?? "");
  const activeBag = allBags.length
    ? (allBags.find((b) => String(b?.id ?? "") === wantedId) ?? allBags.find((b) => String(b?.id ?? "") === String(data.activeBagId ?? "")) ?? allBags[0])
    : null;
  const bagsMeta: BagMeta[] = allBags.map((b) => ({
    id: String(b?.id ?? ""),
    name: String(b?.name ?? "Bag"),
    discCount: Array.isArray(b?.discs) ? b.discs.length : 0,
    active: String(b?.id ?? "") === String(data.activeBagId ?? ""),
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawBag: any[] = activeBag ? (Array.isArray(activeBag.discs) ? activeBag.discs : []) : asArray(data.myBagJSON);
  const custom = asArray(data.customDiscsJSON);
  const customMap = new Map<string, { manufacturer?: string; category?: string; speed?: number; glide?: number; turn?: number; fade?: number; color?: string }>();
  for (const c of custom) if (c?.name) customMap.set(String(c.name).toLowerCase(), c);

  const throwCounts = asObject(userSnap.exists() ? userSnap.data().discThrowCounts : {});
  const armSpeed = userSnap.exists() ? (userSnap.data().armSpeed as string | undefined) : undefined;
  const favoriteIds: string[] = (Array.isArray(data.favoriteDiscs) ? data.favoriteDiscs : []).map((x: unknown) => String(x));
  const photoMap = asObject(data.discPhotoUrls); // disc id -> Storage URL (legacy entries keyed by discName)

  const discs: FlightDisc[] = rawBag.map((d, i) => {
    const name = (d?.discName ?? d?.name ?? "Disc").toString();
    const key = name.toLowerCase();
    // Custom discs WIN by name over the catalog (matches iOS UserProfile.allAvailableDiscs):
    // a custom disc with the same name as a catalog mold replaces it entirely — category
    // and flight numbers come from the custom definition.
    const isCustom = customMap.has(key);
    const src = customMap.get(key) ?? dbMap.get(key);
    const known = !!src;
    const speed = src?.speed;
    const glide = src?.glide;
    const turn = src?.turn;
    const fade = src?.fade;
    const stability = typeof turn === "number" && typeof fade === "number" ? turn + fade : undefined;
    return {
      id: (d?.id ?? `${name}-${i}`).toString(),
      name,
      nickname: d?.nickname || undefined,
      brand: src?.manufacturer || undefined,
      category: normCat(src?.category),
      speed,
      glide,
      turn,
      fade,
      stability,
      tier: stability != null ? tierFor(stability) : undefined,
      condition: d?.wear?.condition || undefined,
      customSpeed: typeof d?.wear?.customSpeed === "number" ? d.wear.customSpeed : undefined,
      customGlide: typeof d?.wear?.customGlide === "number" ? d.wear.customGlide : undefined,
      customTurn: typeof d?.wear?.customTurn === "number" ? d.wear.customTurn : undefined,
      customFade: typeof d?.wear?.customFade === "number" ? d.wear.customFade : undefined,
      color: isCustom ? "#a673d9" : plasticColor(src?.color),
      throwCount: Number(throwCounts[name]) || 0,
      known,
      isFavorite: favoriteIds.includes((d?.id ?? "").toString()),
      isPuttingPutter: d?.isPuttingPutter === true,
      photoUrl: safeHttp(photoMap[(d?.id ?? "").toString()] ?? photoMap[name]),
      outcomes: outcomeMap.get(name),
    };
  });

  // Collection & Lost are name-only string arrays. Bag/collection/lost are mutually exclusive by
  // NAME (matches the apps): a disc whose name is in either list is shown there, not in the bag.
  const collectionNames: string[] = Array.isArray(data.myCollection) ? data.myCollection.map((x: unknown) => String(x)) : [];
  const lostNames: string[] = Array.isArray(data.lostDiscs) ? data.lostDiscs.map((x: unknown) => String(x)) : [];
  const excluded = new Set([...collectionNames, ...lostNames].map((n) => n.toLowerCase()));

  const bagDiscs = excluded.size ? discs.filter((d) => !excluded.has(d.name.toLowerCase())) : discs;
  const keptRaw = (excluded.size ? rawBag.filter((r) => !excluded.has(String(r?.discName ?? r?.name ?? "").toLowerCase())) : rawBag) as RawDisc[];

  // Resolve a bare disc name (no id/wear) to a display disc for the Collection/Lost lists.
  const nameToDisc = (name: string, idPrefix: string): FlightDisc => {
    const key = name.toLowerCase();
    // Custom wins by name over the catalog — same rule as the bag resolution above.
    const isCustom = customMap.has(key);
    const src = customMap.get(key) ?? dbMap.get(key);
    const turn = src?.turn, fade = src?.fade;
    const stability = typeof turn === "number" && typeof fade === "number" ? turn + fade : undefined;
    return {
      id: `${idPrefix}:${name}`, name, brand: src?.manufacturer || undefined, category: normCat(src?.category),
      speed: src?.speed, glide: src?.glide, turn, fade, stability, tier: stability != null ? tierFor(stability) : undefined,
      color: isCustom ? "#a673d9" : plasticColor(src?.color), throwCount: Number(throwCounts[name]) || 0, known: !!src, isFavorite: false,
      photoUrl: safeHttp(photoMap[name]),
    };
  };
  const collection = collectionNames.map((n) => nameToDisc(n, "col"));
  const lost = lostNames.map((n) => nameToDisc(n, "lost"));

  const rating = rateBag(bagDiscs, armSpeed, discDb.list);
  return { discs: bagDiscs, rating, armSpeed, rawDiscs: keptRaw, favoriteIds, collection, lost, bags: bagsMeta, selectedBagId: activeBag ? String(activeBag.id ?? "") : undefined };
}
