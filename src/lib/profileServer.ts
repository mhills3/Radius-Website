import { cache } from "react";
import { fsDoc } from "./firestoreRest";

const PROJECT = "radius-dg";
const KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

export interface ProfileIdentity {
  id: string;
  name: string;
  username: string;
  photo?: string;
  gameIQ: number;
  hidden: boolean;
  bio?: string;
  homeCourseName?: string;
  homeCourseId?: string;
}

export const getUserByUsername = cache(async (username: string): Promise<ProfileIdentity | null> => {
  const body = {
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: { fieldFilter: { field: { fieldPath: "username" }, op: "EQUAL", value: { stringValue: username } } },
      select: { fields: ["name", "username", "profileImageUrl", "gameIQ", "previousGameIQ", "hideWebProfile", "bio", "homeCourseName", "homeCourseId"].map((f) => ({ fieldPath: f })) },
      limit: 1,
    },
  };
  try {
    const r = await fetch(`${BASE}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const arr = await r.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hit = (arr as any[]).find((e) => e.document);
    if (!hit) return null;
    const d = fsDoc(hit.document);
    const iq = Number(d.gameIQ) > 0 ? Number(d.gameIQ) : Number(d.previousGameIQ) || 0;
    const photo = typeof d.profileImageUrl === "string" && /^https?:\/\//.test(d.profileImageUrl as string) ? (d.profileImageUrl as string) : undefined;
    return { id: d.id as string, name: (d.name as string) || "Player", username: (d.username as string) || username, photo, gameIQ: iq, hidden: d.hideWebProfile === true, bio: (d.bio as string) || undefined, homeCourseName: (d.homeCourseName as string)?.trim() || undefined, homeCourseId: (d.homeCourseId as string)?.trim() || undefined };
  } catch {
    return null;
  }
});
