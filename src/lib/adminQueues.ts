import { getRemovalRequests } from "./courseRemoval";
import { getAdminAccessRequests } from "./courseAdmin";
import { getFulfillments } from "./rewards";
import { getLatestDigest, type Digest } from "./communityDigest";
import { getDiscSubmissions, groupLeads, pendingLeadCount } from "./discSubmissions";

// Single source of truth for the /admin queue rows AND the nav badge, so the header total and the
// nav badge can never disagree — both read getAdminQueues().total.

export type Freshness =
  | { type: "lastRun"; ms: number }   // automation liveness (digest)
  | { type: "oldest"; ms: number }    // someone's been waiting this long
  | { type: "clear" };                // nothing pending

export type QueueKey = "digest" | "fulfillment" | "removals" | "adminRequests" | "discSubmissions";

/** The oldest pending item, summarised for the hub's "Next up:" line. */
export interface NextUp { title: string; detail: string }

export interface QueueMeta {
  key: QueueKey;
  count: number;
  freshness: Freshness;
  nextUp?: NextUp;
  /** Items that arrived in the last 7 days. */
  newThisWeek: number;
  /** Items that arrived in the last 24 hours. */
  newToday: number;
  /** Items that arrived since the most recent Friday 00:00 local. */
  newSinceFriday: number;
}
export interface AdminQueues {
  queues: QueueMeta[];
  /** Actionable items (Trending Issues excluded). */
  total: number;
  /** Actionable items that arrived since the most recent Friday 00:00 local. */
  sinceFriday: number;
  /** createdAt of the oldest actionable item, or null when everything is clear. */
  oldestMs: number | null;
}

const DAY = 86_400_000;

const digestUnreviewed = (d: Digest) =>
  [...d.categories.bugs, ...d.categories.features, ...d.categories.questions, ...d.categories.notable].filter((it) => !it.reviewed).length;

/** Most recent Friday at local midnight (today, if today is Friday). */
export function lastFridayMs(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() - 5 + 7) % 7; // Fri=5
  d.setDate(d.getDate() - back);
  return d.getTime();
}

function arrivals(times: number[], now: number) {
  const fri = lastFridayMs(now);
  return {
    newThisWeek: times.filter((t) => t >= now - 7 * DAY).length,
    newToday: times.filter((t) => t >= now - DAY).length,
    newSinceFriday: times.filter((t) => t >= fri).length,
  };
}
const oldestOf = (times: number[]) => times.reduce((min, t) => Math.min(min, t), Infinity);
const freshnessOf = (times: number[]): Freshness => (times.length ? { type: "oldest", ms: oldestOf(times) } : { type: "clear" });
const loc = (c?: { city?: string; state?: string }) => [c?.city, c?.state].filter(Boolean).join(", ");

const REMOVAL_REASON: Record<string, string> = { duplicate: "Duplicate", mistake: "Mistake", closed: "Course closed", wrong_location: "Wrong location", other: "Other" };
const tierWord = (t: string[] = []) => (t.includes("gear") && t.includes("bag") ? "gear + bag" : t.includes("bag") ? "bag" : t.includes("gear") ? "gear" : "reward");
const isDomestic = (country?: string) => /^(us|usa|u\.s\.a?\.?|united states( of america)?)$/i.test((country || "").trim());

