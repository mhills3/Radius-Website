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

async function trackScan(source: string, platform: string) {
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
              params: { source, platform, engagement_time_msec: 1 },
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
  const source = request.nextUrl.searchParams.get("s") ?? "teesign";

  let target: string;
  let platform: string;
  if (/Android/i.test(ua)) {
    target = GOOGLE_PLAY;
    platform = "android";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    target = APP_STORE;
    platform = "ios";
  } else {
    target = `${SITE}/`;
    platform = "other";
  }

  // Run after the redirect is sent so tracking never adds latency for the user.
  after(() => trackScan(source, platform));

  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
