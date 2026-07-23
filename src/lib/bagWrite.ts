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

const dataDoc = (cid: string) => doc(db, `userBackups/${cid}/data/current`);

/**
 * Read the LIVE data/current doc. Every myBagJSON mutation below is read-merge-write: it fetches
 * the current cloud bag at save time and applies ONLY its own mutation (replace/remove/append one
 * entry by id), never writing a full array from the caller's page-load React snapshot. A tab left
 * open while the user edits on their phone would otherwise silently revert the phone's changes
 * under a fresh lastUpdated. Callers keep optimistic local state; only the persisted write is
 * built from fresh cloud state.
 */
// Multiple bags (2026-07 app update): bagsJSON is a base64 array of named bags,
// each holding {discName,id,wear} entries, with activeBagId selecting the live
// one; the legacy myBagJSON goes empty after migration. Reads and writes target
// the ACTIVE bag when bagsJSON exists; legacy accounts keep the old field.
type BagsCtx = { bags: Record<string, unknown>[]; activeIdx: number } | null;

async function readCurrent(uid: string, bagId?: string): Promise<{ ref: ReturnType<typeof dataDoc>; data: Record<string, unknown>; bag: RawDisc[]; bagsCtx: BagsCtx }> {
  const cid = await resolveCanonicalId(uid);
  const ref = dataDoc(cid);
  const snap = await getDoc(ref);
  const data = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
  const bags = decodeJsonArray(data.bagsJSON) as Record<string, unknown>[];
  if (bags.length) {
    // Mutations target the bag being VIEWED when the caller passes one; the
    // app's active bag is only the default. Falling back silently to a
    // different bag would edit the wrong bag.
    const wanted = bagId ?? String(data.activeBagId ?? "");
    let idx = bags.findIndex((b) => String(b?.id ?? "") === wanted);
    if (idx < 0 && !bagId) idx = 0;
    if (idx < 0) throw new Error("This bag no longer exists — refresh and try again.");
    const discs = Array.isArray(bags[idx]?.discs) ? (bags[idx].discs as RawDisc[]) : [];
    return { ref, data, bag: discs, bagsCtx: { bags, activeIdx: idx } };
  }
  return { ref, data, bag: decodeJsonArray(data.myBagJSON) as RawDisc[], bagsCtx: null };
}

/** The bag fields for a mutated disc list: legacy myBagJSON always, plus the
 *  rebuilt bagsJSON (active bag only, other bags byte-preserved) when present. */
// iOS decodes bag JSON with try? over the WHOLE array: one malformed entry makes
// iOS read the entire bagsJSON as empty and republish over it — wiping every bag.
// Its DiscWear decoder THROWS if a wear object exists without a valid condition
// string. Sanitize everything we write: wear (when present) always carries one of
// the five exact condition values; blank nicknames are dropped (matches Android's
// omit-when-blank); isPuttingPutter is kept only when true (matches iOS encoder).
const IOS_CONDITIONS = new Set(["Brand New", "Slightly Used", "Seasoned", "Beat In", "Very Beat In"]);
function sanitizeEntry(r: RawDisc): RawDisc {
  const out: RawDisc & { isPuttingPutter?: boolean } = { ...r };
  if (out.wear && typeof out.wear === "object") {
    const cond = typeof out.wear.condition === "string" && IOS_CONDITIONS.has(out.wear.condition) ? out.wear.condition : "Brand New";
    const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
    out.wear = { condition: cond, customSpeed: num(out.wear.customSpeed), customGlide: num(out.wear.customGlide), customTurn: num(out.wear.customTurn), customFade: num(out.wear.customFade) };
  }
  if (typeof out.nickname === "string" && !out.nickname.trim()) delete out.nickname;
  if (out.isPuttingPutter === false) delete out.isPuttingPutter;
  return out;
}

