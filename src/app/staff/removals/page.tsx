"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import StaffGate from "@/components/staff/StaffGate";
import RemovalQueue from "@/components/staff/RemovalQueue";

export default function StaffRemovalsPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !profile?.staff) router.replace("/dashboard"); }, [loading, profile, router]);
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <StaffGate>
        <RemovalQueue />
      </StaffGate>
    </div>
  );
}
