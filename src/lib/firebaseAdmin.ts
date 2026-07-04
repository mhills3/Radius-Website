import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Server-side Firebase Admin, used ONLY by admin-gated routes (e.g. the sign report).
// The service account JSON is provided via the FIREBASE_ADMIN_KEY env var (Vercel: paste the
// whole key file as the value). If it's absent, every accessor returns null so the app keeps
// building/running and admin endpoints simply report "not configured".
let _app: App | null | undefined;
let _db: Firestore | null = null;

function app(): App | null {
  if (_app !== undefined) return _app;
  const raw = process.env.FIREBASE_ADMIN_KEY;
  if (!raw) {
    _app = null;
    return null;
  }
  try {
    const sa = JSON.parse(raw);
    _app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(sa), projectId: "radius-dg" });
  } catch {
    _app = null;
  }
  return _app;
}

export function adminAuth() {
  const a = app();
  return a ? getAuth(a) : null;
}

export function adminDb(): Firestore | null {
  if (_db) return _db;
  const a = app();
  if (!a) return null;
  _db = getFirestore(a);
  // The gRPC transport can't reach Firestore from the Next server runtime (same reason the
  // client reads go over REST) — force the Admin SDK onto REST too.
  try {
    _db.settings({ preferRest: true });
  } catch {
    /* settings already applied */
  }
  return _db;
}
