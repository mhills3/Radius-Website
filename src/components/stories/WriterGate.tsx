"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function WriterGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[#6b7a70]">
        <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="text-4xl">✍️</div>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-bold">Sign in to write</h1>
        <p className="mt-2 text-sm text-[#46554c]">You need a Radius account with writer access to publish stories.</p>
        <Link href="/login" className="mt-5 inline-block rounded-full bg-[var(--gold)] px-6 py-2.5 text-sm font-bold text-[#16221b]">Sign in</Link>
      </div>
    );
  }
  if (!profile?.writer) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-bold">Writer access only</h1>
        <p className="mt-2 text-sm text-[#46554c]">Stories are published by approved Radius writers. Want to contribute disc golf news, tips, or course features? Reach out to the Radius team to get writer access.</p>
        <Link href="/stories" className="mt-5 inline-block text-sm font-bold text-[#9a7a3a] hover:underline">← Back to Stories</Link>
      </div>
    );
  }
  return <>{children}</>;
}
