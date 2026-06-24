import type { Metadata } from "next";

// Metadata for the (client-rendered) /courses index — client pages can't export metadata, so it
// lives in this server layout: proper title/description + self-canonical (non-www).
export const metadata: Metadata = {
  title: "Disc Golf Courses",
  description: "Browse disc golf courses near you — maps, hole-by-hole layouts, ratings, and leaderboards on Radius.",
  alternates: { canonical: "/courses" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
