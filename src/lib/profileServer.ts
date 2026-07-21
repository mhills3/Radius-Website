import { cache } from "react";
import { fsDoc, fsGet } from "./firestoreRest";

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
      limit: 5,
    },
  };
  try {
    const r = await fetch(`${BASE}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), next: { revalidate: 3600 } });
    if (!r.ok) return null;
    const arr = await r.json();
    // A user can have MULTIPLE user docs sharing one username (cross-platform alias accounts —
    // see canonicalIds). Taking the first match at random can land on the alias doc that's
    // missing the photo/bio while the canonical doc has them. Prefer the doc that IS canonical
    // (no alias mapping pointing elsewhere), then backfill any missing fields from the twins.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = (arr as any[]).filter((e) => e.document).map((e) => fsDoc(e.document));
    if (!docs.length) return null;
    let best = docs[0];
    if (docs.length > 1) {
      const canonical = await Promise.all(docs.map(async (d) => {
        const m = await fsGet(`canonicalIds/${d.id}`);
        const target = (m?.canonicalId as string) || (d.id as string);
        return target === d.id;
      }));
      const idx = canonical.findIndex(Boolean);
      if (idx >= 0) best = docs[idx];
    }
    const pickPhoto = (d: Record<string, unknown>) => (typeof d.profileImageUrl === "string" && /^https?:\/\//.test(d.profileImageUrl) ? (d.profileImageUrl as string) : undefined);
    const photo = pickPhoto(best) ?? docs.map(pickPhoto).find(Boolean);
    const iqOf = (d: Record<string, unknown>) => (Number(d.gameIQ) > 0 ? Number(d.gameIQ) : Number(d.previousGameIQ) || 0);
    const iq = iqOf(best) || Math.max(0, ...docs.map(iqOf));
    const firstStr = (k: string) => ((best[k] as string)?.trim?.() || docs.map((d) => (d[k] as string)?.trim?.()).find(Boolean)) || undefined;
    return {
      id: best.id as string,
      name: (best.name as string) || "Player",
      username: (best.username as string) || username,
      photo,
      gameIQ: iq,
      hidden: docs.some((d) => d.hideWebProfile === true),
      bio: firstStr("bio"),
      homeCourseName: firstStr("homeCourseName"),
      homeCourseId: firstStr("homeCourseId"),
    };
  } catch {
    return null;
  }
});
