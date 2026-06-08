import { db } from "./firebase";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit, writeBatch, onSnapshot } from "firebase/firestore";
import { resolveCanonicalId, getProfileLite, type ProfileLite } from "./account";

export type NotifType = "mention" | "follow" | "comment" | "reply" | "like";

export interface AppNotification {
  id: string;
  recipientId: string;
  type: NotifType;
  actorId: string;
  actorName: string;
  actorHandle?: string;
  actorPhotoUrl?: string;
  postId?: string;
  preview?: string;
  createdAt: number;
  read: boolean;
}

function uuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Create a notification. `actor` may be a resolved ProfileLite (preferred) or a raw uid to look up. No self-notify. */
export async function createNotification(params: { recipientId: string; actor: ProfileLite | string; type: NotifType; postId?: string; preview?: string }): Promise<void> {
  try {
    const actor = typeof params.actor === "string" ? await getProfileLite(params.actor) : params.actor;
    if (!actor || !params.recipientId || actor.canonicalId === params.recipientId) return;
    const id = uuid();
    await setDoc(doc(db, "notifications", id), {
      id,
      recipientId: params.recipientId,
      type: params.type,
      actorId: actor.canonicalId,
      actorName: actor.name || actor.username || "Someone",
      actorHandle: actor.username ?? null,
      actorPhotoUrl: actor.profileImageUrl ?? null,
      postId: params.postId ?? null,
      preview: params.preview ? params.preview.slice(0, 140) : null,
      createdAt: Date.now(),
      read: false,
    });
  } catch {
    /* notifications are best-effort */
  }
}

function map(id: string, d: Record<string, unknown>): AppNotification {
  return {
    id,
    recipientId: (d.recipientId as string) ?? "",
    type: (d.type as NotifType) ?? "mention",
    actorId: (d.actorId as string) ?? "",
    actorName: (d.actorName as string) ?? "Someone",
    actorHandle: (d.actorHandle as string | undefined)?.replace(/^@/, "") || undefined,
    actorPhotoUrl: (d.actorPhotoUrl as string) || undefined,
    postId: (d.postId as string) || undefined,
    preview: (d.preview as string) || undefined,
    createdAt: Number(d.createdAt) || 0,
    read: d.read === true,
  };
}

export async function getNotifications(uid: string, max = 50): Promise<AppNotification[]> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", cid), limit(max)));
    const items = snap.docs.map((s) => map(s.id, s.data())).sort((a, b) => b.createdAt - a.createdAt);

    // Legacy docs stored actorName "Someone" — resolve the real actor from users/{actorId} at read time.
    const needIds = [...new Set(items.filter((n) => (!n.actorName || n.actorName === "Someone") && n.actorId).map((n) => n.actorId))];
    if (needIds.length) {
      const entries = await Promise.all(needIds.map(async (aid) => {
        try { const d = await getDoc(doc(db, "users", aid)); return [aid, d.exists() ? d.data() : null] as const; } catch { return [aid, null] as const; }
      }));
      const pm = new Map(entries);
      for (const n of items) {
        if ((!n.actorName || n.actorName === "Someone") && n.actorId) {
          const u = pm.get(n.actorId);
          if (u) {
            n.actorName = (u.name as string) || (u.username as string) || n.actorName;
            n.actorHandle = n.actorHandle || (u.username as string | undefined)?.replace(/^@/, "") || undefined;
            const photo = u.profileImageUrl;
            n.actorPhotoUrl = n.actorPhotoUrl || (typeof photo === "string" && /^https?:\/\//.test(photo) ? photo : undefined);
          }
        }
      }
    }
    return items;
  } catch {
    return [];
  }
}

export async function getUnreadCount(uid: string): Promise<number> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", cid), where("read", "==", false), limit(50)));
    return snap.size;
  } catch {
    return 0;
  }
}

/** Live unread-count subscription. Returns an unsubscribe fn. */
export function subscribeUnreadCount(uid: string, cb: (n: number) => void): () => void {
  let unsub = () => {};
  let alive = true;
  resolveCanonicalId(uid).then((cid) => {
    if (!alive) return;
    unsub = onSnapshot(
      query(collection(db, "notifications"), where("recipientId", "==", cid), where("read", "==", false), limit(50)),
      (snap) => cb(snap.size),
      () => {}
    );
  });
  return () => { alive = false; unsub(); };
}

export async function markAllRead(uid: string): Promise<void> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", cid), where("read", "==", false), limit(200)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((s) => batch.update(s.ref, { read: true }));
    await batch.commit();
  } catch {
    /* ignore */
  }
}

/** Link a notification points to. */
export function notifHref(n: AppNotification): string {
  if (n.type === "follow") return n.actorHandle ? `/u/${n.actorHandle}` : "/community";
  return n.postId ? `/community/post/${n.postId}` : "/community";
}
export function notifVerb(t: NotifType): string {
  return t === "mention" ? "mentioned you in a post" : t === "follow" ? "started following you" : t === "comment" ? "commented on your post" : t === "reply" ? "replied to your comment" : "liked your post";
}
