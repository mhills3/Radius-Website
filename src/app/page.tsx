import Hero from "@/components/home/Hero";
import CommunityBand from "@/components/home/CommunityBand";
import Ecosystem from "@/components/home/Ecosystem";
import CoursesStrip from "@/components/home/CoursesStrip";
import DownloadBand from "@/components/home/DownloadBand";
import JoinCTA from "@/components/home/JoinCTA";
import { getPlayerCountServer, getRegionCountServer } from "@/lib/stats";
import type { Metadata } from "next";

// Self-canonical so Google consolidates on the apex (non-www) homepage.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Regenerate hourly so the server-fetched stats (disc golfers / regions) stay close to live.
export const revalidate = 3600;

export default async function Home() {
  // Fetched server-side (reliable transport) and passed into the courses section — see CoursesStrip.
  const [players, regions] = await Promise.all([
    getPlayerCountServer().catch(() => 0),
    getRegionCountServer().catch(() => 0),
  ]);
  return (
    <>
      <Hero />
      <CommunityBand />
      <Ecosystem />
      <CoursesStrip playerCount={players} regionCount={regions} />
      <DownloadBand />
      <JoinCTA />
    </>
  );
}
