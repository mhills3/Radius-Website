import type { Metadata } from "next";

// Server layout supplies metadata for the client-rendered /discs index (self-canonical, non-www).
export const metadata: Metadata = {
  title: "Disc Golf Discs",
  description: "Compare disc golf discs — flight numbers, stability, and what real players bag. Find the right disc on Radius.",
  alternates: { canonical: "/discs" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
