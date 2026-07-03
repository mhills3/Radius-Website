import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";

// Physical signage (tee-sign QR codes, flyers) points at https://radiusdiscgolf.com/download.
// One code for both stores: detect the visitor's OS and send them straight to the right store.
// Desktop / unknown visitors land on the homepage where both store badges live.
const APP_STORE =
  "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const GOOGLE_PLAY =
  "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";
const SITE = "https://radiusdiscgolf.com";

// Scan tracking via GA4 Measurement Protocol. Fires a `qr_scan` event per hit so we can
// count scans (this route is used only by the QR codes). To enable, set GA_MP_API_SECRET in
// Vercel: GA4 Admin -> Data streams -> the G-JWD14Z58WV web stream -> Measurement Protocol
// API secrets -> Create. Until then this safely no-ops and the redirect still works.
const GA_MEASUREMENT_ID = "G-JWD14Z58WV";

// UA-dependent response — must never be cached (same URL redirects differently per device).
export const dynamic = "force-dynamic";

type Geo = { city: string; region: string; country: string };

async function trackScan(source: string, platform: string, geo: Geo) {
  const secret = process.env.GA_MP_API_SECRET;
  if (!secret) return;
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${secret}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: `${Date.now()}.${Math.round(Math.random() * 1e9)}`,
          events: [
            {
              name: "qr_scan",
              params: {
                source,
                platform,
                // Real visitor location from the edge IP lookup. We send it explicitly because a
                // server-side event would otherwise geolocate to our server, not the scanner.
                city: geo.city,
                region: geo.region,
                country: geo.country,
                engagement_time_msec: 1,
              },
            },
          ],
        }),
      },
    );
  } catch {
    // analytics must never affect the user's redirect
  }
}

export async function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  // `?s=` lets each physical sign carry its own tag; defaults to the tee sign.
  // Sanitize — this value flows into the outbound store URLs.
  const source =
    (request.nextUrl.searchParams.get("s") ?? "teesign")
      .replace(/[^a-z0-9_-]/gi, "")
      .slice(0, 40) || "teesign";

  let target: string;
  let platform: string;
  if (/Android/i.test(ua)) {
    // Play Install Referrer — the app reads this via InstallReferrerClient on first
    // launch and stamps `acquisitionSource` on the user doc, enabling scan -> Pro attribution.
    const referrer = encodeURIComponent(`utm_source=${source}&utm_medium=sign`);
    target = `${GOOGLE_PLAY}&referrer=${referrer}`;
    platform = "android";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    // `ct` = App Store campaign token; shows sign-driven installs in App Store Connect.
    target = `${APP_STORE}?ct=${encodeURIComponent(source)}`;
    platform = "ios";
  } else {
    target = `${SITE}/`;
    platform = "other";
  }

  // Real visitor location from Vercel's edge IP lookup — no permission prompt, no page load,
  // redirect stays instant. City-level and fuzzy on cellular, but enough for "which area scans more."
  const decode = (v: string | null) => {
    if (!v) return "";
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const geo: Geo = {
    city: decode(request.headers.get("x-vercel-ip-city")),
    region: request.headers.get("x-vercel-ip-country-region") ?? "",
    country: request.headers.get("x-vercel-ip-country") ?? "",
  };

  // Run after the redirect is sent so tracking never adds latency for the user.
  after(() => trackScan(source, platform, geo));

  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