function bagFields(bagsCtx: BagsCtx, nextRaw: RawDisc[], data?: Record<string, unknown>): Record<string, unknown> {
  const next = nextRaw.map(sanitizeEntry);
  if (!bagsCtx) return { myBagJSON: encodeBag(next) };
  // NOTE: per-bag updatedAt is the apps' LWW stamp for NAME/COSMETICS ONLY —
  // discs merge by union, so a disc edit must NOT bump it (bumping would make
  // our unchanged cosmetics "newer" and revert a rename made on a device).
  const bags = bagsCtx.bags.map((b, i) => (i === bagsCtx.activeIdx ? { ...b, discs: next } : b));
  // Legacy myBagJSON mirrors the ACTIVE bag (matches the apps' legacy bridge),
  // which may not be the bag that was just edited.
  const activeId = String(data?.activeBagId ?? "");
  const activeBag = bags.find((b) => String(b?.id ?? "") === activeId) ?? bags[0];
  const activeDiscs = Array.isArray(activeBag?.discs) ? (activeBag.discs as RawDisc[]) : [];
  return { myBagJSON: encodeBag(activeDiscs), bagsJSON: encodeJsonB64(bags) };
}

/** Merge-write ONLY favoriteDiscs + lastUpdated (matches the app's bag write contract). */
export async function setFavorites(uid: string, favoriteIds: string[]): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await setDoc(doc(db, `userBackups/${cid}/data/current`), { favoriteDiscs: favoriteIds, lastUpdated: Date.now() }, { merge: true });
}

/** Append one fresh bag entry to the CLOUD bag (duplicate same-name copies allowed, like the apps). */
export async function appendDisc(uid: string, raw: RawDisc, bagId?: string): Promise<void> {
  const { ref, data, bag, bagsCtx } = await readCurrent(uid, bagId);
  await setDoc(ref, { ...bagFields(bagsCtx, [...bag, raw], data), lastUpdated: Date.now() }, { merge: true });
}

/**
 * Edit-as-replace, one atomic write: swap the old id's entry for `replacement` (which carries a NEW
 * id) in the fresh cloud bag, tombstone the old id (REQUIRED — iOS/Android re-add any non-tombstoned
 * id they still hold), and carry the disc's photo across the id swap. Photos live in
 * `discPhotoUrls` keyed by disc id (the iOS/Android contract), so without the carry the new id has
 * no photo and the disc turns photoless on Android after the next sync. The old key is KEPT (other
 * devices may still reference the old id); keys are never deleted here. The nested-map shape is
 * deliberate: setDoc({ discPhotoUrls: { [newId]: url } }, { merge: true }) recursively merges maps,
 * adding ONE key without replacing the map — the same behavior iOS's setData(merge:true) mirror
 * relies on — and keeps bag + tombstone + photo in a single write (updateDoc dot-paths would work
 * for the key but would split the write or change every field's semantics).
 * If the old id is no longer in the cloud bag (edited/removed elsewhere since page load), the
 * replacement is appended — the user is explicitly editing this disc right now, so their intent is
 * that it exists with these values.
 */
export async function replaceDisc(uid: string, oldId: string, replacement: RawDisc, bagId?: string): Promise<void> {
  const { ref, data, bag, bagsCtx } = await readCurrent(uid, bagId);
  const next = bag.some((r) => r?.id === oldId) ? bag.map((r) => (r?.id === oldId ? replacement : r)) : [...bag, replacement];
  const payload: Record<string, unknown> = { ...bagFields(bagsCtx, next, data), deletedBagDiscIds: arrayUnion(oldId), lastUpdated: Date.now() };
  const photos = data.discPhotoUrls;
  const url = photos && typeof photos === "object" ? (photos as Record<string, unknown>)[oldId] : undefined;
  if (typeof url === "string" && url) payload.discPhotoUrls = { [replacement.id]: url };
  await setDoc(ref, payload, { merge: true });
}

