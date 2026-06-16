// Server-side collection counts via the Firestore REST API.
//
// The Firestore JS SDK's transports (gRPC / long-polling) are unreliable during Next's
// server build and in some runtimes, so the homepage hub stats used to fall back to "—".
// Plain HTTPS to the REST aggregation endpoint works everywhere (build, SSR, edge) and the
// project's open read rules allow the unauthenticated, API-key request.

const PROJECT = "radius-dg";
const API_KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE"; // public Firebase web key

async function countCollection(collectionId: string): Promise<number> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runAggregationQuery?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredAggregationQuery: {
            structuredQuery: { from: [{ collectionId }] },
            aggregations: [{ alias: "count", count: {} }],
          },
        }),
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const n = data?.[0]?.result?.aggregateFields?.count?.integerValue;
    return n ? parseInt(n, 10) : 0;
  } catch {
    return 0;
  }
}

export const getPlayerCountServer = () => countCollection("users");

import { readFileSync } from "fs";
import { join } from "path";

/** Disc count straight from the disc database file (public/discs.json) so the homepage
 * stat always matches the disc database page instead of a hard-coded number. */
export function getDiscCount(): number {
  try {
    const j = JSON.parse(readFileSync(join(process.cwd(), "public/discs.json"), "utf8"));
    return Array.isArray(j.discs) ? j.discs.length : 0;
  } catch {
    return 0;
  }
}

import { isUSState, countryOf, isPubliclyListed } from "./courses";

const fnum = (f?: { doubleValue?: number; integerValue?: string }): number | undefined => {
  if (!f) return undefined;
  if (typeof f.doubleValue === "number") return f.doubleValue;
  if (f.integerValue != null) return Number(f.integerValue);
  return undefined;
};

/**
 * SINGLE SOURCE OF TRUTH for the public course stats shown anywhere on the site.
 *
 * Paginates the courses collection once (field-masked REST list) and counts ONLY the
 * courses the public Courses page lists — i.e. `name && isPubliclyListed` (hides drafts,
 * pending, rejected, and unnamed). Returns both the headline course count and the distinct
 * geographic reach from the SAME pass, so the homepage banner and /courses can never disagree
 * (previously the banner counted every raw doc incl. drafts → 889 vs the page's 814).
 *
 * Cached for an hour; mirrors getAllCourses()'s `name && isPubliclyListed` filter exactly.
 */
export async function getCourseStatsServer(): Promise<{ count: number; regions: number }> {
  try {
    let count = 0;
    const states = new Set<string>();
    const countries = new Set<string>();
    let pageToken = "";
    for (let page = 0; page < 20; page++) {
      const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/courses`);
      url.searchParams.set("pageSize", "300");
      for (const fp of ["name", "reviewStatus", "isDraft", "state", "latitude", "longitude"]) url.searchParams.append("mask.fieldPaths", fp);
      url.searchParams.set("key", API_KEY);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) break;
      const data = await res.json();
      for (const doc of data.documents ?? []) {
        const f = doc.fields ?? {};
        const name = f.name?.stringValue as string | undefined;
        const reviewStatus = f.reviewStatus?.stringValue as string | undefined;
        const isDraft = f.isDraft?.booleanValue === true;
        // EXACT same gate as getAllCourses() so the count matches what the page renders.
        if (!name || !isPubliclyListed({ reviewStatus, isDraft })) continue;
        count++;
        const state = f.state?.stringValue as string | undefined;
        const latitude = fnum(f.latitude);
        const longitude = fnum(f.longitude);
        if (isUSState(state)) states.add(state!.trim().toUpperCase());
        const co = countryOf({ state, latitude, longitude });
        // count international reach; the US is already represented by its states
        if (co && co !== "International" && co !== "United States" && co !== "US") countries.add(co);
      }
      pageToken = data.nextPageToken ?? "";
      if (!pageToken) break;
    }
    return { count, regions: states.size + countries.size };
  } catch {
    return { count: 0, regions: 0 };
  }
}

export const getCourseCountServer = async () => (await getCourseStatsServer()).count;
export const getRegionCountServer = async () => (await getCourseStatsServer()).regions;
