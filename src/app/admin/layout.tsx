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
    <div className="relative min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* Fixed cinematic backdrop: the crew silhouette photo fading into the forest ground so the
          top of every admin page sits on sky and the working area below stays solid + readable. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/team/circle-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%] opacity-40 saturate-[0.85]" />
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(180deg, rgba(19,30,24,0.35) 0%, rgba(19,30,24,0.82) 48%, rgba(19,30,24,1) 78%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(60% 45% at 85% 0%, rgba(246,193,101,0.16), transparent 70%), radial-gradient(50% 40% at 0% 20%, rgba(95,207,128,0.08), transparent 70%)" }} />
      </div>
      <div className="relative z-10">
        <StaffGate>{children}</StaffGate>
      </div>
    </div>
  );
}
