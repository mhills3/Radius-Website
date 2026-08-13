import { db } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { getDecodedRoundsForCanonical, countAces, normEpoch, type RoundMeta } from "./rounds";

/** User image URLs can be arbitrary/invalid (content:// etc.) — keep only real http(s) URLs. */
function safeHttp(u: unknown): string | undefined {
  return typeof u === "string" && /^https?:\/\//.test(u) ? u : undefined;
}

/**
 * Coerce a Firestore expiry value to epoch milliseconds. Comps write `proOverrideExpires` as a native
 * Firestore Timestamp; store subs write `proExpires` as ms. Handles: number (already ms → as-is),
 * Timestamp instance (`.toMillis()`), serialized `{seconds,nanoseconds}` / `{_seconds,_nanoseconds}`
 * (REST/serialized reads → seconds*1000 + round(nanos/1e6)), ISO string, and Date. Else → undefined.
 */
function toEpochMillis(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (v instanceof Date) { const t = v.getTime(); return Number.isFinite(t) ? t : undefined; }
  if (typeof v === "object") {
    const o = v as { toMillis?: () => number; seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number };
    if (typeof o.toMillis === "function") { const t = o.toMillis(); return Number.isFinite(t) ? t : undefined; }
    const secs = typeof o.seconds === "number" ? o.seconds : typeof o._seconds === "number" ? o._seconds : undefined;
    if (secs != null) {
      const nanos = typeof o.nanoseconds === "number" ? o.nanoseconds : typeof o._nanoseconds === "number" ? o._nanoseconds : 0;
      return secs * 1000 + Math.round(nanos / 1e6);
    }
    return undefined;
  }
  if (typeof v === "string") { const t = Date.parse(v); return Number.isFinite(t) ? t : undefined; }
  return undefined;
}

function b64ToUtf8(b64: string): string {
  if (typeof atob !== "undefined") {
    const bin = atob(b64);
    return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }
  return Buffer.from(b64, "base64").toString("utf8");
}

// Firestore fields may be a native array/object OR a JSON string OR a base64-JSON string.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { const a = JSON.parse(v); if (Array.isArray(a)) return a; } catch {}
    try { const a = JSON.parse(b64ToUtf8(v)); if (Array.isArray(a)) return a; } catch {}
  }
  return [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asObject(v: unknown): Record<string, any> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try { const o = JSON.parse(v); if (o && typeof o === "object") return o; } catch {}
  }
  return {};
}

export interface Profile {
  canonicalId: string;
  name: string;
  username: string;
  email?: string;
  bio?: string;
  profileImageUrl?: string;
  coverPhotoUrl?: string;
  previousGameIQ?: number;
  roundsPlayed?: number;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  maxDistance?: number;
  homeCourseName?: string;
  throwingHand?: string;
  throwingStyle?: string;
  armSpeed?: string;
  proOverride?: boolean;
  proOverrideExpires?: number;
  isPro?: boolean;
  proExpires?: number;
}

export interface RoundSummary {
  roundId: string;
  courseName: string;
  date: number;
  holesPlayed?: number;
  scoreToPar?: number | null;
}

export interface IQPoint {
  t: number;
  iq: number;
}

export interface BagDisc {
  name: string;
  hot: boolean;
}

export interface Dashboard {
  profile: Profile;
  iqCurrent: number;
  iqHistory: IQPoint[];
  rounds: RoundSummary[];
  topDiscs: { name: string; count: number }[];
  bag: BagDisc[];
  roundMetas: RoundMeta[];
  acesCount: number;
}

export interface ProfileLite {
  canonicalId: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  coverPhotoUrl?: string;
  writer?: boolean;
  homeCourseName?: string;
  isPro?: boolean;
  proExpires?: number;
  proOverride?: boolean;
  proOverrideExpires?: number;
}

/**
 * Pro entitlement on the web. We can read two signals from the user doc:
 *  - isPro / proExpires      — the REAL App Store / Play subscription, mirrored to Firestore by the
 *                              apps (StoreKit/Play receipts never reach the web directly).
 *  - proOverride / *Expires  — a manual comp granted from the console.
 * Store subs are lenient on a missing expiry (treat as active) so a real paying subscriber is NEVER
 * locked out of the web if the app hasn't written a fresh expiry — over-granting is the safe failure.
 * Comps are strict (match iOS): a comp needs a parseable FUTURE expiry to count — comps are always
 * 1-year, never lifetime, so a missing/past expiry means expired. Expiry values are normalized to
 * epoch ms by toEpochMillis() at the mapping sites (comps arrive as Firestore Timestamps).
 * NOTE: client-side reads are public, so this is a UX paywall, not a security boundary.
 */
