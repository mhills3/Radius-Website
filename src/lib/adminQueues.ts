import { getRemovalRequests } from "./courseRemoval";
import { getAdminAccessRequests } from "./courseAdmin";
import { getFulfillments } from "./rewards";
import { getLatestDigest, type Digest } from "./communityDigest";

// Single source of truth for the /admin queue rows AND the nav badge, so the header total and the
// nav badge can never disagree — both read getAdminQueues().total.

export type Freshness =
  | { type: "lastRun"; ms: number }   // automation liveness (digest)
  | { type: "oldest"; ms: number }    // someone's been waiting this long
  | { type: "clear" };                // nothing pending

export type QueueKey = "digest" | "fulfillment" | "removals" | "adminRequests";
export interface QueueMeta { key: QueueKey; count: number; freshness: Freshness }
export interface AdminQueues { queues: QueueMeta[]; total: number }

const digestUnreviewed = (d: Digest) =>
  [...d.categories.bugs, ...d.categories.features, ...d.categories.questions, ...d.categories.notable].filter((it) => !it.reviewed).length;

export async function getAdminQueues(): Promise<AdminQueues> {
  const [removalReqs, fulfillments, latestDigest, adminReqs] = await Promise.all([
    getRemovalRequests().catch(() => []),
    getFulfillments().catch(() => []),
    getLatestDigest().catch(() => null),
    getAdminAccessRequests().catch(() => []),
  ]);

  // Removals — pending requests, oldest by createdAt.
  const pendingRemovals = removalReqs.filter((r) => (r.status || "") === "pending");
  const removalsOldest = pendingRemovals.reduce((min, r) => Math.min(min, r.createdAt ?? Infinity), Infinity);

  // Fulfillment — pending = not shipped/rejected/dismissed, oldest by submittedAt.
  const pendingFul = fulfillments.filter((f) => f.status !== "shipped" && f.status !== "rejected" && f.status !== "dismissed");
  const fulOldest = pendingFul.reduce((min, f) => Math.min(min, f.submittedAt ?? Infinity), Infinity);

  // Digest — unreviewed items in the latest digest; freshness = when the job last wrote.
  const digestCount = latestDigest ? digestUnreviewed(latestDigest) : 0;
  const digestLastRun = latestDigest?.rangeEndMs ?? 0;

  // Admin-access requests — pending, oldest by createdAt.
  const pendingAdmin = adminReqs.filter((r) => (r.status || "") === "pending");
  const adminOldest = pendingAdmin.reduce((min, r) => Math.min(min, r.createdAt ?? Infinity), Infinity);

  const queues: QueueMeta[] = [
    { key: "digest", count: digestCount, freshness: digestLastRun ? { type: "lastRun", ms: digestLastRun } : { type: "clear" } },
    { key: "fulfillment", count: pendingFul.length, freshness: pendingFul.length ? { type: "oldest", ms: fulOldest } : { type: "clear" } },
    { key: "removals", count: pendingRemovals.length, freshness: pendingRemovals.length ? { type: "oldest", ms: removalsOldest } : { type: "clear" } },
    { key: "adminRequests", count: pendingAdmin.length, freshness: pendingAdmin.length ? { type: "oldest", ms: adminOldest } : { type: "clear" } },
  ];
  const total = queues.reduce((n, q) => n + q.count, 0);
  return { queues, total };
}
