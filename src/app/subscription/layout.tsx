import type { Metadata } from "next";

// Server layout supplies metadata for the client-rendered /subscription page (self-canonical, non-www).
export const metadata: Metadata = {
  title: "Radius Pro",
  description: "Unlock full stats, Radius Rating insights, and bag analysis with Radius Pro.",
  alternates: { canonical: "/subscription" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
