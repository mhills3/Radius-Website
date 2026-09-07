import { db } from "./firebase";
import { collection, getDocs, doc, updateDoc, addDoc } from "firebase/firestore";
import { getDiscCatalog, type DbDisc } from "./bag";

// Disc Submissions queue — every custom disc a signed-in non-guest user creates writes a
// `discSubmissions/{autoId}` doc (iOS from 2026-09-07 daaf741; Android mirrors). Staff triage them
// on /admin/disc-submissions: real catalog leads get approved (staged into `discCatalogQueue`),
// noise gets denied. The user's own custom disc is NEVER touched either way.
//
// Writes are DIRECT client writes: Stage-1 rules already let any signed-in user write, and this
// action isn't privileged (it only flips a triage status + stages a lead). The UI staff gate is the
// only gate — matching the spec. If this ever does anything privileged server-side, move it to a
// staff-checking callable like resolveCourseRemoval.

export interface DiscSubmission {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  speed: number;
  glide: number;
  turn: number;
  fade: number;
  submittedBy: string;
  submittedByName: string;
  platform: "ios" | "android" | string;
  status: "pending" | "approved" | "denied" | string;
  createdAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

// ---- Normalization (catalog-check parity with the apps' DiscSearch) ----
// Diacritic fold (from src/app/discs/page.tsx) + manufacturer noise-word/alias handling ported here
// (the alias map lives only in the apps otherwise): "Mint Discs" ≡ "Mint", "Millennium" ≡ "Millenium".
const fold = (x: string) => (x || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function canonName(s: string): string {
  return fold(s).replace(/[^a-z0-9]+/g, " ").trim();
}

const MFR_NOISE = new Set(["discs", "disc", "golf", "co", "company", "mfg", "manufacturing", "llc", "inc", "the", "brand"]);
const MFR_ALIAS: Record<string, string> = {
  millenium: "millennium",       // common misspelling ≡ Millennium
  dd: "dynamic",                 // "DD" ≡ Dynamic Discs
  ld: "latitude",                // "LD"/"Lat64" ≡ Latitude 64
  lat64: "latitude", lat: "latitude",
};
export function canonMfr(s: string): string {
  const toks = fold(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !MFR_NOISE.has(w))
    .map((w) => MFR_ALIAS[w] ?? w);
  return toks.join(" ").trim();
}

/** True when `a` and `b` are within a single edit (insert/delete/substitute). */
export function withinEdit1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else { i++; j++; }
  }
  if (i < la) edits += la - i;
  if (j < lb) edits += lb - j;
  return edits <= 1;
}

// ---- Catalog check ----
export type CatalogVerdict =
  | { kind: "exact"; disc: DbDisc }
  | { kind: "nameOtherMfr"; disc: DbDisc }
  | { kind: "fuzzy"; disc: DbDisc }
  | { kind: "none" };

export function catalogCheck(lead: { name: string; manufacturer: string }, catalog: DbDisc[]): CatalogVerdict {
  const ln = canonName(lead.name), lm = canonMfr(lead.manufacturer);
  let nameOther: DbDisc | null = null;
  let fuzzy: DbDisc | null = null;
  for (const d of catalog) {
    const dn = canonName(d.name);
    if (dn === ln) {
      if (canonMfr(d.manufacturer) === lm) return { kind: "exact", disc: d };
      if (!nameOther) nameOther = d;
    } else if (!fuzzy && ln.length >= 4 && withinEdit1(ln, dn)) {
      fuzzy = d;
    }
  }
  if (nameOther) return { kind: "nameOtherMfr", disc: nameOther };
  if (fuzzy) return { kind: "fuzzy", disc: fuzzy };
  return { kind: "none" };
}

/** A disc is LIVE on web once discs.json carries its folded name+manufacturer. */
export function isLiveOnWeb(lead: { name: string; manufacturer: string }, catalog: DbDisc[]): boolean {
  return catalogCheck(lead, catalog).kind === "exact";
}

