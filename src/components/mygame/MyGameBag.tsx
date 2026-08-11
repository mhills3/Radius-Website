"use client";

import { useEffect, useState } from "react";
import { getBag, type Bag } from "@/lib/bag";
import BagView from "@/components/bag/BagView";

/** The "My Bag" tab of My Game — the existing bag experience (view-only multi-bag switcher). */
export default function MyGameBag({ uid }: { uid: string }) {
  const [bag, setBag] = useState<Bag | null>(null);
  const [bagId, setBagId] = useState<string | undefined>(undefined);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let alive = true;
    getBag(uid, bagId)
      .then((b) => { if (alive) { setBag(b); setState(b.discs.length ? "ready" : "empty"); } })
      .catch(() => alive && setState("empty"));
    return () => { alive = false; };
  }, [uid, bagId]);

  // Multiple-bags accounts: VIEW-ONLY switcher (never writes the app's active bag).
  const picker = bag && bag.bags.length > 1 ? (
    <div className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-mid)] p-1 ring-1 ring-white/[0.07]">
      {bag.bags.map((b) => {
        const on = b.id === bag.selectedBagId;
        return (
          <button
            key={b.id}
            onClick={() => { if (!on) { setState("loading"); setBagId(b.id); } }}
            title={b.active ? "Active in the Radius app" : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${on ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}
          >
            {b.active && <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[#16221b]/60" : "bg-[var(--gold)]"}`} />}
            {b.name}
            <span className={`text-xs ${on ? "text-[#16221b]/60" : "text-[var(--sage-dim)]"}`}>{b.discCount}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  if (state === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--sage)]">
        <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    );
  }

  if (state === "empty" || !bag) {
    const bagName = bag?.bags.find((b) => b.id === bag?.selectedBagId)?.name;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center text-[var(--cream)]">
        {picker && <div className="mb-8">{picker}</div>}
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-extrabold tracking-[-0.03em]">{bagName ? `${bagName} is empty.` : "Your bag is empty."}</h2>
        <p className="mx-auto mt-3 max-w-md text-[var(--text-body)]">{bag && bag.bags.length > 1 ? "Pick another bag above, or build this one in the Radius app." : "Build your bag in the Radius app and it'll appear here — flight charts, slot coverage, and all."}</p>
      </div>
    );
  }

  return <BagView bag={bag} uid={uid} switcher={picker} />;
}
