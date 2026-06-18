"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/** "Create free account" CTA on the disc page — shown only to logged-out visitors. */
export default function DiscBagCta({ discName }: { discName: string }) {
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 p-5 text-center">
      <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">Bag the {discName}</h3>
      <p className="mx-auto mt-1 text-xs text-[#46554c]">Scan your discs, rate your bag &amp; get shot guidance on Radius.</p>
      <Link href="/login" className="mt-3 block rounded-full bg-[#16221b] px-6 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a]">Create free account</Link>
    </div>
  );
}
