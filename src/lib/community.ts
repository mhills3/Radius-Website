import { db } from "./firebase";
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, increment, query, orderBy, limit } from "firebase/firestore";
import { rankForIQ } from "./rank";
import { getProfileLite } from "./account";

function uuid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const SKILL_LEVELS = [
  { key: "ALL_LEVELS", label: "All levels" },
  { key: "BEGINNER", label: "Beginner" },
  { key: "INTERMEDIATE", label: "Intermediate" },
  { key: "ADVANCED", label: "Advanced" },
];

function safeHttp(u: unknown): string | undefined {
  return typeof u === "string" && /^https?:\/\//.test(u) ? u : undefined;
}
function ms(v: unknown): number {
  const n = typeof v === "number" ? v : 0;
  if (n > 1e12) return n;
  if (n > 1e9) return n * 1000;
  if (n > 1e7) return (n + 978307200) * 1000;
  return 0;
}

// ---- Forum categories ----
export const FORUM_CATEGORIES = ["All", "General", "Disc Advice", "Course Talk", "Form Check", "Tournament", "Deals & Trade", "Memes", "Rules Q&A"];
const CAT_COLORS: Record<string, string> = {
  "Disc Advice": "#8b5cf6",
  "Course Talk": "#5fb87a",
  "Form Check": "#3b82f6",
  Tournament: "#F6C165",
  "Deals & Trade": "#ea8b3a",
  Memes: "#ec4899",
  "Rules Q&A": "#10b981",
  General: "#9aa6b2",
};
export function categoryColor(c: string): string {
  return CAT_COLORS[c] ?? "#9aa6b2";
}

// ---- Threads ----
export interface Thread {
  id: string;
  title: string;
  preview: string;
  body: string;
  imageUrl?: string;
  linkedCourseName?: string;
  scoreToPar?: number | null;
  category: string;
  authorName: string;
  authorHandle?: string;
  authorPhotoUrl?: string;
  authorId?: string;
  score: number;
  replyCount: number;
  viewCount: number;
  createdAt: number;
}
export async function getThreads(max = 50): Promise<Thread[]> {
  try {
    const snap = await getDocs(query(collection(db, "threads"), orderBy("createdAt", "desc"), limit(max)));
    return snap.docs
      .map((d) => {
        const t = d.data();
        return {
          id: (t.id ?? d.id) as string,
          title: (t.title ?? "") as string,
          preview: (t.preview ?? t.body ?? "") as string,
          body: (t.body ?? t.preview ?? "") as string,
          imageUrl: safeHttp(t.imageUrl),
          linkedCourseName: (t.linkedCourseName as string) || undefined,
          scoreToPar: typeof t.linkedScoreToPar === "number" ? t.linkedScoreToPar : null,
          category: (t.category ?? "General") as string,
          authorName: (t.authorName ?? "Radius player") as string,
          authorHandle: (t.authorHandle as string | undefined)?.replace(/^@/, ""),
          authorPhotoUrl: safeHttp(t.authorPhotoUrl),
          authorId: (t.createdById ?? t.authorId) as string | undefined,
          score: (Number(t.upvotes) || 0) - (Number(t.downvotes) || 0),
          replyCount: Number(t.replyCount) || 0,
          viewCount: Number(t.viewCount) || 0,
          createdAt: ms(t.createdAt ?? t.date),
        };
      })
      .filter((t) => t.title.trim());
  } catch {
    return [];
  }
}

/** Create a forum thread (exact threadToMap shape; createdById = canonical). */
export async function createThread(uid: string, input: { title: string; body: string; category: string }): Promise<Thread | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const id = uuid();
  const now = Date.now();
  await setDoc(doc(db, "threads", id), {
    id, category: input.category, title: input.title, body: input.body,
    authorName: profile.name, authorHandle: profile.username,
    authorId: profile.canonicalId, authorPhotoUrl: profile.profileImageUrl ?? null,
    createdById: profile.canonicalId,
    upvotes: 0, downvotes: 0, replyCount: 0, viewCount: 0, createdAt: now,
    imageUrl: null, linkURL: null, linkedRoundId: null, linkedCourseName: null, linkedScoreToPar: null, linkedHolesPlayed: null,
  });
  return {
    id, title: input.title, preview: input.body, body: input.body, category: input.category,
    authorName: profile.name, authorHandle: profile.username, authorPhotoUrl: profile.profileImageUrl, authorId: profile.canonicalId,
    score: 0, replyCount: 0, viewCount: 0, createdAt: now,
  };
}

/** Reply to a thread (replyToMap shape) + bump replyCount. */
export async function addReply(uid: string, threadId: string, text: string): Promise<Reply | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const id = uuid();
  const now = Date.now();
  await setDoc(doc(db, "threads", threadId, "replies", id), {
    id, threadId, parentReplyId: null,
    authorName: profile.name, authorHandle: profile.username,
    authorId: profile.canonicalId, authorPhotoUrl: profile.profileImageUrl ?? null,
    createdById: profile.canonicalId, text, upvotes: 0, createdAt: now,
  });
  await updateDoc(doc(db, "threads", threadId), { replyCount: increment(1) });
  return { id, authorName: profile.name, authorHandle: profile.username, authorPhotoUrl: profile.profileImageUrl, text, createdAt: now };
}

