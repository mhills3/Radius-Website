"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { isFollowing, followUser, unfollowUser, myCanonicalId } from "@/lib/follow";

export default function FollowButton({ targetCanonical }: { targetCanonical: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [self, setSelf] = useState(false);
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!user) { setReady(true); return; }
    (async () => {
      const me = await myCanonicalId(user.uid);
      if (!alive) return;
      if (me === targetCanonical) { setSelf(true); setReady(true); return; }
      const f = await isFollowing(user.uid, targetCanonical);
      if (alive) { setFollowing(f); setReady(true); }
    })();
    return () => { alive = false; };
  }, [user, targetCanonical]);

  if (self) return null;

  const onClick = async () => {
    if (!user) { router.push("/login"); return; }
    if (busy) return;
    const next = !following;
    setBusy(true); setFollowing(next);
    try { next ? await followUser(user.uid, targetCanonical) : await unfollowUser(user.uid, targetCanonical); }
    catch { setFollowing(!next); }
    finally { setBusy(false); }
  };

  return (
    <button onClick={onClick} disabled={busy || (!!user && !ready)} className={`rounded-full px-6 py-2.5 text-sm font-bold transition-colors ${following ? "border border-white/15 bg-white/[0.06] text-[var(--cream)] hover:bg-white/[0.1]" : "bg-[var(--gold)] text-[#16221b] hover:bg-[var(--gold-bright)]"} disabled:opacity-60`}>
      {following ? "✓ Following" : "+ Follow"}
    </button>
  );
}
