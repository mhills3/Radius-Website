import { db } from "./firebase";
import { collection, doc, getDocs, setDoc, query, where, limit, writeBatch, onSnapshot } from "firebase/firestore";
import { resolveCanonicalId, getProfileLite, type ProfileLite } from "./account";

// App notification types (exact raw strings the iOS/Android apps write). The web also created a few
// of its own ("mention", "reply") historically — keep them readable too.
export type NotifType =
  | "like" | "comment" | "commentReply" | "follow" | "followRequest"
  | "threadReply" | "postLikeMilestone" | "threadUpvoteMilestone" | "replyUpvoteMilestone"
  | "meetupJoin" | "meetupMessage" | "mention" | "reply";

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

/**
 * Create a notification using the EXACT cross-platform schema the apps read
 * (recipientId / type / postId / fromUserId / fromUserName / fromUserHandle / date / isRead),
 * with the apps' deterministic doc-id convention so a like/follow upserts instead of duplicating.
 * `actor` may be a resolved ProfileLite (preferred) or a raw uid to look up. No self-notify.
 */
export async function createNotification(params: { recipientId: string; actor: ProfileLite | string; type: NotifType; postId?: string; preview?: string }): Promise<void> {
  try {
    const actor = typeof params.actor === "string" ? await getProfileLite(params.actor) : params.actor;
    if (!actor || !params.recipientId || actor.canonicalId === params.recipientId) return;
    const fromUserId = actor.canonicalId;
    const postId = params.postId ?? "";
    // app writes "commentReply" for reply-to-comment; translate so the apps render it
    const type = params.type === "reply" ? "commentReply" : params.type;
    const docId =
      type === "like" ? `notif_${fromUserId}_like_${postId}` :
      type === "follow" ? `notif_${fromUserId}_follow_${params.recipientId}` :
      `notif_${uuid()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docData: Record<string, any> = {
      recipientId: params.recipientId,
      type,
      postId,
      fromUserId,
      fromUserName: actor.name || actor.username || "Someone",
      fromUserHandle: actor.username ?? "",
      date: Date.now(),
      isRead: 0,
    };
    if (params.preview) docData.commentText = params.preview.slice(0, 140);
    await setDoc(doc(db, "notifications", docId), docData, { merge: true });
  } catch {
    /* notifications are best-effort */
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(id: string, d: Record<string, any>): AppNotification {
  const isRead = d.isRead === 1 || d.isRead === true || d.read === true;
  return {
    id,
    recipientId: (d.recipientId as string) ?? "",
    type: (d.type as NotifType) ?? "like",
    // apps store the actor as fromUser*; older web docs used actor*
    actorId: (d.fromUserId ?? d.actorId ?? "") as string,
    actorName: (d.fromUserName ?? d.actorName ?? "Someone") as string,
    actorHandle: ((d.fromUserHandle ?? d.actorHandle) as string | undefined)?.replace(/^@/, "") || undefined,
    actorPhotoUrl: (d.actorPhotoUrl as string) || undefined, // apps don't store it — resolved below
    postId: (d.postId as string) || undefined,
    preview: ((d.commentText ?? d.preview) as string) || undefined,
    createdAt: Number(d.date ?? d.createdAt) || 0,
    read: isRead,
  };
}

export async function getNotifications(uid: string, max = 50): Promise<AppNotification[]> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", cid), limit(max)));
    const items = snap.docs.map((s) => map(s.id, s.data())).sort((a, b) => b.createdAt - a.createdAt);

    // The apps never store the actor's avatar (and sometimes not the name) — resolve from the
    // actor's profile. getProfileLite handles canonical-id resolution + the users doc.
    const needIds = [...new Set(items.filter((n) => (!n.actorPhotoUrl || !n.actorName || n.actorName === "Someone") && n.actorId).map((n) => n.actorId))];
    if (needIds.length) {
      const profs = await Promise.all(needIds.map(async (aid) => [aid, await getProfileLite(aid).catch(() => null)] as const));
      const pm = new Map(profs);
      for (const n of items) {
        const p = n.actorId ? pm.get(n.actorId) : null;
        if (!p) continue;
        if (!n.actorName || n.actorName === "Someone") n.actorName = p.name || p.username || n.actorName;
        if (!n.actorHandle) n.actorHandle = p.username?.replace(/^@/, "") || undefined;
        if (!n.actorPhotoUrl) n.actorPhotoUrl = p.profileImageUrl;
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
    // Can't filter on read server-side (apps use `isRead`, old web used `read`) — count client-side.
    const snap = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", cid), limit(50)));
    return snap.docs.map((s) => map(s.id, s.data())).filter((n) => !n.read).length;
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
      query(collection(db, "notifications"), where("recipientId", "==", cid), limit(50)),
      (snap) => cb(snap.docs.map((s) => map(s.id, s.data())).filter((n) => !n.read).length),
      () => {}
    );
  });
  return () => { alive = false; unsub(); };
}

export async function markAllRead(uid: string): Promise<void> {
  try {
    const cid = await resolveCanonicalId(uid);
    const snap = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", cid), limit(200)));
    const unread = snap.docs.filter((s) => !map(s.id, s.data()).read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    // Write `isRead` (the apps' field; they keep their own local read-state and ignore the server
    // value, so this is safe) plus `read` for older web docs.
    unread.forEach((s) => batch.update(s.ref, { isRead: 1, read: true }));
    await batch.commit();
  } catch {
    /* ignore */
  }
}

/** Link a notification points to. */
export function notifHref(n: AppNotification): string {
  if (n.type === "follow" || n.type === "followRequest") return n.actorHandle ? `/u/${n.actorHandle}` : "/community";
  if (n.type === "meetupJoin" || n.type === "meetupMessage") return "/community";
  return n.postId ? `/community/post/${n.postId}` : "/community";
}

export function notifVerb(t: NotifType): string {
  switch (t) {
    case "mention": return "mentioned you in a post";
    case "follow": return "started following you";
    case "followRequest": return "requested to follow you";
    case "comment": return "commented on your post";
    case "reply":
    case "commentReply": return "replied to your comment";
    case "threadReply": return "replied to your thread";
    case "postLikeMilestone": return "— your post hit a like milestone";
    case "threadUpvoteMilestone": return "— your thread hit an upvote milestone";
    case "replyUpvoteMilestone": return "— your reply hit an upvote milestone";
    case "meetupJoin": return "joined your meetup";
    case "meetupMessage": return "sent a message in your meetup";
    case "like":
    default: return "liked your post";
  }
}
