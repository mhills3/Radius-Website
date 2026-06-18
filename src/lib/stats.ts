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

// Homepage "Courses mapped" — the full mapped-course total (every course doc, incl. drafts/
// pending). This is intentionally the bigger headline number and differs from /courses, which
// lists only the publicly-browsable subset (name && isPubliclyListed) via getAllCourses.
export const getCourseCountServer = () => countCollection("courses");
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

import { canonicalState, countryOf, isPubliclyListed, isPrivateCourse } from "./courses";

const fnum = (f?: { doubleValue?: number; integerValue?: string }): number | undefined => {
  if (!f) return undefined;
  if (typeof f.doubleValue === "number") return f.doubleValue;
  if (f.integerValue != null) return Number(f.integerValue);
  return undefined;
};

/**
 * Distinct geographic reach: US states + international countries the courses span. Counts the SAME
 * public/visible courses the directory + coverage map use (so the numbers always agree), and
 * normalizes states to a canonical name so "CA"/"California" count once.
 */
export async function getRegionCountServer(): Promise<number> {
  try {
    const states = new Set<string>();
    const countries = new Set<string>();
    let pageToken = "";
    for (let page = 0; page < 20; page++) {
      const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/courses`);
      url.searchParams.set("pageSize", "300");
      for (const fp of ["name", "state", "latitude", "longitude", "reviewStatus", "isDraft", "courseType"]) url.searchParams.append("mask.fieldPaths", fp);
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
        const courseType = f.courseType?.stringValue as string | undefined;
        // Same gate as the public directory + coverage map.
        if (!name || !isPubliclyListed({ reviewStatus, isDraft }) || isPrivateCourse({ courseType })) continue;
        const state = f.state?.stringValue as string | undefined;
        const latitude = fnum(f.latitude);
        const longitude = fnum(f.longitude);
        const cs = canonicalState(state);
        if (cs) states.add(cs);
        const co = countryOf({ state, latitude, longitude });
        // count international reach; the US is already represented by its states
        if (co && co !== "International" && co !== "United States" && co !== "US") countries.add(co);
      }
      pageToken = data.nextPageToken ?? "";
      if (!pageToken) break;
    }
    return states.size + countries.size;
  } catch {
    return 0;
  }
}
