import { db, functions } from "./firebase";
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

// Written by the daily `communityDigest` scheduled function. One doc per day (id = YYYY-MM-DD),
// history preserved. Every item carries the Discord message link(s) so staff can jump to the thread.
export type DigestPlatform = "iOS" | "Android" | "web" | "unknown";
export type DigestPriority = "high" | "medium" | "low";
export interface DigestItem {
  id: string;
  description: string;
  count: number;            // distinct reporters/requesters across sources (server-computed)
  links: string[];          // Discord message and/or Gmail thread links
  sources?: string[];       // "discord" and/or "email"
  reviewed: boolean;
  platform?: DigestPlatform; // bugs only
  priority?: DigestPriority; // bugs + features
  theme?: string;            // bugs + features — short area label for grouping
  prompt?: string;           // bugs only — ready-to-paste coding-agent task
  kind?: "praise" | "churn_risk"; // notable only
}
export interface DigestCategories {
  bugs: DigestItem[];
  features: DigestItem[];
  questions: DigestItem[];
  notable: DigestItem[];
}
export interface IgnoredItem { description: string; reason: string }
export interface Digest {
  date: string;             // YYYY-MM-DD (doc id)
  createdAt?: unknown;
  rangeStartMs?: number;
  rangeEndMs?: number;
  channelsScanned?: number;
  mailboxesScanned?: number;
  messageCount?: number;
  categories: DigestCategories;
  ignored?: IgnoredItem[];
  ignoredCount?: number;
  itemCount?: number;
  reviewedCount?: number;
}

const emptyCats = (): DigestCategories => ({ bugs: [], features: [], questions: [], notable: [] });
const allItems = (d: Digest): DigestItem[] => [...d.categories.bugs, ...d.categories.features, ...d.categories.questions, ...d.categories.notable];

/** Dates that have a digest, newest first — drives the date pager. */
export async function listDigestDates(max = 60): Promise<string[]> {
  try {
    const snap = await getDocs(query(collection(db, "communityDigests"), orderBy("date", "desc"), limit(max)));
    return snap.docs.map((d) => d.id);
  } catch { return []; }
}

export async function getDigest(date: string): Promise<Digest | null> {
  const snap = await getDoc(doc(db, "communityDigests", date));
  if (!snap.exists()) return null;
  const d = snap.data() as Partial<Digest>;
  return { ...d, date: snap.id, categories: { ...emptyCats(), ...(d.categories || {}) } };
}

export async function getLatestDigest(): Promise<Digest | null> {
  const dates = await listDigestDates(1);
  if (dates.length === 0) return null;
  return getDigest(dates[0]);
}

/** Every digest whose day falls in [startMs, endMs) — powers the weekly Trending Issues view. */
export async function getDigestsInRange(startMs: number, endMs: number): Promise<Digest[]> {
  const dates = await listDigestDates(180);
  const inRange = dates.filter((d) => {
    const t = Date.parse(`${d}T12:00:00`);
    return t >= startMs && t < endMs;
  });
  const digs = await Promise.all(inRange.map((d) => getDigest(d)));
  return digs.filter((d): d is Digest => !!d);
}

/** Unreviewed items in the latest digest — the /admin card badge + the nav badge. */
export async function getUnreviewedDigestCount(): Promise<number> {
  const latest = await getLatestDigest();
  if (!latest) return 0;
  return allItems(latest).filter((it) => !it.reviewed).length;
}

export interface ReviewResult { ok?: boolean; reviewedCount?: number; error?: string }
/** Mark an item reviewed/unreviewed. Staff-gated callable (re-checks staff, recomputes count). */
export async function markDigestItemReviewed(date: string, itemId: string, reviewed: boolean): Promise<ReviewResult> {
  const fn = httpsCallable<{ date: string; itemId: string; reviewed: boolean }, ReviewResult>(functions, "markDigestItemReviewed");
  const res = await fn({ date, itemId, reviewed });
  return res.data ?? {};
}

/** Bulk mark many items in one transaction — staff-gated, recomputes count once. */
export async function markDigestItemsReviewed(date: string, itemIds: string[], reviewed: boolean): Promise<ReviewResult & { updated?: number }> {
  const fn = httpsCallable<{ date: string; itemIds: string[]; reviewed: boolean }, ReviewResult & { updated?: number }>(functions, "markDigestItemsReviewed");
  const res = await fn({ date, itemIds, reviewed });
  return res.data ?? {};
}
