"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getDashboard, type Dashboard } from "@/lib/account";
import DashboardView from "@/components/dashboard/DashboardView";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    getDashboard(user.uid)
      .then((d) => {
        if (d) {
          setData(d);
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

  if (state === "empty" || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-deep)] px-6 text-center text-[var(--cream)]">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.03em]">You&apos;re in.</h1>
        <p className="mx-auto mt-3 max-w-md text-[var(--text-body)]">Your game data appears here once you play a round in the Radius app.</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link href="/courses" className="rounded-full bg-[var(--gold)] px-7 py-3.5 text-sm font-bold text-[#16221b] hover:bg-[var(--gold-bright)]">Explore courses</Link>
          <button onClick={() => signOut()} className="rounded-full border border-white/20 px-7 py-3.5 text-sm font-semibold text-[var(--cream)] hover:border-white/50">Sign out</button>
        </div>
      </div>
    );
  }

  return <DashboardView data={data} uid={user.uid} />;
}
