import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Radius Disc Golf — Course Directory",
    template: "%s | Radius Disc Golf",
  },
  description:
    "Browse disc golf courses, hole maps, leaderboards, and more. Powered by the Radius community.",
  metadataBase: new URL("https://radiusdiscgolf.com"),
  openGraph: {
    siteName: "Radius Disc Golf",
    type: "website",
    images: ["/logo.svg"],
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
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
