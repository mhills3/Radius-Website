"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { subscribeUnreadCount } from "@/lib/notifications";

export default function NotificationBell({ onDark }: { onDark?: boolean }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    const unsub = subscribeUnreadCount(user.uid, setCount);
    return unsub;
  }, [user]);

  if (!user) return null;
  return (
    <Link href="/notifications" aria-label="Notifications" className={`relative grid h-9 w-9 place-items-center rounded-full transition-colors ${onDark ? "text-[var(--cream)] hover:bg-white/[0.08]" : "text-[#16221b] hover:bg-black/[0.05]"}`}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--gold)] px-1 text-[10px] font-bold text-[#16221b]">{count > 9 ? "9+" : count}</span>
      )}
    </Link>
  );
}
