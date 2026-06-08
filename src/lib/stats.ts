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
        next: { revalidate: 86400 },
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
