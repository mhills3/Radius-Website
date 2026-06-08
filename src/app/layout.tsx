import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import AuthProvider from "@/components/AuthProvider";
import GAnalytics from "@/components/GAnalytics";
import MobileAppBar from "@/components/MobileAppBar";

const SITE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://radiusdiscgolf.com/#org",
      name: "Radius Disc Golf",
      url: "https://radiusdiscgolf.com",
      logo: "https://radiusdiscgolf.com/apple-icon.png",
      sameAs: [
        "https://apps.apple.com/us/app/radius-disc-golf/id6760574186",
        "https://play.google.com/store/apps/details?id=com.michaelhills.radiusandroid",
      ],
    },
    {
      "@type": "WebSite",
      "@id": "https://radiusdiscgolf.com/#website",
      url: "https://radiusdiscgolf.com",
      name: "Radius Disc Golf",
      publisher: { "@id": "https://radiusdiscgolf.com/#org" },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: "https://radiusdiscgolf.com/courses?search={search_term_string}" },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Radius — The home of disc golf",
    template: "%s | Radius Disc Golf",
  },
  description:
    "Track your rounds, sharpen your game, discover courses, and connect with the disc golf community — your whole game in one place, on every device.",
  metadataBase: new URL("https://radiusdiscgolf.com"),
  applicationName: "Radius Disc Golf",
  itunes: { appId: "6760574186" },
  keywords: [
    "disc golf",
    "disc golf app",
    "disc golf courses",
    "disc golf stats",
    "Radius disc golf",
    "disc golf community",
  ],
  openGraph: {
    siteName: "Radius Disc Golf",
    title: "Radius — The home of disc golf",
    description:
      "Your whole disc golf game in one place — courses, stats, your bag, and the community.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Radius — The home of disc golf",
    description:
      "Your whole disc golf game in one place — courses, stats, your bag, and the community.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSONLD) }} />
        <GAnalytics />
        <AuthProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileAppBar />
        </AuthProvider>
      </body>
    </html>
  );
}
