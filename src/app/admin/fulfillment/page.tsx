"use client";

import FulfillmentQueue from "@/components/staff/FulfillmentQueue";

// Access is enforced by /admin/layout.tsx (route-guard + StaffGate) — this page just renders the queue.
export default function AdminFulfillmentPage() {
  return <FulfillmentQueue />;
}
