"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

function AppleIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.23 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.15-2.53.99-1.45 1.4-2.85 1.42-2.92-.03-.01-2.72-1.04-2.75-4.13ZM14.6 4.59c.72-.87 1.2-2.08 1.07-3.29-1.03.04-2.28.69-3.02 1.56-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45Z" /></svg>;
}
function PlayIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M3.6 2.4 13 12 3.6 21.6c-.3-.2-.5-.6-.5-1V3.4c0-.4.2-.8.5-1ZM14.2 13.2l2.6 2.6-9.7 5.5 7.1-8.1ZM17.9 9.4l2.7 1.5c.6.4.6 1.3 0 1.7l-2.8 1.6-2.8-2.8 2.9-2ZM7.1 2.4l9.7 5.5-2.6 2.6L7.1 2.4Z" /></svg>;
}

export default function MapleLanding({ appStore, googlePlay, qrSvg }: { appStore: string; googlePlay: string; qrSvg: string }) {
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    // Belt-and-suspenders: the server already redirects phones before this renders, but if one ever
    // lands here (edge cache, in-app browser, prefetch) send it straight to the store anyway.
    if (/iPhone|iPad|iPod/i.test(ua)) {
      window.gtag?.("event", "maple_visit", { source: "maple", platform: "ios" });
      setRedirecting(true);
      window.location.replace(appStore);
      return;
    }
    if (/Android/i.test(ua)) {
      window.gtag?.("event", "maple_visit", { source: "maple", platform: "android" });
      setRedirecting(true);
      window.location.replace(googlePlay);
      return;
    }
    // desktop — count it under the same event so /maple has one clean number
    window.gtag?.("event", "maple_visit", { source: "maple", platform: "desktop" });
  }, [appStore, googlePlay]);

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)] text-[var(--sage)]">
        <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-deep)] px-6 py-16 text-[var(--cream)]">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto h-9 w-[128px] text-[var(--cream)]" />
        <div className="mt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Play smarter, not harder</div>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-black tracking-[-0.02em] sm:text-4xl">Get Radius</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] text-[var(--text-body)]">Your caddy, coach, and disc golf community in one app. It&apos;s a phone app — scan to install.</p>

        {/* Scan-to-install: a phone camera hits /maple and auto-redirects to the right store. This is
            the reliable desktop path — a direct App Store link opens the Mac App Store, where an
            iPhone-only app shows an error. */}
        <div className="mt-8 flex flex-col items-center">
          <div className="rounded-2xl bg-white p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
            <div className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[var(--cream)]">Point your phone camera here</p>
          <p className="text-xs text-[var(--sage-dim)]">It opens your App Store or Google Play automatically.</p>
        </div>

        <div className="mt-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sage-dim)]">Or open a store directly</div>
          <div className="mt-3 flex flex-col gap-3">
            <a href={appStore} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-2.5 rounded-full bg-[var(--gold)] px-6 py-3.5 text-sm font-bold text-[#16221b] shadow-[0_10px_30px_-12px_rgba(246,193,101,0.6)] transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]"><AppleIcon /> App Store</a>
            <a href={googlePlay} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-2.5 rounded-full border border-[var(--hair-strong)] px-6 py-3.5 text-sm font-bold text-[var(--cream)] transition-colors hover:border-[var(--gold)]/50 hover:text-white"><PlayIcon /> Google Play</a>
          </div>
        </div>
      </div>
    </div>
  );
}
