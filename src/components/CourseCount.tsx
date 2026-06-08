"use client";

import { useEffect, useState } from "react";
import { getCourseCount } from "@/lib/courses";

/** Inline live count of mapped courses (falls back gracefully). */
export default function CourseCount({ fallback = "600+" }: { fallback?: string }) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    getCourseCount().then((x) => x > 0 && setN(x)).catch(() => {});
  }, []);
  return <>{n != null ? n.toLocaleString() : fallback}</>;
}
