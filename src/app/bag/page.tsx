"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import MyGameOverview from "@/components/mygame/MyGameOverview";
import MyGameBag from "@/components/mygame/MyGameBag";
import MyGameImprove from "@/components/mygame/MyGameImprove";

type GTab = "improve" | "bag";

const TABS: { key: GTab; label: string; icon: React.ReactNode }[] = [
  { key: "improve", label: "Improve", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M7 17L17 7M9 7h8v8" /></svg> },
  { key: "bag", label: "My Bag", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M6 7V5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2M4 7h16l-1 14H5L4 7z" /></svg> },
];

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)] text-[var(--sage)]">
      <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
    </div>
  );
}

function MyGameInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, loading } = useAuth();
  const tabParam = sp.get("tab");
  // Local state drives the active tab (instant, reliable) with the URL kept in sync — so a click never
  // depends on a searchParams re-render. Overview is merged into Improve; old ?tab=overview/improve → improve.
  const [tab, setTab] = useState<GTab>(tabParam === "bag" ? "bag" : "improve");
  const go = (t: GTab) => { setTab(t); router.replace(t === "improve" ? "/bag" : `/bag?tab=${t}`, { scroll: false }); };
  // keep state in sync when the URL changes externally (back/forward, deep link)
  useEffect(() => { setTab(tabParam === "bag" ? "bag" : "improve"); }, [tabParam]);

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  if (loading || !user) return <Spinner />;

  return (
    <div className="relative min-h-screen text-[var(--cream)]">
      {/* same green as the Dashboard */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: -1, backgroundColor: "var(--bg-deep)" }} />
      {/* a real course photo behind the header, deeply darkened + melting seamlessly into the base */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[460px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/course/courses-hero.jpg" alt="" className="h-full w-full object-cover object-[center_35%] opacity-[0.28]" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(20,27,22,0.45) 0%, rgba(20,27,22,0.66) 42%, rgba(20,27,22,0.9) 74%, var(--bg-deep) 96%)" }} />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-8">
        <div className="font-[family-name:var(--font-heading)] text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Your game</div>
        <h1 className="mt-1 font-[family-name:var(--font-heading)] text-3xl font-black tracking-[-0.02em] sm:text-4xl">My Game</h1>

        {/* iOS-style top tab bar — icon + caps label, gold underline on the active tab */}
        <div className="mt-5 grid grid-cols-2 border-b border-white/[0.08]">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => go(t.key)} className={`relative flex items-center justify-center gap-2 py-3 font-[family-name:var(--font-heading)] text-[12px] font-black uppercase tracking-[0.12em] transition-colors ${active ? "text-[var(--cream)]" : "text-[var(--sage-dim)] hover:text-[var(--sage)]"}`}>
                {t.icon}{t.label}
                {active && <span className="absolute inset-x-4 -bottom-px h-[2px] rounded-full bg-[var(--gold)]" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        {tab === "improve" && (
          <>
            <MyGameImprove uid={user.uid} />
            <div className="my-12 border-t border-white/[0.08]" />
            <MyGameOverview uid={user.uid} />
          </>
        )}
        {tab === "bag" && <MyGameBag uid={user.uid} />}
      </div>
    </div>
  );
}

export default function MyGamePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <MyGameInner />
    </Suspense>
  );
}
