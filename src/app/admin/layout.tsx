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
  const { user, profile, loading, profileLoading } = useAuth();
  const router = useRouter();
  // Only redirect once BOTH auth and the profile doc have settled — otherwise a still-loading profile
  // reads as "not staff" and bounces you to /dashboard (e.g. on "back to Admin").
  useEffect(() => {
    if (loading || (user && profileLoading)) return;
    if (!profile?.staff) router.replace("/dashboard");
  }, [loading, profileLoading, user, profile, router]);
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <StaffGate>{children}</StaffGate>
    </div>
  );
}
