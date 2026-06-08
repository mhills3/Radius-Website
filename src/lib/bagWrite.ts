import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
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

/** Merge-write ONLY myBagJSON + lastUpdated. Pass the full raw disc array (lossless). */
export async function saveBag(uid: string, discs: RawDisc[]): Promise<void> {
  const cid = await resolveCanonicalId(uid);
  await setDoc(doc(db, `userBackups/${cid}/data/current`), { myBagJSON: encodeBag(discs), lastUpdated: Date.now() }, { merge: true });
}

/** Build a fresh bag-disc object in the exact iOS/Android shape. */
export function newDisc(discName: string): RawDisc {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().toUpperCase()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`.toUpperCase();
  return { id, discName, wear: { condition: "Brand New" } };
}
