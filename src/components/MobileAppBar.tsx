"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const APP_STORE = "https://apps.apple.com/us/app/radius-disc-golf/id6760574186";
const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid";

export default function MobileAppBar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem("radius_appbar_dismissed") === "1");
  }, []);

  // Hide on auth/app surfaces, when signed in, or if dismissed.
  const hidden = dismissed || loading || !!user || ["/login", "/dashboard", "/bag"].includes(pathname);
  if (hidden) return null;

  // Send to the right store based on platform.
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const href = /android/i.test(ua) ? GOOGLE_PLAY : APP_STORE;

  const close = () => { setDismissed(true); try { localStorage.setItem("radius_appbar_dismissed", "1"); } catch {} };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-[var(--bg-deep)]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--bg-mid)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/apple-icon.png" alt="Radius" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-[var(--cream)]">Get the Radius app</div>
          <div className="truncate text-xs text-[var(--sage)]">Track rounds, scan discs & climb the ranks — free.</div>
        </div>
        <a href={href} target="_blank" rel="noopener" className="shrink-0 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-[#16221b]">Get</a>
        <button onClick={close} aria-label="Dismiss" className="shrink-0 p-1 text-[var(--sage)]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>
  );
}
