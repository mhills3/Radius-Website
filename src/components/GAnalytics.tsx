"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

// Both GA4 properties the site feeds (matches the old site's dual-tag):
//  - G-JWD14Z58WV : Firebase radius-dg web stream (cross-platform analytics)
//  - G-GMRDWK3DLM : the standalone "Radius Website" GA4 property
const GA_IDS = ["G-JWD14Z58WV", "G-GMRDWK3DLM"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { gtag?: (...args: any[]) => void; dataLayer?: any[] } }

function PageViews() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (typeof window === "undefined" || !window.gtag) return;
    const qs = search?.toString();
    const path = pathname + (qs ? `?${qs}` : "");
    // No send_to → the page_view reaches every configured property.
    window.gtag("event", "page_view", { page_path: path, page_location: window.location.href, page_title: document.title });
  }, [pathname, search]);
  return null;
}

export default function GAnalytics() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_IDS[0]}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        ${GA_IDS.map((id) => `gtag('config', '${id}', { send_page_view: false });`).join("\n        ")}
      `}</Script>
      <Suspense fallback={null}><PageViews /></Suspense>
    </>
  );
}
