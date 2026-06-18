// Growth series for the hidden /growth page. Computed server-side via the Firestore REST API
// (field-masked, paginated, hourly-cached) so it's reliable and auto-updates as data grows.

const PROJECT = "radius-dg";
const KEY = "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE"; // public Firebase web key
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// Normalize a stored timestamp to ms epoch (handles ms, seconds, and Apple-reference-date values).
function normMs(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  if (!n || Number.isNaN(n)) return 0;
  if (n > 1e12) return n;
  if (n > 1e9) return n * 1000;
  if (n > 1e7) return (n + 978307200) * 1000;
  return 0;
}
const fnum = (f?: { doubleValue?: number; integerValue?: string }): number | undefined => {
  if (!f) return undefined;
  if (typeof f.doubleValue === "number") return f.doubleValue;
  if (f.integerValue != null) return Number(f.integerValue);
  return undefined;
};

async function collectTimestamps(collection: string, fields: string[]): Promise<{ ts: number[]; total: number }> {
  const ts: number[] = [];
  let total = 0;
  let token = "";
  for (let page = 0; page < 60; page++) {
    const url = new URL(`${BASE}/${collection}`);
    url.searchParams.set("pageSize", "300");
    for (const f of fields) url.searchParams.append("mask.fieldPaths", f);
    url.searchParams.set("key", KEY);
    if (token) url.searchParams.set("pageToken", token);
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) break;
    const data = await res.json();
    for (const doc of data.documents ?? []) {
      total++;
      const ff = doc.fields ?? {};
      let ms = 0;
      for (const key of fields) { ms = normMs(fnum(ff[key])); if (ms) break; }
      if (ms) ts.push(ms);
    }
    token = data.nextPageToken ?? "";
    if (!token) break;
  }
  return { ts, total };
}

export interface GrowthPoint { d: number; courses: number; users: number } // d = day (ms, UTC midnight)
export interface GrowthData {
  points: GrowthPoint[];          // daily cumulative totals
  coursesTotal: number;           // all course docs
  usersTotal: number;             // all user docs
  usersDated: number;             // users with a known signup date
  usersUsable: boolean;           // whether the users line is meaningful (good coverage + real spread)
  generatedAt: number;
}

const DAY = 86400000;
const dayOf = (ms: number) => Math.floor(ms / DAY) * DAY;

/** Cumulative daily series of courses-built and users-joined. Cached 1h via fetch revalidate. */
export async function getGrowthData(): Promise<GrowthData> {
  const [c, u] = await Promise.all([
    collectTimestamps("courses", ["createdAt", "dateCreated"]),
    collectTimestamps("users", ["createdAt", "lastUpdated"]), // createdAt preferred; lastUpdated only as last resort
  ]);
  // For users we only chart those with a real createdAt (lastUpdated is not a signup date); but we still
  // need the dated count. Re-collect users using ONLY createdAt to avoid lastUpdated polluting the dates.
  const uDated = await collectTimestamps("users", ["createdAt"]);

  const courseTs = c.ts.filter(Boolean).sort((a, b) => a - b);
  const userTs = uDated.ts.filter(Boolean).sort((a, b) => a - b);

  // The users line is only meaningful if most accounts have a signup date AND those dates span a
  // real range (not bunched in a backfill window). Right now ~37% are dated, all within ~2 weeks,
  // so we suppress the line until the app writes a real createdAt at signup going forward.
  const coverage = u.total ? userTs.length / u.total : 0;
  const spanDays = userTs.length ? (userTs[userTs.length - 1] - userTs[0]) / DAY : 0;
  const usersUsable = coverage >= 0.6 && spanDays >= 45;

  // Build the union of all days from the earliest event to today.
  const all = usersUsable ? [...courseTs, ...userTs] : [...courseTs];
  if (all.length === 0) {
    return { points: [], coursesTotal: c.total, usersTotal: u.total, usersDated: userTs.length, usersUsable, generatedAt: Date.now() };
  }
  const start = dayOf(Math.min(...all));
  const end = dayOf(Date.now());

  // cumulative counts via a single pass per series
  let ci = 0, ui = 0, cc = 0, uc = 0;
  const points: GrowthPoint[] = [];
  for (let day = start; day <= end; day += DAY) {
    const next = day + DAY;
    while (ci < courseTs.length && courseTs[ci] < next) { cc++; ci++; }
    while (ui < userTs.length && userTs[ui] < next) { uc++; ui++; }
    points.push({ d: day, courses: cc, users: uc });
  }
  return { points, coursesTotal: c.total, usersTotal: u.total, usersDated: userTs.length, usersUsable, generatedAt: Date.now() };
}
