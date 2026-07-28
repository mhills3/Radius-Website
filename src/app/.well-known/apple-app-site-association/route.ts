import { NextResponse } from "next/server";

// Apple App Site Association — enables iOS Universal Links so shared event URLs
// (radiusdiscgolf.com/leagues/{slug}/e/{eventId}) open the Radius app instead of
// Safari. Served at the apex host (the site's canonical domain, matching the app's
// applinks:radiusdiscgolf.com entitlement) as application/json with no redirect.
// appID = {TeamID}.{BundleID} = D9H9833P7B.com.michaelhills.Radius
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: ["D9H9833P7B.com.michaelhills.Radius"],
            components: [
              { "/": "/leagues/*/e/*", comment: "Event detail deep link" },
              { "/": "/leagues/*", comment: "League / events pages" },
            ],
          },
        ],
      },
    },
    { headers: { "content-type": "application/json" } }
  );
}
