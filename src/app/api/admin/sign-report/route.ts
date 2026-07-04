import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// Admin-only funnel: users tallied by `acquisitionSource` (the tee-sign QR tag the apps stamp),
// with Pro conversions. Token-verified server-side; the raw user data never reaches the browser.
export const dynamic = "force-dynamic";

const ADMIN_EMAILS = ["tripp4137@gmail.com"];
const NONE = "(untagged / pre-tracking)";

type Tally = { source: string; users: number; proNow: number; everPro: number };

export async function GET(request: NextRequest) {
  const auth = adminAuth();
  const db = adminDb();
  if (!auth || !db) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return NextResponse.json({ error: "no_token" }, { status: 401 });

  let email = "";
  try {
    const decoded = await auth.verifyIdToken(token);
    email = (decoded.email ?? "").toLowerCase();
  } catch {
    return NextResponse.json({ error: "bad_token" }, { status: 401 });
  }
  if (!ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const map = new Map<string, Tally>();
  let scanned = 0;

  const snap = await db
    .collection("users")
    .select("acquisitionSource", "isPro", "proExpires", "firstProAt")
    .get();

  snap.forEach((doc) => {
    scanned++;
    const d = doc.data() as {
      acquisitionSource?: unknown;
      isPro?: unknown;
      proExpires?: unknown;
      firstProAt?: unknown;
    };
    const src =
      typeof d.acquisitionSource === "string" && d.acquisitionSource.trim()
        ? d.acquisitionSource.trim()
        : NONE;
    const t = map.get(src) ?? { source: src, users: 0, proNow: 0, everPro: 0 };
    t.users++;
    const expires = typeof d.proExpires === "number" ? d.proExpires : null;
    if (d.isPro === true && (expires == null || expires > now)) t.proNow++;
    if (typeof d.firstProAt === "number" && d.firstProAt > 0) t.everPro++;
    map.set(src, t);
  });

  const rows = [...map.values()].sort((a, b) => {
    if (a.source === NONE) return 1;
    if (b.source === NONE) return -1;
    return b.users - a.users;
  });

  return NextResponse.json(
    { rows, scanned, generatedAt: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
