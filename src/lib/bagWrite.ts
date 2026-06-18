import { db } from "./firebase";
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { resolveCanonicalId } from "./account";
import { type RawDisc } from "./bag";

// myBagJSON / customDiscsJSON are base64-encoded JSON strings (UTF-8 safe).
function encodeJsonB64(obj: unknown): string {
  const json = JSON.stringify(obj);
  if (typeof btoa !== "undefined") return btoa(unescape(encodeURIComponent(json)));
  return Buffer.from(json, "utf8").toString("base64");
}
const encodeBag = (discs: RawDisc[]): string => encodeJsonB64(discs);

function b64ToUtf8(b64: string): string {
  if (typeof atob !== "undefined") {
    const bin = atob(b64);
    return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  return Buffer.from(b64, "base64").toString("utf8");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeJsonArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    for (const s of [v, (() => { try { return b64ToUtf8(v); } catch { return ""; } })()]) {
      try { const a = JSON.parse(s); if (Array.isArray(a)) return a; } catch {}
    }
  }
  return [];
}

/** Merge-write ONLY favoriteDiscs + lastUpdated (matches the app's bag write contract). */
export async function setFavorites(uid: string, favoriteIds: string[]): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await setDoc(doc(db, `userBackups/${cid}/data/current`), { favoriteDiscs: favoriteIds, lastUpdated: Date.now() }, { merge: true });
}

/**
 * Merge-write ONLY myBagJSON + lastUpdated (+ deletedBagDiscIds tombstones). Pass the full raw
 * disc array (lossless). When discs are removed, pass their ids as `removedIds` so they are added
 * to the shared `deletedBagDiscIds` tombstone list (via arrayUnion) — REQUIRED for the deletion to
 * propagate: iOS/Android merge the bag by id and re-add any disc the cloud is missing UNLESS its id
 * is tombstoned. arrayUnion preserves tombstones written by other devices.
 */
export async function saveBag(uid: string, discs: RawDisc[], removedIds?: string[]): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  const payload: Record<string, unknown> = { myBagJSON: encodeBag(discs), lastUpdated: Date.now() };
  if (removedIds && removedIds.length) payload.deletedBagDiscIds = arrayUnion(...removedIds);
  await setDoc(doc(db, `userBackups/${cid}/data/current`), payload, { merge: true });
}

// Collection & Lost: bag/collection/lost are kept mutually exclusive BY NAME (matches the apps).
// A move drops the disc from myBagJSON and adds its NAME to the target list (arrayUnion) while
// removing it from the other list (arrayRemove). NO tombstone — move-back works because the name
// leaves the list and the disc reappears in myBagJSON. The apps reconcile the bag against these
// lists by name on adopt, so the disc lands in exactly one place.
const dataDoc = (cid: string) => doc(db, `userBackups/${cid}/data/current`);

/** Move a bag disc into the collection. Pass the bag WITHOUT the moved disc. */
export async function moveToCollection(uid: string, bagWithout: RawDisc[], discName: string): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await setDoc(dataDoc(cid), { myBagJSON: encodeBag(bagWithout), myCollection: arrayUnion(discName), lostDiscs: arrayRemove(discName), lastUpdated: Date.now() }, { merge: true });
}

/** Mark a bag disc as lost. Pass the bag WITHOUT the disc. */
export async function markAsLost(uid: string, bagWithout: RawDisc[], discName: string): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await setDoc(dataDoc(cid), { myBagJSON: encodeBag(bagWithout), lostDiscs: arrayUnion(discName), myCollection: arrayRemove(discName), lastUpdated: Date.now() }, { merge: true });
}

/** Recover a collection/lost disc back into the bag. Pass the bag WITH the fresh disc added. */
export async function recoverToBag(uid: string, bagWith: RawDisc[], discName: string): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await setDoc(dataDoc(cid), { myBagJSON: encodeBag(bagWith), myCollection: arrayRemove(discName), lostDiscs: arrayRemove(discName), lastUpdated: Date.now() }, { merge: true });
}

/** Permanently remove a disc from the collection AND lost lists (it's not in the bag). */
export async function deleteStoredDisc(uid: string, discName: string): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await setDoc(dataDoc(cid), { myCollection: arrayRemove(discName), lostDiscs: arrayRemove(discName), lastUpdated: Date.now() }, { merge: true });
}

/** Fresh uppercase-UUID bag-entry id (matches the iOS/Android id shape). */
export function freshId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().toUpperCase()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`.toUpperCase();
}

/** Build a fresh bag-disc object in the exact iOS/Android shape. */
export function newDisc(discName: string): RawDisc {
  return { id: freshId(), discName, wear: { condition: "Brand New" } };
}

// A custom disc, in the EXACT cross-platform shape stored in customDiscsJSON. `category` MUST be the
// iOS rawValue ("Putter" | "Midrange" | "Fairway Driver" | "Distance Driver") — Android maps it on
// read. Keyed by `name` (the unique id); flight numbers are JSON numbers (Doubles).
export interface CustomDiscInput {
  name: string;
  manufacturer: string;
  category: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
}

/**
 * Create a custom disc (one not in the catalog) exactly as the apps do: union it into
 * `customDiscsJSON` by name (add-or-update, never clobbering other custom discs), and either add a
 * `myBagJSON` entry (dest "bag") or its name to `myCollection` (dest "collection"). Reads the doc
 * first to merge the existing custom-disc array. `nextBag` is the full bag array INCLUDING the new
 * entry (built by the caller) — used only when dest === "bag".
 */
export async function addCustomDisc(uid: string, custom: CustomDiscInput, dest: "bag" | "collection", nextBag: RawDisc[]): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  const ref = dataDoc(cid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? decodeJsonArray(snap.data().customDiscsJSON) : [];
  const byName = new Map<string, Record<string, unknown>>();
  for (const c of existing) { const n = c?.name; if (n) byName.set(String(n).toLowerCase(), c); }
  // Only the 7 cross-platform fields — no id/isCustom/createdAt (clients infer/ignore those).
  byName.set(custom.name.toLowerCase(), {
    name: custom.name,
    manufacturer: custom.manufacturer.trim() || "Custom",
    category: custom.category,
    speed: custom.speed,
    glide: custom.glide,
    turn: custom.turn,
    fade: custom.fade,
  });
  const payload: Record<string, unknown> = { customDiscsJSON: encodeJsonB64([...byName.values()]), lastUpdated: Date.now() };
  if (dest === "bag") payload.myBagJSON = encodeBag(nextBag);
  else payload.myCollection = arrayUnion(custom.name);
  await setDoc(ref, payload, { merge: true });
}
