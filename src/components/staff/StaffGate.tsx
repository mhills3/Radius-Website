"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/**
 * Cosmetic access gate for the staff dashboard — mirrors WriterGate. This protects the UI only:
 * Firestore Stage-1 rules let any signed-in user write, so every real action goes through the
 * resolveCourseRemoval callable, which re-checks staff server-side.
 */
export default function StaffGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileLoading } = useAuth();

  // Wait for the profile too — deciding "not staff" before it loads flashes the gate wrongly.
  if (loading || (user && profileLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--sage)]">
        <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-[var(--text-body)]">The staff dashboard needs a Radius account with staff access.</p>
        <Link href="/login" className="mt-5 inline-block rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b]">Sign in</Link>
      </div>
    );
  }
  if (!profile?.staff) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="text-4xl">🚧</div>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-bold">Staff only</h1>
        <p className="mt-2 text-sm text-[var(--text-body)]">This area is for the Radius team. If you should have access, ask Michael to set your staff flag.</p>
        <Link href="/dashboard" className="mt-5 inline-block text-sm font-bold text-[var(--gold)] hover:underline">← Back to Dashboard</Link>
      </div>
    );
  }
  return <>{children}</>;
}
