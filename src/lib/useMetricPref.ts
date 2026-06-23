"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resolveCanonicalId } from "@/lib/account";
import { useAuth } from "@/components/AuthProvider";

// Session cache so many components (and long course lists) share ONE Firestore read per user.
const cache = new Map<string, boolean>();
const pending = new Map<string, Promise<boolean>>();

function loadMetric(uid: string): Promise<boolean> {
  if (cache.has(uid)) return Promise.resolve(cache.get(uid)!);
  let p = pending.get(uid);
  if (!p) {
    p = (async () => {
      try {
        const cid = await resolveCanonicalId(uid);
        const s = await getDoc(doc(db, "users", cid));
        const v = s.exists() && s.data().useMetric === true;
        cache.set(uid, v);
        return v;
      } catch {
        return false;
      } finally {
        pending.delete(uid);
      }
    })();
    pending.set(uid, p);
  }
  return p;
}

/**
 * The logged-in viewer's distance-unit preference (users/{cid}.useMetric, set in the apps).
 * Defaults to false (feet) for logged-out viewers and until the profile loads. Cached per session.
 */
export function useMetricPref(): boolean {
  const { user } = useAuth();
  const [metric, setMetric] = useState(() => (user ? cache.get(user.uid) ?? false : false));
  useEffect(() => {
    if (!user) { setMetric(false); return; }
    let alive = true;
    loadMetric(user.uid).then((v) => { if (alive) setMetric(v); });
    return () => { alive = false; };
  }, [user]);
  return metric;
}
