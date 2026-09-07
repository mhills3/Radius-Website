"use client";

import DiscSubmissionQueue from "@/components/staff/DiscSubmissionQueue";

// Access is enforced by /admin/layout.tsx (route-guard + StaffGate) — this page just renders the queue.
export default function DiscSubmissionsPage() {
  return <DiscSubmissionQueue />;
}
