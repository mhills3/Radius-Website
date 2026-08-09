"use client";

import { useEffect, useState } from "react";
import { getProfilePhotos } from "@/lib/feed";

/** Avatar that backfills a missing photo from the author's current profile — many older thread and
 *  reply docs never stored authorPhotoUrl, so without this they'd show a bare initial. */
export default function ForumAvatar({ url, name, authorId, size = 32 }: { url?: string; name: string; authorId?: string; size?: number }) {
  const [fetched, setFetched] = useState<string | undefined>(undefined);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (url || !authorId) return;
    let dead = false;
    getProfilePhotos([authorId]).then((m) => { const p = m.get(authorId); if (!dead && p) setFetched(p); }).catch(() => {});
    return () => { dead = true; };
  }, [url, authorId]);
  const photo = broken ? undefined : (url ?? fetched);
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] font-bold text-[var(--cream)] ring-1 ring-white/10" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