export interface ProEntitlement {
  isPro?: boolean;
  proExpires?: number;
  proOverride?: boolean;
  proOverrideExpires?: number;
}
export function isProEntitled(p?: ProEntitlement | null): boolean {
  if (!p) return false;
  const now = Date.now();
  const real = p.isPro === true && (p.proExpires == null || p.proExpires > now);
  const comp = p.proOverride === true && p.proOverrideExpires != null && p.proOverrideExpires > now;
  return real || comp;
}

export async function resolveCanonicalId(uid: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, "canonicalIds", uid));
    if (snap.exists() && snap.data().canonicalId) return snap.data().canonicalId as string;
  } catch {
    /* fall through */
  }
  return uid;
}

/**
 * Like resolveCanonicalId, but THROWS if the mapping cannot be read. Returns the
 * uid only when the mapping doc definitively does not exist (uid IS canonical).
 * Every WRITE that targets userBackups/{canonicalId} must use this variant: the
 * lenient fallback is fine for reads, but writing under an unresolved uid forks
 * the user's data onto the alias doc — an edit the apps never see.
 */
export async function resolveCanonicalIdStrict(uid: string): Promise<string> {
  const snap = await getDoc(doc(db, "canonicalIds", uid)); // throws on failure — caller surfaces the error
  if (snap.exists() && snap.data().canonicalId) return snap.data().canonicalId as string;
  return uid;
}

/**
 * The full set of ids that belong to this user — raw auth uid, canonical id, and the user doc's
 * legacy/user id fields. Mirrors the apps' `ownedIds` so edit-ownership checks accept legacy
 * createdById values, not just the canonical id.
 */
export async function getOwnedIds(uid: string): Promise<Set<string>> {
  const ids = new Set<string>([uid]);
  try {
    const canon = await resolveCanonicalId(uid);
    ids.add(canon);
    const snap = await getDoc(doc(db, "users", canon));
    if (snap.exists()) {
      const u = snap.data();
      for (const k of ["legacyUserId", "userId", "uid"]) {
        const v = u[k];
        if (typeof v === "string" && v) ids.add(v);
      }
    }
  } catch {
    /* best effort */
  }
  return ids;
}

/** Write the signed-in user's profile cover photo URL to their user doc (canonical id). */
export async function setProfileCover(uid: string, coverPhotoUrl: string): Promise<void> {
  const cid = await resolveCanonicalIdStrict(uid);
  await setDoc(doc(db, "users", cid), { coverPhotoUrl }, { merge: true });
}

export async function getProfileLite(uid: string): Promise<ProfileLite | null> {
  const canonicalId = await resolveCanonicalId(uid);
  try {
    const snap = await getDoc(doc(db, "users", canonicalId));
    if (!snap.exists()) return null;
    const u = snap.data();
    return {
      canonicalId, name: u.name ?? "", username: u.username ?? "", profileImageUrl: safeHttp(u.profileImageUrl), coverPhotoUrl: safeHttp(u.coverPhotoUrl),
      writer: u.writer === true || u.role === "writer", homeCourseName: (u.homeCourseName as string) || undefined,
      isPro: u.isPro === true, proExpires: toEpochMillis(u.proExpires),
      proOverride: u.proOverride === true, proOverrideExpires: toEpochMillis(u.proOverrideExpires),
    };
  } catch {
    return null;
  }
}

