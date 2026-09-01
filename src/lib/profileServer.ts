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
  radiusRating?: number;          // iOS-mirrored Radius Rating (authoritative)
  radiusRatingProvisional?: boolean;
  hidden: boolean;
  bio?: string;
  homeCourseName?: string;
  homeCourseId?: string;
}

// Some accounts never wrote profileImageUrl onto their user doc, but their posts
// carry the denormalized photo — use the newest one as a display fallback.
async function latestPostPhoto(authorId: string): Promise<string | undefined> {
  try {
    const body = {
      structuredQuery: {
        from: [{ collectionId: "posts" }],
        where: { fieldFilter: { field: { fieldPath: "authorId" }, op: "EQUAL", value: { stringValue: authorId } } },
        select: { fields: [{ fieldPath: "authorPhotoUrl" }] },
        limit: 10,
      },
    };
    const r = await fetch(`${BASE}:runQuery?key=${KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), next: { revalidate: 3600 } });
    if (!r.ok) return undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const urls = ((await r.json()) as any[]).map((e) => e.document?.fields?.authorPhotoUrl?.stringValue).filter((u) => typeof u === "string" && /^https?:\/\//.test(u));
    return urls[0];
  } catch { return undefined; }
}

export const getUserByUsername = cache(async (username: string, preferredId?: string): Promise<ProfileIdentity | null> => {
  const body = {
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: { fieldFilter: { field: { fieldPath: "username" }, op: "EQUAL", value: { stringValue: username } } },
      select: { fields: ["name", "username", "profileImageUrl", "gameIQ", "previousGameIQ", "radiusRating", "radiusRatingProvisional", "hideWebProfile", "bio", "homeCourseName", "homeCourseId"].map((f) => ({ fieldPath: f })) },
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
    let docs = (arr as any[]).filter((e) => e.document).map((e) => fsDoc(e.document));
    if (!docs.length) return null;
    // Follow canonicalIds for EVERY match — the username often lives only on an
    // alias doc while the canonical doc holds the photo, stats, and rounds. When
    // a match aliases elsewhere, fetch the canonical doc and merge it in (its id
    // becomes the profile id so rounds/achievements load from the right place).
    const resolved = await Promise.all(docs.map(async (d) => {
      const m = await fsGet(`canonicalIds/${d.id}`);
      const target = (m?.canonicalId as string) || (d.id as string);
      if (target === d.id) return { doc: d, canonical: true };
      const cdoc = await fsGet(`users/${target}`);
      if (!cdoc) return { doc: d, canonical: false };
      const filled = Object.fromEntries(Object.entries(cdoc).filter(([, v]) => v != null && v !== ""));
      return { doc: { ...d, ...filled, id: target }, canonical: true };
    }));
    docs = resolved.map((r) => r.doc);
    // Usernames are not unique in the wild (several distinct accounts can hold the
    // same handle). When a link tells us WHICH account it meant (?id=), honor it.
    const preferred = preferredId ? resolved.find((r) => r.doc.id === preferredId) : undefined;
    const best = (preferred ?? resolved.find((r) => r.canonical) ?? resolved[0]).doc;
    // Never mix data across DISTINCT people sharing a handle — restrict the
    // backfill pool to docs that resolved to the same account id.
    docs = docs.filter((d) => d.id === best.id);
    const pickPhoto = (d: Record<string, unknown>) => (typeof d.profileImageUrl === "string" && /^https?:\/\//.test(d.profileImageUrl) ? (d.profileImageUrl as string) : undefined);
    let photo = pickPhoto(best) ?? docs.map(pickPhoto).find(Boolean);
    if (!photo) photo = await latestPostPhoto(best.id as string);
    const iqOf = (d: Record<string, unknown>) => (Number(d.gameIQ) > 0 ? Number(d.gameIQ) : Number(d.previousGameIQ) || 0);
    const iq = iqOf(best) || Math.max(0, ...docs.map(iqOf));
    // Radius Rating (authoritative, iOS-mirrored) — highest across alias docs, with its own provisional flag.
    const ratingOf = (d: Record<string, unknown>) => (Number(d.radiusRating) > 0 ? Number(d.radiusRating) : 0);
    const ratingDoc = [best, ...docs].reduce((a, b) => (ratingOf(b) > ratingOf(a) ? b : a), best);
    const radiusRating = ratingOf(ratingDoc) || undefined;
    const firstStr = (k: string) => ((best[k] as string)?.trim?.() || docs.map((d) => (d[k] as string)?.trim?.()).find(Boolean)) || undefined;
    return {
      id: best.id as string,
      name: (best.name as string) || "Player",
      username: (best.username as string) || username,
      photo,
      gameIQ: iq,
      radiusRating,
      radiusRatingProvisional: radiusRating ? ratingDoc.radiusRatingProvisional === true : undefined,
      hidden: docs.some((d) => d.hideWebProfile === true),
      bio: firstStr("bio"),
      homeCourseName: firstStr("homeCourseName"),
      homeCourseId: firstStr("homeCourseId"),
    };
  } catch {
    return null;
  }
});
