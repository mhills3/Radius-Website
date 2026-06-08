import { initializeApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

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
