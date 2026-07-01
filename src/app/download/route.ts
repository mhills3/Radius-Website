import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Physical signage (tee-sign QR codes, flyers) points at https://radiusdiscgolf.com/download.
// One code for both stores: detect the visitor's OS and send them straight to the right store.
// Desktop / unknown visitors land on the homepage where both store badges live.
const APP_STORE =
  "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const GOOGLE_PLAY =
  "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";
const SITE = "https://radiusdiscgolf.com";

// UA-dependent response — must never be cached (same URL redirects differently per device).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";

  let target: string;
  if (/Android/i.test(ua)) {
    target = GOOGLE_PLAY;
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    target = APP_STORE;
  } else {
    target = `${SITE}/`;
  }

  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
