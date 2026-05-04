import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);
