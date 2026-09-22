"use client";

import MentionsQueue from "@/components/staff/MentionsQueue";

// Access is enforced by /admin/layout.tsx (route-guard + StaffGate) — this page just renders the queue.
export default function AdminMentionsPage() {
  return <MentionsQueue />;
}