/** iOS stores rounds as base64 → raw-DEFLATE (no zlib header) → JSON. Decode in-browser. */
async function inflateRoundBlob(b64: string, compressed: boolean): Promise<string | null> {
  try {
    const bin = b64ToUtf8(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (!compressed) return new TextDecoder().decode(bytes);
    if (typeof DecompressionStream === "undefined") return null;
    for (const fmt of ["deflate-raw", "deflate"]) {
      try {
        const ds = new DecompressionStream(fmt as "deflate-raw" | "deflate");
        const stream = new Blob([bytes]).stream().pipeThrough(ds);
        return await new Response(stream).text();
      } catch {
        /* next */
      }
    }
    return null;
  } catch {
    return null;
  }
}

function relativeToParFromRound(json: string): number | null {
  try {
    const j = JSON.parse(json);
    const holes = Array.isArray(j.holes) ? j.holes : [];
    let rel = 0;
    let played = 0;
    for (const h of holes) {
      const tlogs = Array.isArray(h?.throwLogs) ? h.throwLogs : [];
      if (tlogs.length === 0) continue;
      const ob = tlogs.filter((t: { result?: string }) => t?.result === "OB").length;
      rel += tlogs.length + ob - (typeof h?.par === "number" ? h.par : 3);
      played++;
    }
    return played > 0 ? rel : null;
  } catch {
    return null;
  }
}

async function roundsFromSubcollection(canonicalId: string): Promise<RoundSummary[]> {
  try {
    const rs = await getDocs(collection(db, `userBackups/${canonicalId}/rounds`));
    const raw = rs.docs
      .map((d) => {
        const r = d.data();
        return {
          roundId: (r.roundId ?? d.id) as string,
          courseName: (r.courseName ?? "Unknown course") as string,
          date: (r.date ?? r.lastUpdated ?? 0) as number,
          blob: r.roundDataBase64 as string | undefined,
          compressed: (r.isCompressed ?? true) as boolean,
        };
      })
      .sort((a, b) => b.date - a.date)
      .slice(0, 8);
    return await Promise.all(
      raw.map(async (r) => {
        let scoreToPar: number | null = null;
        if (r.blob) {
          const json = await inflateRoundBlob(r.blob, r.compressed);
          if (json) scoreToPar = relativeToParFromRound(json);
        }
        return { roundId: r.roundId, courseName: r.courseName, date: r.date, scoreToPar };
      })
    );
  } catch {
    return [];
  }
}

export async function getDashboard(uid: string): Promise<Dashboard | null> {
  const canonicalId = await resolveCanonicalId(uid);

  const [userSnap, decodedRounds] = await Promise.all([
    getDoc(doc(db, "users", canonicalId)),
    getDecodedRoundsForCanonical(canonicalId),
  ]);
  if (!userSnap.exists()) return null;
  const u = userSnap.data();
  // The app writes the authoritative relativeToPar to `recentRounds`. Our recompute from throw logs
  // can disagree when an OB penalty is encoded ambiguously — e.g. a throw tagged result:"OB" PLUS a
  // manual "Score" placeholder stroke for the same penalty, which the recompute counts twice (turning
  // a real -1 into E). Prefer the app's value by round id; the recompute stays as the fallback for
  // older rounds not in the capped recentRounds list.
  const appRelById = new Map<string, number>();
  for (const r of asArray(u.recentRounds)) {
    const id = typeof r?.id === "string" ? r.id : "";
    if (id && typeof r?.relativeToPar === "number") appRelById.set(id, r.relativeToPar);
  }
  // Prefer the full iOS-style userBackups subcollection; fall back to the denormalized recentRounds
  // field that Android writes to the user doc (so cross-platform users still get rounds/stats/heatmap).
  let roundMetas: RoundMeta[] = decodedRounds.map((r) => ({ roundId: r.roundId, date: r.date, courseName: r.courseName, scoreToPar: (r.roundId && appRelById.has(r.roundId)) ? appRelById.get(r.roundId)! : r.relativeToPar, holesPlayed: r.holesPlayed }));
  if (roundMetas.length === 0) {
    roundMetas = asArray(u.recentRounds)
      .map((r) => ({
        roundId: (r?.id as string) || undefined,
        date: normEpoch(r?.dateMillis ?? r?.date, 0),
        courseName: (r?.courseName as string) || "Unknown course",
        scoreToPar: typeof r?.relativeToPar === "number" ? r.relativeToPar : null,
        holesPlayed: typeof r?.holesPlayed === "number" ? r.holesPlayed : undefined,
      }))
      .filter((m) => m.date > 0)
      .sort((a, b) => b.date - a.date);
  }
  const acesCount = countAces(decodedRounds);

  const profile: Profile = {
    canonicalId,
    name: u.name ?? "",
    username: u.username ?? "",
    email: u.email,
    bio: u.bio,
    profileImageUrl: safeHttp(u.profileImageUrl),
    coverPhotoUrl: safeHttp(u.coverPhotoUrl),
    previousGameIQ: u.previousGameIQ,
    roundsPlayed: u.roundsPlayed,
    followerCount: u.followerCount,
    followingCount: u.followingCount,
    postCount: u.postCount,
    maxDistance: typeof u.maxDistance === "number" && u.maxDistance > 0 ? u.maxDistance : u.maxDistanceFt || undefined,
    homeCourseName: u.homeCourseName,
    throwingHand: u.throwingHand,
    throwingStyle: u.throwingStyle,
    armSpeed: u.armSpeed,
    proOverride: u.proOverride,
    proOverrideExpires: toEpochMillis(u.proOverrideExpires),
    isPro: u.isPro === true,
    proExpires: toEpochMillis(u.proExpires),
  };

  const iqCurrent = typeof u.gameIQ === "number" && u.gameIQ > 0 ? u.gameIQ : u.previousGameIQ ?? 0;

  // IQ history → dedupe by timestamp, keep iq>0, sort ascending.
  const histMap = new Map<number, number>();
  for (const e of asArray(u.gameIQHistory)) {
    const iq = typeof e?.iq === "number" ? e.iq : 0;
    const t = typeof e?.recordedAt === "number" ? e.recordedAt : typeof e?.date === "string" ? Date.parse(e.date) : 0;
    if (iq > 0 && t > 0) histMap.set(t, iq);
  }
  const iqHistory: IQPoint[] = [...histMap.entries()].map(([t, iq]) => ({ t, iq })).sort((a, b) => a.t - b.t);

  // Recent rounds — prefer denormalized recentRounds (has relativeToPar + holesPlayed).
  let rounds: RoundSummary[] = asArray(u.recentRounds)
    .map((r, i) => ({
      roundId: (r?.id ?? `r${i}`) as string,
      courseName: (r?.courseName ?? "Unknown course") as string,
      date: normEpoch(r?.dateMillis ?? r?.date, 0),
      holesPlayed: typeof r?.holesPlayed === "number" ? r.holesPlayed : undefined,
      scoreToPar: typeof r?.relativeToPar === "number" ? r.relativeToPar : null,
    }))
    .filter((r) => r.courseName)
    .sort((a, b) => b.date - a.date)
    .slice(0, 8);
  if (rounds.length === 0) rounds = await roundsFromSubcollection(canonicalId);

  // Top thrown discs (exclude the "Score" manual pseudo-disc).
  const counts = asObject(u.discThrowCounts);
  const ranked = Object.entries(counts)
    .filter(([name]) => name && name.toLowerCase() !== "score")
    .map(([name, count]) => ({ name, count: Number(count) || 0 }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  const topDiscs = ranked.slice(0, 6);
  const hotSet = new Set(ranked.slice(0, 8).map((d) => d.name));

  // Bag = the ACTIVE bag. Multiple-bags accounts carry it in bagsJSON (source of
  // truth); myBagJSON is the legacy mirror all platforms re-project from the
  // active bag, kept as the fallback for pre-migration accounts.
  let bag: BagDisc[] = [];
  try {
    const dataSnap = await getDoc(doc(db, `userBackups/${canonicalId}/data/current`));
    if (dataSnap.exists()) {
      const data = dataSnap.data();
      const allBags = asArray(data.bagsJSON);
      const active = allBags.length
        ? (allBags.find((b) => String(b?.id ?? "") === String(data.activeBagId ?? "")) ?? allBags[0])
        : null;
      const arr = active ? (Array.isArray(active.discs) ? active.discs : []) : asArray(data.myBagJSON);
      bag = arr
        .map((d: Record<string, unknown>) => ({ name: (d?.discName ?? d?.name ?? "").toString(), hot: false }))
        .filter((d: { name: string }) => d.name)
        .map((d: { name: string; hot: boolean }) => ({ ...d, hot: hotSet.has(d.name) }));
    }
  } catch {
    /* leave empty */
  }
  // Android writes a simple bagDiscs string[] on the user doc instead of userBackups/myBagJSON.
  if (bag.length === 0 && Array.isArray(u.bagDiscs)) {
    bag = (u.bagDiscs as unknown[]).map((n) => ({ name: String(n), hot: hotSet.has(String(n)) })).filter((d) => d.name);
  }

  return { profile, iqCurrent, iqHistory, rounds, topDiscs, bag, roundMetas, acesCount };
}