/**
 * Remove one disc from the CLOUD bag by id + tombstone it. The tombstone (arrayUnion into the
 * shared `deletedBagDiscIds`) is REQUIRED for the deletion to propagate: iOS/Android merge the bag
 * by id and re-add any disc the cloud is missing UNLESS its id is tombstoned. arrayUnion preserves
 * tombstones written by other devices.
 */
export async function removeDiscById(uid: string, id: string, bagId?: string): Promise<void> {
  const { ref, data, bag, bagsCtx } = await readCurrent(uid, bagId);
  await setDoc(ref, { ...bagFields(bagsCtx, bag.filter((r) => r?.id !== id), data), deletedBagDiscIds: arrayUnion(id), lastUpdated: Date.now() }, { merge: true });
}

/**
 * Add a single catalog disc to the bag by name (used by the disc-detail "Add to bag" action).
 * Reads the current myBagJSON, appends a fresh bag entry, and merge-writes it back — lossless, and
 * matches the app shape (duplicate copies of the same disc are allowed, exactly like the apps).
 */
export async function addDiscToBag(uid: string, discName: string): Promise<void> {
  await appendDisc(uid, newDisc(discName));
}

// Collection & Lost: bag/collection/lost are kept mutually exclusive BY NAME (matches the apps).
// A move drops the disc from myBagJSON and adds its NAME to the target list (arrayUnion) while
// removing it from the other list (arrayRemove). NO tombstone — move-back works because the name
// leaves the list and the disc reappears in myBagJSON. The apps reconcile the bag against these
// lists by name on adopt, so the disc lands in exactly one place.

/** Move a bag disc into the collection. Removes ONLY that id from the fresh cloud bag. */
export async function moveToCollection(uid: string, discId: string, discName: string, bagId?: string): Promise<void> {
  const { ref, data, bag, bagsCtx } = await readCurrent(uid, bagId);
  await setDoc(ref, { ...bagFields(bagsCtx, bag.filter((r) => r?.id !== discId), data), myCollection: arrayUnion(discName), lostDiscs: arrayRemove(discName), lastUpdated: Date.now() }, { merge: true });
}

/** Mark a bag disc as lost. Removes ONLY that id from the fresh cloud bag. */
export async function markAsLost(uid: string, discId: string, discName: string, bagId?: string): Promise<void> {
  const { ref, data, bag, bagsCtx } = await readCurrent(uid, bagId);
  await setDoc(ref, { ...bagFields(bagsCtx, bag.filter((r) => r?.id !== discId), data), lostDiscs: arrayUnion(discName), myCollection: arrayRemove(discName), lastUpdated: Date.now() }, { merge: true });
}

/** Recover a collection/lost disc back into the bag. Appends ONLY the fresh entry to the cloud bag. */
export async function recoverToBag(uid: string, raw: RawDisc, discName: string, bagId?: string): Promise<void> {
  const { ref, data, bag, bagsCtx } = await readCurrent(uid, bagId);
  await setDoc(ref, { ...bagFields(bagsCtx, [...bag, raw], data), myCollection: arrayRemove(discName), lostDiscs: arrayRemove(discName), lastUpdated: Date.now() }, { merge: true });
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
 * first to merge the existing custom-disc array. `newEntry` is the single fresh bag entry (built by
 * the caller) appended to the FRESH cloud bag — used only when dest === "bag".
 */
export async function addCustomDisc(uid: string, custom: CustomDiscInput, dest: "bag" | "collection", newEntry?: RawDisc): Promise<void> {
  const { ref, data, bag, bagsCtx } = await readCurrent(uid);
  const existing = decodeJsonArray(data.customDiscsJSON);
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
  if (dest === "bag") {
    if (newEntry) Object.assign(payload, bagFields(bagsCtx, [...bag, newEntry], data));
  } else {
    payload.myCollection = arrayUnion(custom.name);
  }
  await setDoc(ref, payload, { merge: true });
}