export async function getAdminQueues(): Promise<AdminQueues> {
  const [removalReqs, fulfillments, latestDigest, adminReqs, discSubs] = await Promise.all([
    getRemovalRequests().catch(() => []),
    getFulfillments().catch(() => []),
    getLatestDigest().catch(() => null),
    getAdminAccessRequests().catch(() => []),
    getDiscSubmissions().catch(() => []),
  ]);
  const now = Date.now();

  // Removals — pending requests, oldest by createdAt.
  const pendingRemovals = removalReqs.filter((r) => (r.status || "") === "pending");
  const removalTimes = pendingRemovals.map((r) => r.createdAt).filter((t): t is number => t != null);
  const oldestRemoval = [...pendingRemovals].sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity))[0];
  const removalNext: NextUp | undefined = oldestRemoval && (() => {
    const snap = oldestRemoval.courseSnapshot || {};
    const dups = oldestRemoval.evidence?.likelyDuplicates?.length ?? 0;
    const reason = REMOVAL_REASON[oldestRemoval.reasonKey || ""] || oldestRemoval.reasonKey || "Removal";
    const bits = [reason, loc(snap) || null, dups ? `${dups} likely duplicate${dups === 1 ? "" : "s"}` : null].filter(Boolean);
    return { title: snap.name || oldestRemoval.courseName, detail: bits.join(" · ") };
  })();

  // Fulfillment — pending = not shipped/rejected/dismissed, oldest by submittedAt.
  const pendingFul = fulfillments.filter((f) => f.status !== "shipped" && f.status !== "rejected" && f.status !== "dismissed");
  const fulTimes = pendingFul.map((f) => f.submittedAt).filter((t): t is number => t != null);
  const oldestFul = [...pendingFul].sort((a, b) => (a.submittedAt ?? Infinity) - (b.submittedAt ?? Infinity))[0];
  const fulNext: NextUp | undefined = oldestFul && (() => {
    const n = oldestFul.verifiedCourseCount ?? oldestFul.courseCount;
    const what = `${n != null ? `${n}-course ` : ""}${tierWord(oldestFul.tiers)}`;
    const bits = [what, oldestFul.country && !isDomestic(oldestFul.country) ? "international" : null, !oldestFul.phone ? "no phone on file" : null].filter(Boolean);
    return { title: oldestFul.fullName || "Unnamed claim", detail: bits.join(", ") };
  })();

  // Digest — unreviewed items in the latest digest; freshness = when the job last wrote.
  const digestCount = latestDigest ? digestUnreviewed(latestDigest) : 0;
  const digestLastRun = latestDigest?.rangeEndMs ?? 0;

  // Admin-access requests — pending, oldest by createdAt.
  const pendingAdmin = adminReqs.filter((r) => (r.status || "") === "pending");
  const adminTimes = pendingAdmin.map((r) => r.createdAt).filter((t): t is number => t != null);
  const oldestAdmin = [...pendingAdmin].sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity))[0];
  const adminNext: NextUp | undefined = oldestAdmin && {
    title: oldestAdmin.courseSnapshot?.name || oldestAdmin.courseName,
    detail: `${oldestAdmin.requesterName || "Someone"} wants edit rights`,
  };

  // Disc submissions — count = distinct pending LEADS (dupes + low-signal noise excluded); oldest by the
  // earliest submission inside each real lead.
  const pendingDisc = discSubs.filter((s) => (s.status || "") === "pending");
  const realLeads = groupLeads(pendingDisc).filter((l) => !l.lowSignal);
  const leadFirstSeen = (l: (typeof realLeads)[number]) => oldestOf(l.submissions.map((s) => s.createdAt || 0).filter(Boolean));
  const discTimes = realLeads.map(leadFirstSeen).filter((t) => Number.isFinite(t));
  const discCount = pendingLeadCount(discSubs);
  const oldestLead = [...realLeads].sort((a, b) => leadFirstSeen(a) - leadFirstSeen(b))[0];
  const discNext: NextUp | undefined = oldestLead && {
    title: [oldestLead.manufacturer, oldestLead.name].filter(Boolean).join(" "),
    detail: oldestLead.submitterCount > 1 ? `submitted by ${oldestLead.submitterCount} players` : `submitted by ${oldestLead.submissions[0]?.submittedByName || "a player"}`,
  };

  const queues: QueueMeta[] = [
    { key: "digest", count: digestCount, freshness: digestLastRun ? { type: "lastRun", ms: digestLastRun } : { type: "clear" }, newThisWeek: 0, newToday: 0, newSinceFriday: 0 },
    { key: "fulfillment", count: pendingFul.length, freshness: freshnessOf(fulTimes), nextUp: fulNext, ...arrivals(fulTimes, now) },
    { key: "removals", count: pendingRemovals.length, freshness: freshnessOf(removalTimes), nextUp: removalNext, ...arrivals(removalTimes, now) },
    { key: "adminRequests", count: pendingAdmin.length, freshness: freshnessOf(adminTimes), nextUp: adminNext, ...arrivals(adminTimes, now) },
    { key: "discSubmissions", count: discCount, freshness: freshnessOf(discTimes), nextUp: discNext, ...arrivals(discTimes, now) },
  ];
  // Trending Issues is tracked manually — it doesn't contribute to the nav badge / "open" total, and its
  // hub row has no count. The other queues still drive the badge.
  const actionable = queues.filter((q) => q.key !== "digest");
  const total = actionable.reduce((n, q) => n + q.count, 0);
  const sinceFriday = actionable.reduce((n, q) => n + q.newSinceFriday, 0);
  const oldestAll = oldestOf([...removalTimes, ...fulTimes, ...adminTimes, ...discTimes]);
  return { queues, total, sinceFriday, oldestMs: Number.isFinite(oldestAll) ? oldestAll : null };
}
