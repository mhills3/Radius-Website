import { initializeApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyCVjfvMNwy5sLFjONGZFfPpPsnqO79IiPE",
  authDomain: "radius-dg.firebaseapp.com",
  projectId: "radius-dg",
  storageBucket: "radius-dg.firebasestorage.app",
  messagingSenderId: "357255426355",
  appId: "1:357255426355:web:3af86d8a659c10464bce46",
  measurementId: "G-JWD14Z58WV",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// App Check — proves requests come from the real app, not a script using the
// public API key. Browser-only (SSR / crawlers have no `window`, and must stay
// public for SEO). The reCAPTCHA v3 site key is public by design (it ships to
// the browser), so it sits inline alongside firebaseConfig above. This only
// attaches an attestation token — nothing changes for users until App Check
// enforcement is switched on in the Firebase console.
if (typeof window !== "undefined") {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider("6LfuTT8tAAAAABMwbZxKanrhRQF2ZqJXML0i5XTn"),
    isTokenAutoRefreshEnabled: true,
  });
}

// On the server (SSR / generateMetadata / sitemap) the default gRPC transport can't reach
// Firestore — force long-polling there. The browser keeps the fast default transport.
let _db: Firestore;
try {
  _db = initializeFirestore(app, typeof window === "undefined" ? { experimentalForceLongPolling: true } : {});
} catch {
  _db = getFirestore(app);
}
export const db = _db;
export const auth = getAuth(app);
export const storage = getStorage(app);
// Callable Cloud Functions (radius-functions, us-central1) — e.g. resolveCourseRemoval, which
// re-checks staff server-side with the Admin SDK.
export const functions = getFunctions(app);
