"use client";

import { Suspense, useEffect } from "react";
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
  const tab: GTab = tabParam === "bag" ? "bag" : "improve"; // Overview is merged into Improve; old ?tab=overview/improve both land here
  const go = (t: GTab) => router.replace(t === "improve" ? "/bag" : `/bag?tab=${t}`, { scroll: false });

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  if (loading || !user) return <Spinner />;

  return (
    <div className="relative min-h-screen text-[var(--cream)]">
      {/* instrument-panel backdrop: deepened forest-black, a fine major/minor technical grid, and real
          film grain so it reads tactile rather than flat-digital — Whoop/cockpit, not a gradient */}
      <div aria-hidden className="pointer-events-none fixed inset-0" style={{
        zIndex: -1,
        backgroundColor: "#0F140F",
        backgroundImage: [
          // major grid (every 170px) — structure
          "repeating-linear-gradient(0deg, rgba(244,241,232,0.03) 0 1px, transparent 1px 170px)",
          "repeating-linear-gradient(90deg, rgba(244,241,232,0.03) 0 1px, transparent 1px 170px)",
          // minor grid (every 34px) — fine ruling
          "repeating-linear-gradient(0deg, rgba(244,241,232,0.016) 0 1px, transparent 1px 34px)",
          "repeating-linear-gradient(90deg, rgba(244,241,232,0.016) 0 1px, transparent 1px 34px)",
        ].join(", "),
      }}>
        <div className="absolute inset-0" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "140px 140px",
          opacity: 0.06,
          mixBlendMode: "overlay",
        }} />
      </div>
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">Your game</div>
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

      <div className="mx-auto max-w-6xl px-6 py-6">
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
