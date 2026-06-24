import type { Metadata } from "next";

// Server layout supplies metadata for the client-rendered /community index (self-canonical, non-www).
export const metadata: Metadata = {
  title: "Community",
  description: "See what disc golfers are posting, sharing, and discussing across the Radius community.",
  alternates: { canonical: "/community" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
