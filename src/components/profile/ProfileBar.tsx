"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProfileHidden, setProfileHidden } from "@/lib/leaderboard";

export default function ProfileBar({ uid, username }: { uid: string; username?: string }) {
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProfileHidden(uid).then(setHidden).catch(() => setHidden(false));
  }, [uid]);

  const toggle = async () => {
    if (hidden === null || busy) return;
    const next = !hidden;
    setBusy(true); setHidden(next);
    try { await setProfileHidden(uid, next); } catch { setHidden(!next); } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-2 text-xs text-[var(--sage-dim)]">
      <span>Public profile</span>
      <button onClick={toggle} disabled={hidden === null || busy} role="switch" aria-checked={hidden === false} className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${hidden === false ? "bg-[var(--gold)]" : "bg-white/15"}`}>
        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${hidden === false ? "translate-x-[14px]" : "translate-x-0.5"}`} />
      </button>
      {username && !hidden && <Link href={`/u/${username}`} className="font-bold text-[var(--gold)] hover:underline">View →</Link>}
    </div>
  );
}
