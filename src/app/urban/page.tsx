import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import QRCode from "qrcode";
import UrbanLanding from "./UrbanLanding";

// Dedicated CTA link for the Urban Disc Golf creator video — memorable enough to say out loud
// ("radiusdiscgolf.com/urban"). Same instant, server-side platform redirect + GA4 attribution as
// /download and /foundation, so installs the video drives get a clean, separable number instead of
// blurring into organic. Mobile → the right store with attribution tokens; desktop → a two-button
// landing. UA-dependent, so it must never be cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Get Radius",
  robots: { index: false, follow: false },
};

const APP_STORE = "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";
const GA_MEASUREMENT_ID = "G-JWD14Z58WV";
const SOURCE = "urban";
const SELF_URL = "https://radiusdiscgolf.com/urban"; // what the desktop QR encodes → phone re-hits this and auto-redirects

type Geo = { city: string; region: string; country: string };

// GA4 Measurement Protocol — one `urban_visit` event per hit so the video's traffic is countable.
// Reuses the same GA_MP_API_SECRET the /download route needs; safely no-ops until that's set in Vercel.
async function track(platform: string, geo: Geo) {
  const secret = process.env.GA_MP_API_SECRET;
  if (!secret) return;
  try {
    await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${secret}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: `${Date.now()}.${Math.round(Math.random() * 1e9)}`,
        events: [{ name: "urban_visit", params: { source: SOURCE, platform, city: geo.city, region: geo.region, country: geo.country, engagement_time_msec: 1 } }],
      }),
    });
  } catch {
    // analytics must never affect the user's redirect
  }
}

export default async function UrbanPage() {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const decode = (v: string | null) => { if (!v) return ""; try { return decodeURIComponent(v); } catch { return v; } };
  const geo: Geo = {
    city: decode(h.get("x-vercel-ip-city")),
    region: h.get("x-vercel-ip-country-region") ?? "",
    country: h.get("x-vercel-ip-country") ?? "",
  };

  if (/Android/i.test(ua)) {
    // Play Install Referrer — the app reads this on first launch and stamps acquisitionSource,
    // enabling video → install → Pro attribution.
    after(() => track("android", geo));
    redirect(`${GOOGLE_PLAY}&referrer=${encodeURIComponent(`utm_source=${SOURCE}&utm_medium=creator`)}`);
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    // `ct` = App Store campaign token → sign-/video-driven installs show in App Store Connect.
    after(() => track("ios", geo));
    redirect(`${APP_STORE}?ct=${encodeURIComponent(SOURCE)}`);
  }

  // desktop / unknown → a proper landing: a scan-to-install QR (a phone hitting this URL auto-redirects)
  // plus the store buttons. The client also fires the desktop urban_visit event.
  const qrSvg = await QRCode.toString(SELF_URL, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#16221b", light: "#ffffff" } });
  return <UrbanLanding appStore={APP_STORE} googlePlay={GOOGLE_PLAY} qrSvg={qrSvg} />;
}
