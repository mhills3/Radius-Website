"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resolveCanonicalId } from "@/lib/account";
import { useAuth } from "@/components/AuthProvider";

/**
 * The logged-in viewer's distance-unit preference (users/{cid}.useMetric, set in the apps).
 * Defaults to false (feet) — for logged-out viewers and until the profile loads.
 */
export function useMetricPref(): boolean {
  const { user } = useAuth();
  const [metric, setMetric] = useState(false);
  useEffect(() => {
    if (!user) { setMetric(false); return; }
    let alive = true;
    (async () => {
      try {
        const cid = await resolveCanonicalId(user.uid);
        const s = await getDoc(doc(db, "users", cid));
        if (alive && s.exists()) setMetric(s.data().useMetric === true);
      } catch { /* keep default */ }
    })();
    return () => { alive = false; };
  }, [user]);
  return metric;
}