export interface Reply {
  id: string;
  authorName: string;
  authorHandle?: string;
  authorPhotoUrl?: string;
  text: string;
  createdAt: number;
}
export async function getThreadReplies(threadId: string): Promise<Reply[]> {
  try {
    const snap = await getDocs(query(collection(db, "threads", threadId, "replies"), limit(100)));
    return snap.docs
      .map((d) => {
        const r = d.data();
        return {
          id: (r.id ?? d.id) as string,
          authorName: (r.authorName ?? "Radius player") as string,
          authorHandle: (r.authorHandle as string | undefined)?.replace(/^@/, ""),
          authorPhotoUrl: safeHttp(r.authorPhotoUrl),
          text: (r.text ?? r.body ?? "") as string,
          createdAt: ms(r.createdAt ?? r.date),
        };
      })
      .filter((r) => r.text.trim())
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

// ---- Meetups ----
export interface Meetup {
  id: string;
  courseName: string;
  hostName: string;
  hostPhotoUrl?: string;
  description: string;
  skillLevel: string;
  maxPlayers: number;
  playerCount: number;
  playerNames: string[];
  dateMillis: number;
  timeLabel?: string;
  distanceMiles?: number;
}
export async function getMeetups(max = 30): Promise<Meetup[]> {
  try {
    const snap = await getDocs(query(collection(db, "meetups"), limit(max)));
    return snap.docs
      .map((d) => {
        const m = d.data();
        const names = Array.isArray(m.playerNames) ? m.playerNames : typeof m.playerNamesCsv === "string" ? m.playerNamesCsv.split(",").filter(Boolean) : [];
        return {
          id: (m.id ?? d.id) as string,
          courseName: (m.courseName ?? "TBD") as string,
          hostName: (m.hostName ?? m.organizerName ?? "Host") as string,
          hostPhotoUrl: safeHttp(m.hostPhotoUrl),
          description: (m.description ?? "") as string,
          skillLevel: ((m.skillLevel ?? "ALL_LEVELS") as string).replace(/_/g, " ").toLowerCase(),
          maxPlayers: Number(m.maxPlayers) || 0,
          playerCount: Number(m.playerCount) || names.length || 0,
          playerNames: names,
          dateMillis: ms(m.dateMillis ?? m.date),
          timeLabel: (m.timeLabel ?? m.time) as string | undefined,
          distanceMiles: typeof m.distanceMiles === "number" ? m.distanceMiles : undefined,
        };
      })
      .sort((a, b) => b.dateMillis - a.dateMillis); // most recent first, oldest at the bottom
  } catch {
    return [];
  }
}

/** Host a meetup (matches the live meetups doc shape). */
export async function createMeetup(uid: string, input: { courseName: string; description: string; skillLevel: string; maxPlayers: number; dateMillis: number; timeLabel: string }): Promise<Meetup | null> {
  const profile = await getProfileLite(uid);
  if (!profile) return null;
  const id = uuid();
  const now = Date.now();
  await setDoc(doc(db, "meetups", id), {
    id, meetupId: id, courseName: input.courseName, description: input.description || "",
    skillLevel: input.skillLevel || "ALL_LEVELS", maxPlayers: input.maxPlayers || 4,
    hostName: profile.name, hostId: uid, hostPhotoUrl: profile.profileImageUrl ?? null,
    organizerName: profile.name, organizerId: uid, createdById: profile.canonicalId,
    dateMillis: input.dateMillis || now, date: input.dateMillis || now, timeLabel: input.timeLabel || "", time: input.timeLabel || "",
    playerCount: 1, playerNames: [profile.name], playerNamesCsv: profile.name,
    playerIds: [uid], playerUidsCsv: uid, distanceMiles: 0, createdAt: now, lastModified: now,
  });
  return {
    id, courseName: input.courseName, hostName: profile.name, hostPhotoUrl: profile.profileImageUrl,
    description: input.description || "", skillLevel: (input.skillLevel || "ALL_LEVELS").replace(/_/g, " ").toLowerCase(),
    maxPlayers: input.maxPlayers || 4, playerCount: 1, playerNames: [profile.name],
    dateMillis: input.dateMillis || now, timeLabel: input.timeLabel || undefined, distanceMiles: 0,
  };
}

// ---- Author ranks (the disc-golf identity layer) ----
export interface RankInfo {
  tier: string;
  color: string;
  level: number;
  iq: number;
  name?: string;
  photo?: string;
  username?: string;
}
export async function getRanksFor(ids: string[]): Promise<Map<string, RankInfo>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 60);
  const out = new Map<string, RankInfo>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const s = await getDoc(doc(db, "users", id));
        if (!s.exists()) return;
        const u = s.data();
        const iq = typeof u.gameIQ === "number" && u.gameIQ > 0 ? u.gameIQ : u.previousGameIQ ?? 0;
        if (!iq) return;
        const r = rankForIQ(iq);
        out.set(id, { tier: r.tier, color: r.color, level: r.level, iq, name: u.name as string | undefined, photo: safeHttp(u.profileImageUrl), username: (u.username as string) || undefined });
      } catch {
        /* skip */
      }
    })
  );
  return out;
}