// ---- Low-signal (junk) detection ----
// Names like "test"/single letters, or a default "Custom" manufacturer with untouched (all-zero)
// flight numbers, are noise — collapsed into a "Low signal" section, denyable in bulk (not deleted).
export function isLowSignal(s: { name: string; manufacturer: string; speed: number; glide: number; turn: number; fade: number }): boolean {
  const n = canonName(s.name);
  if (!n) return true;
  if (n.replace(/\s/g, "").length <= 1) return true;                 // single character
  if (/^(test|testing|tester|asdf|qwerty|a+|x+|z+)$/.test(n.replace(/\s/g, ""))) return true;
  const noFlight = !s.speed && !s.glide && !s.turn && !s.fade;
  const genericMfr = canonMfr(s.manufacturer) === "custom" || !canonMfr(s.manufacturer);
  if (genericMfr && noFlight) return true;
  return false;
}

// ---- Grouping into leads ----
// Three users submitting "Cloudbreaker" = ONE lead. Group by folded name+manufacturer; a submitter's
// own re-creates collapse to one (keep their latest flight numbers). Lead flight numbers + display
// come from the most-recent submission overall.
export interface DiscLead {
  key: string;
  name: string;
  manufacturer: string;
  category: string;
  speed: number; glide: number; turn: number; fade: number;
  submissions: DiscSubmission[]; // newest-first; the group's docs (for bulk resolve)
  submitterCount: number;        // distinct submittedBy
  platforms: string[];
  latestAt: number;
  lowSignal: boolean;
}

export function groupLeads(subs: DiscSubmission[]): DiscLead[] {
  const byKey = new Map<string, DiscSubmission[]>();
  for (const s of subs) {
    const key = `${canonName(s.name)}|${canonMfr(s.manufacturer)}`;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(s);
  }
  const leads: DiscLead[] = [];
  for (const [key, group] of byKey) {
    const sorted = [...group].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const rep = sorted[0];
    leads.push({
      key,
      name: rep.name,
      manufacturer: rep.manufacturer,
      category: rep.category,
      speed: rep.speed, glide: rep.glide, turn: rep.turn, fade: rep.fade,
      submissions: sorted,
      submitterCount: new Set(sorted.map((s) => s.submittedBy)).size,
      platforms: [...new Set(sorted.map((s) => s.platform))],
      latestAt: rep.createdAt || 0,
      lowSignal: isLowSignal(rep),
    });
  }
  return leads.sort((a, b) => b.latestAt - a.latestAt);
}

// ---- Read ----
export async function getDiscSubmissions(): Promise<DiscSubmission[]> {
  const snap = await getDocs(collection(db, "discSubmissions"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<DiscSubmission, "id">) }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Distinct pending leads (excludes low-signal noise) — the count for the hub tile + nav badge. */
export function pendingLeadCount(subs: DiscSubmission[]): number {
  const keys = new Set<string>();
  for (const s of subs) {
    if (s.status !== "pending") continue;
    if (isLowSignal(s)) continue;
    keys.add(`${canonName(s.name)}|${canonMfr(s.manufacturer)}`);
  }
  return keys.size;
}

// ---- Resolve (direct writes) ----
// Approving stages the lead into `discCatalogQueue` (the catalog-release staging list — it does NOT
// touch discs.json). Denying just flips status. Either way the submitters' custom discs are untouched.
export async function resolveLead(lead: DiscLead, decision: "approve" | "deny", staffUid: string): Promise<void> {
  const now = Date.now();
  const status = decision === "approve" ? "approved" : "denied";
  await Promise.all(
    lead.submissions.map((s) => updateDoc(doc(db, "discSubmissions", s.id), { status, reviewedBy: staffUid, reviewedAt: now })),
  );
  if (decision === "approve") {
    const rep = lead.submissions[0]; // newest — best flight numbers
    await addDoc(collection(db, "discCatalogQueue"), {
      name: rep.name,
      manufacturer: rep.manufacturer,
      category: rep.category,
      speed: rep.speed, glide: rep.glide, turn: rep.turn, fade: rep.fade,
      sourceSubmissionIds: lead.submissions.map((s) => s.id),
      submitterCount: lead.submitterCount,
      submittedByName: rep.submittedByName,
      approvedBy: staffUid,
      approvedAt: now,
      status: "staged",
    });
  }
}

export async function getDiscCatalogSafe(): Promise<DbDisc[]> {
  try { return await getDiscCatalog(); } catch { return []; }
}
