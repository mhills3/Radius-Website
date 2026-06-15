import { db } from "./firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { resolveCanonicalId } from "./account";
import { type RawDisc } from "./bag";

// myBagJSON is a base64-encoded JSON string (UTF-8 safe).
function encodeBag(discs: RawDisc[]): string {
  const json = JSON.stringify(discs);
  if (typeof btoa !== "undefined") return btoa(unescape(encodeURIComponent(json)));
  return Buffer.from(json, "utf8").toString("base64");
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
