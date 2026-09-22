import { db } from "./firebase";
import { collection, doc, getCountFromServer, getDocs, query, updateDoc, where } from "firebase/firestore";

// Rows are written by the brandMentionSweep Cloud Function (Reddit OAuth +
// Google News RSS, 2-hourly). The browser only reads and flips triage status —
// rules allow staff-claim update of status/note only.
export interface BrandMention {
  id: string;
  source: string;        // reddit | news | …
  url: string;
  title?: string;
  snippet?: string;
  author?: string;
  venue?: string;        // r/discgolf, publication name, …
  createdAt?: number;    // when it was posted out there
  foundAt?: number;      // when our sweep found it
  confidence: "high" | "low";
  matchedTerm?: string;
  status: "new" | "seen" | "dismissed";
  note?: string;
}

/** Nav-badge count: HIGH-confidence mentions nobody has looked at. */
export async function getNewMentionCount(): Promise<number> {
  try {
    const c = await getCountFromServer(query(collection(db, "brandMentions"), where("status", "==", "new"), where("confidence", "==", "high")));
    return c.data().count;
  } catch { return 0; }
}

/** Everything the queue shows, newest-found first. */
export async function getBrandMentions(): Promise<BrandMention[]> {
  const snap = await getDocs(collection(db, "brandMentions"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<BrandMention, "id">) }))
    .sort((a, b) => (b.createdAt || b.foundAt || 0) - (a.createdAt || a.foundAt || 0));
}

export async function setMentionStatus(id: string, status: BrandMention["status"]): Promise<void> {
  await updateDoc(doc(db, "brandMentions", id), { status });
}
