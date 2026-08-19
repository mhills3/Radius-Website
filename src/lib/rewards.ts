import { db, functions } from "./firebase";
import { doc, getDoc, collection, addDoc, getDocs, getCountFromServer, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { resolveCanonicalId } from "./account";

export type Tier = "gear" | "bag";
// milestone → merch tier. builder-25 earns the gear bundle, builder-50 earns the tournament bag.
const MILESTONES: [string, Tier][] = [["builder-25", "gear"], ["builder-50", "bag"]];
export const TIER_LABEL: Record<Tier, string> = { gear: "Gear bundle", bag: "Tournament bag" };

export interface Claimable {
  canonicalId: string;
  courseCount: number;      // users/{cid}.courseRewards.lastCount
  tiers: Tier[];            // claimable now (awarded, not fulfilled, not already submitted)
  milestoneKeys: string[];
  alreadyPending: Tier[];   // earned but already submitted — awaiting shipment
}

/** Read what THIS signed-in user can claim, straight off their courseRewards + existing submissions.
 *  Entitlement is the gate — never trust a tier from the URL. */
export async function getClaimable(uid: string): Promise<Claimable> {
  const cid = await resolveCanonicalId(uid);
  const snap = await getDoc(doc(db, "users", cid));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cr = ((snap.exists() ? (snap.data() as any).courseRewards : null) || {}) as { awarded?: string[]; merchFulfilled?: string[]; lastCount?: number };
  const awarded = new Set(Array.isArray(cr.awarded) ? cr.awarded : []);
  const fulfilled = new Set(Array.isArray(cr.merchFulfilled) ? cr.merchFulfilled : []); // tiers already SHIPPED
  const courseCount = typeof cr.lastCount === "number" ? cr.lastCount : 0;

  // Exclude tiers already submitted (pending OR shipped) so a refresh/forward can't double-claim.
  const mine = await getDocs(query(collection(db, "rewardFulfillments"), where("userId", "==", cid))).catch(() => null);
  const submitted = new Set<string>();
  mine?.forEach((d) => { const t = d.data().tiers; if (Array.isArray(t)) t.forEach((x: string) => submitted.add(x)); });

  const tiers: Tier[] = [], milestoneKeys: string[] = [], alreadyPending: Tier[] = [];
  for (const [key, tier] of MILESTONES) {
    if (!awarded.has(key) || fulfilled.has(tier)) continue;
    if (submitted.has(tier)) { alreadyPending.push(tier); continue; }
    tiers.push(tier); milestoneKeys.push(key);
  }
  return { canonicalId: cid, courseCount, tiers, milestoneKeys, alreadyPending };
}

export interface FulfillmentInput {
  fullName: string; address1: string; address2?: string; city: string; region: string; postcode: string; country: string; phone: string;
  bagRequest?: string; bagLink?: string; notes?: string;
}
/** Write the claim to rewardFulfillments (status pending). One submission covers all claimable tiers. */
export async function submitFulfillment(claim: Claimable, input: FulfillmentInput): Promise<void> {
  const t = (s?: string) => (s || "").trim();
  await addDoc(collection(db, "rewardFulfillments"), {
    userId: claim.canonicalId,
    tiers: claim.tiers,
    milestoneKeys: claim.milestoneKeys,
    fullName: t(input.fullName), address1: t(input.address1), address2: t(input.address2),
    city: t(input.city), region: t(input.region), postcode: t(input.postcode), country: t(input.country), phone: t(input.phone),
    bagRequest: t(input.bagRequest), bagLink: t(input.bagLink), notes: t(input.notes),
    courseCount: claim.courseCount,
    status: "pending",
    submittedAt: Date.now(),
    platform: "web",
  });
}

// ---------- staff queue ----------
export interface Fulfillment extends FulfillmentInput {
  id: string;
  userId: string;
  tiers: Tier[];
  milestoneKeys?: string[];
  courseCount?: number;
  status: string;               // pending | shipped
  submittedAt?: number;
  shippedAt?: number; shippedBy?: string; tracking?: string; shipNote?: string;
}
export async function getFulfillments(): Promise<Fulfillment[]> {
  const snap = await getDocs(collection(db, "rewardFulfillments"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Fulfillment, "id">) }))
    .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
}
export async function getPendingFulfillmentCount(): Promise<number> {
  try {
    const c = await getCountFromServer(query(collection(db, "rewardFulfillments"), where("status", "==", "pending")));
    return c.data().count;
  } catch { return 0; }
}

export interface ShipResult { ok?: boolean; alreadyShipped?: boolean; error?: string }
/** THE ONLY way to mark shipped. Callable re-checks staff (Admin SDK), stamps who/when, and marks the
 *  tier fulfilled on the user so they're never asked again. Throws typed HttpsErrors on failure. */
export async function markFulfillmentShipped(fulfillmentId: string, tracking?: string, note?: string): Promise<ShipResult> {
  const fn = httpsCallable<{ fulfillmentId: string; tracking?: string; note?: string }, ShipResult>(functions, "markFulfillmentShipped");
  const res = await fn({ fulfillmentId, ...(tracking ? { tracking } : {}), ...(note ? { note } : {}) });
  return res.data ?? {};
}
