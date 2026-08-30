import type { Metadata } from "next";
import BuildersLeaderboard from "@/components/courses/BuildersLeaderboard";

export const metadata: Metadata = {
  title: "Top Course Builders — Radius",
  description: "The top 25 course builders on Radius — the players mapping disc golf courses for the whole community. See the leaderboard and where you rank.",
  alternates: { canonical: "https://radiusdiscgolf.com/courses/builders" },
};

export default function BuildersPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <BuildersLeaderboard />
    </div>
  );
}
