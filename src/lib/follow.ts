import { db } from "./firebase";
import { doc, setDoc, deleteDoc, getDoc, getDocs, collection, query, where, updateDoc, increment } from "firebase/firestore";
import { resolveCanonicalId } from "./account";
import { createNotification } from "./notifications";

// Mirrors the app's ProfileSyncService: /follows/{me}_{target} + follower/following counters.

export async function getFollowingIds(myCanonical: string): Promise<Set<string>> {
  try {
    const snap = await getDocs(query(collection(db, "follows"), where("followerUid", "==", myCanonical)));
    return new Set(snap.docs.map((d) => d.data().followingUid as string).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function isFollowing(myUid: string, targetCanonical: string): Promise<boolean> {
  try {
    const me = await resolveCanonicalId(myUid);
    const s = await getDoc(doc(db, "follows", `${me}_${targetCanonical}`));
    return s.exists();
  } catch {
    return false;
  }
}

export async function followUser(myUid: string, targetCanonical: string): Promise<void> {
  const me = await resolveCanonicalId(myUid);
  if (me === targetCanonical) return;
  await setDoc(doc(db, "follows", `${me}_${targetCanonical}`), { followerUid: me, followingUid: targetCanonical, createdAt: Date.now() });
  await Promise.all([
    updateDoc(doc(db, "users", targetCanonical), { followerCount: increment(1) }).catch(() => {}),
    updateDoc(doc(db, "users", me), { followingCount: increment(1) }).catch(() => {}),
  ]);
  await createNotification({ recipientId: targetCanonical, actor: myUid, type: "follow" });
}

export async function unfollowUser(myUid: string, targetCanonical: string): Promise<void> {
  const me = await resolveCanonicalId(myUid);
  await deleteDoc(doc(db, "follows", `${me}_${targetCanonical}`));
  await Promise.all([
    updateDoc(doc(db, "users", targetCanonical), { followerCount: increment(-1) }).catch(() => {}),
    updateDoc(doc(db, "users", me), { followingCount: increment(-1) }).catch(() => {}),
  ]);
}

/** Resolve my canonical id (for filtering the following feed). */
export async function myCanonicalId(uid: string): Promise<string> {
  return resolveCanonicalId(uid);
}
