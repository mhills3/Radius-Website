"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import StaffGate from "@/components/staff/StaffGate";

/**
 * Guards EVERY route under /admin on staff. Hiding the nav item is not access control — anyone can
 * type a URL — so this route-guard (plus the StaffGate fallback) runs for the hub and every tool.
 * The real enforcement is still server-side in the callables, which re-check staff with the Admin SDK.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !profile?.staff) router.replace("/dashboard"); }, [loading, profile, router]);
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <StaffGate>{children}</StaffGate>
    </div>
  );
}
