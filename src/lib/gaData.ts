import "server-only";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

// GA4 scan counts for the admin sign report. Reuses the FIREBASE_ADMIN_KEY service account
// (grant that account Viewer access to the radius-dg GA4 property so this can read). Every
// accessor degrades to null on any failure so the dashboard still renders without scans.
const GA_PROPERTY_ID = "532521869"; // radius-dg GA4 property

let _client: BetaAnalyticsDataClient | null | undefined;

function client(): BetaAnalyticsDataClient | null {
  if (_client !== undefined) return _client;
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    _client = null;
    return null;
  }
  try {
    const sa = JSON.parse(raw);
    _client = new BetaAnalyticsDataClient({
      credentials: { client_email: sa.client_email, private_key: sa.private_key },
      projectId: sa.project_id,
    });
  } catch {
    _client = null;
  }
  return _client;
}

/** Total `qr_scan` events grouped by the `source` param, over the last `days`. Null if unavailable. */
export async function scansBySource(days = 90): Promise<Record<string, number> | null> {
  const c = client();
  if (!c) return null;
  try {
    const [resp] = await c.runReport({
      property: `properties/${GA_PROPERTY_ID}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [{ name: "customEvent:source" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        filter: { fieldName: "eventName", stringFilter: { value: "qr_scan" } },
      },
      limit: 250,
    });
    const out: Record<string, number> = {};
    for (const row of resp.rows ?? []) {
      const src = row.dimensionValues?.[0]?.value ?? "(not set)";
      out[src] = Number(row.metricValues?.[0]?.value ?? 0);
    }
    return out;
  } catch {
    // GA access not granted yet, dimension not registered, or API not ready — skip scans.
    return null;
  }
}
