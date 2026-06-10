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

export const getCourseCountServer = () => countCollection("courses");
export const getPlayerCountServer = () => countCollection("users");

import { isUSState, countryOf } from "./courses";

const fnum = (f?: { doubleValue?: number; integerValue?: string }): number | undefined => {
  if (!f) return undefined;
  if (typeof f.doubleValue === "number") return f.doubleValue;
  if (f.integerValue != null) return Number(f.integerValue);
  return undefined;
};

/**
 * Distinct geographic reach: US states + international countries the courses span.
 * Pulls only state/lat/lng for every course (field-masked REST list) and de-dupes —
 * replaces the old hard-coded "50" so the stat stays accurate as courses are added.
 */
export async function getRegionCountServer(): Promise<number> {
  try {
    const states = new Set<string>();
    const countries = new Set<string>();
    let pageToken = "";
    for (let page = 0; page < 12; page++) {
      const url = new URL(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/courses`);
      url.searchParams.set("pageSize", "300");
      url.searchParams.append("mask.fieldPaths", "state");
      url.searchParams.append("mask.fieldPaths", "latitude");
      url.searchParams.append("mask.fieldPaths", "longitude");
      url.searchParams.set("key", API_KEY);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
      if (!res.ok) break;
      const data = await res.json();
      for (const doc of data.documents ?? []) {
        const f = doc.fields ?? {};
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
    return states.size + countries.size;
  } catch {
    return 0;
  }
}
