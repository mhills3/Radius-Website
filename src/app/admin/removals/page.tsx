"use client";

import RemovalQueue from "@/components/staff/RemovalQueue";

// Access is enforced by /admin/layout.tsx (route-guard + StaffGate) — this page just renders the queue.
export default function AdminRemovalsPage() {
  return <RemovalQueue />;
}
