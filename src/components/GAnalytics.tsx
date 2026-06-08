"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

const GA_ID = "G-JWD14Z58WV";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { gtag?: (...args: any[]) => void; dataLayer?: any[] } }

function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return;
    const qs = search?.toString();
    const path = pathname + (qs ? `?${qs}` : "");
    window.gtag("event", "page_view", { page_path: path, page_location: window.location.href, page_title: document.title });
  }, [pathname, search]);
  return null;
}

export default function GAnalytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', '${GA_ID}', { send_page_view: false });
      `}</Script>
      <Suspense fallback={null}><PageViews /></Suspense>
    </>
  );
}
