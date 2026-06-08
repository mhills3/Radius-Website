"use client";

import { useEffect, useState } from "react";

// Animated count-up. The value is resolved server-side and passed in, so it renders
// correctly on every device (no client-side Firestore fetch that can fail on mobile).
export default function StatValue({ value, suffix = "", fallback }: { value: number | null; suffix?: string; fallback: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (value == null) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null) return <>{fallback}</>;
  return <>{n.toLocaleString()}{suffix}</>;
}
