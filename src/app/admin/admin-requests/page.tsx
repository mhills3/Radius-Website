"use client";

import AdminRequestQueue from "@/components/staff/AdminRequestQueue";

// Access is enforced by /admin/layout.tsx (route-guard + StaffGate) — this page just renders the queue.
export default function AdminRequestsPage() {
  return <AdminRequestQueue />;
}
