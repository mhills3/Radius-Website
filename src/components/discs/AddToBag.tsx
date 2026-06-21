"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getBagNames } from "@/lib/bag";
import { addDiscToBag } from "@/lib/bagWrite";

/**
 * "Add to bag" action on the disc detail page — shown only to logged-in visitors (the logged-out
 * CTA is DiscBagCta). Appends a fresh bag entry by name, matching the apps' bag write.
 */
export default function AddToBag({ discName }: { discName: string }) {
  const { user, loading } = useAuth();
  const [inBag, setInBag] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getBagNames(user.uid)
      .then((names) => { if (alive && names.some((n) => n.toLowerCase() === discName.toLowerCase())) setInBag(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user, discName]);

  if (loading || !user) return null;

  const add = async () => {
    setBusy(true);
    try {
      await addDiscToBag(user.uid, discName);
      setInBag(true);
    } catch {
      /* leave button enabled to retry */
    }
    setBusy(false);
  };

  if (inBag) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#5fb87a]/35 bg-[#5fb87a]/10 p-5 text-center">
        <div className="inline-flex items-center gap-1.5 font-[family-name:var(--font-heading)] text-base font-bold text-[#2e6b44]">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          {discName} is in your bag
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs">
          <Link href="/bag" className="font-bold text-[#16221b] underline-offset-2 hover:underline">View my bag</Link>
          <button onClick={add} disabled={busy} className="font-semibold text-[#46554c] hover:text-[#16221b] disabled:opacity-60">{busy ? "Adding…" : "Add another"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 p-5 text-center">
      <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight">Bag the {discName}</h3>
      <p className="mx-auto mt-1 text-xs text-[#46554c]">Add it to your bag to track it, compare flights &amp; get shot guidance.</p>
      <button onClick={add} disabled={busy} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#16221b] px-6 py-2.5 text-sm font-bold text-[var(--cream)] transition-colors hover:bg-[#22332a] disabled:opacity-60">
        {busy ? "Adding…" : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            Add to bag
          </>
        )}
      </button>
    </div>
  );
}
