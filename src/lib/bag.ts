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
  photoUrl?: string;
  outcomes?: DiscOutcomes;
}

// Raw myBagJSON disc object (what iOS/Android store) — kept for lossless write-back.
export interface RawDisc {
  id: string;
  discName: string;
  wear?: { condition?: string; customSpeed?: number; customGlide?: number; customTurn?: number; customFade?: number };
  nickname?: string;
}

export interface Bag {
  discs: FlightDisc[];
  rating: BagRating;
  armSpeed?: string;
  rawDiscs: RawDisc[];
  favoriteIds: string[];
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
    const a = dec(v) ?? dec(b64ToUtf8(v));
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

export async function getBag(uid: string): Promise<Bag> {
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
  const rawBag = asArray(data.myBagJSON);
  const custom = asArray(data.customDiscsJSON);
  const customMap = new Map<string, { manufacturer?: string; category?: string; speed?: number; glide?: number; turn?: number; fade?: number; color?: string }>();
  for (const c of custom) if (c?.name) customMap.set(String(c.name).toLowerCase(), c);

  const throwCounts = asObject(userSnap.exists() ? userSnap.data().discThrowCounts : {});
  const armSpeed = userSnap.exists() ? (userSnap.data().armSpeed as string | undefined) : undefined;
  const favoriteIds: string[] = (Array.isArray(data.favoriteDiscs) ? data.favoriteDiscs : []).map((x: unknown) => String(x));
  const photoMap = asObject(data.discPhotoUrls); // discName -> Storage URL

  const discs: FlightDisc[] = rawBag.map((d, i) => {
    const name = (d?.discName ?? d?.name ?? "Disc").toString();
    const key = name.toLowerCase();
    const src = dbMap.get(key) ?? customMap.get(key);
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
      color: plasticColor(src?.color),
      throwCount: Number(throwCounts[name]) || 0,
      known,
      isFavorite: favoriteIds.includes((d?.id ?? "").toString()),
      photoUrl: safeHttp(photoMap[name]),
      outcomes: outcomeMap.get(name),
    };
  });

  const rating = rateBag(discs, armSpeed, discDb.list);
  return { discs, rating, armSpeed, rawDiscs: rawBag as RawDisc[], favoriteIds };
}
