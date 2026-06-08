"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getBag, type Bag } from "@/lib/bag";
import BagView from "@/components/bag/BagView";

export default function BagPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [bag, setBag] = useState<Bag | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    getBag(user.uid)
      .then((b) => {
        if (b.discs.length) {
          setBag(b);
          setState("ready");
        } else setState("empty");
      })
      .catch(() => setState("empty"));
  }, [loading, user, router]);

  if (loading || (user && state === "loading")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)] text-[var(--sage)]">
        <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }
  if (!user) return null;

  if (state === "empty" || !bag) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-deep)] px-6 text-center text-[var(--cream)]">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em]">Your bag is empty.</h1>
        <p className="mx-auto mt-3 max-w-md text-[var(--text-body)]">Build your bag in the Radius app and it&apos;ll appear here — flight charts, slot coverage, and all.</p>
        <Link href="/courses" className="mt-7 rounded-full bg-[var(--gold)] px-7 py-3.5 text-sm font-bold text-[#16221b] hover:bg-[var(--gold-bright)]">Explore courses</Link>
      </div>
    );
  }

  return <BagView bag={bag} uid={user!.uid} />;
}
