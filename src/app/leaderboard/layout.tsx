import type { Metadata } from "next";

// Server layout supplies metadata for the client-rendered /leaderboard (self-canonical, non-www).
export const metadata: Metadata = {
  title: "Leaderboard",
  description: "The top disc golfers and course builders on Radius — ranked by Radius Rating, rounds, and contributions.",
  alternates: { canonical: "/leaderboard" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
