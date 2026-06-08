"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getNotifications, markAllRead, notifHref, notifVerb, type AppNotification } from "@/lib/notifications";
import { timeAgo } from "@/lib/feed";

const ICON: Record<string, string> = { mention: "@", follow: "+", comment: "💬", reply: "↩", like: "❤" };

export default function NotificationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<AppNotification[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setItems([]); return; }
    getNotifications(user.uid).then((n) => { setItems(n); markAllRead(user.uid); }).catch(() => setItems([]));
  }, [user, loading]);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <div className="mx-auto max-w-2xl px-6 pt-24 pb-16">
        <h1 className="mb-6 font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em]">Notifications</h1>

        {loading || items === null ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
        ) : !user ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-10 text-center">
            <p className="text-[var(--text-body)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to see your notifications.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-12 text-center">
            <div className="text-3xl">🔔</div>
            <p className="mt-3 font-bold">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-[var(--sage-dim)]">Mentions, follows, and replies will show up here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <Link key={n.id} href={notifHref(n)} className={`flex items-center gap-3 rounded-2xl border p-3.5 transition-colors ${n.read ? "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]" : "border-[var(--gold)]/25 bg-[var(--gold)]/[0.06] hover:bg-[var(--gold)]/[0.1]"}`}>
                <span className="relative shrink-0">
                  <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {n.actorPhotoUrl ? <img src={n.actorPhotoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : ((n.actorName && n.actorName !== "Someone" ? n.actorName : n.actorHandle) || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--gold)] text-[11px] font-bold text-[#16221b] ring-2 ring-[var(--bg-deep)]">{ICON[n.type] ?? "•"}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[var(--cream)]"><span className="font-bold">{n.actorName && n.actorName !== "Someone" ? n.actorName : n.actorHandle ? `@${n.actorHandle}` : "Someone"}</span> <span className="text-[var(--text-body)]">{notifVerb(n.type)}</span></p>
                  {n.preview && <p className="mt-0.5 line-clamp-1 text-xs text-[var(--sage-dim)]">“{n.preview}”</p>}
                  <p className="mt-0.5 text-xs text-[var(--sage-dim)]">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--gold)]" />}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
