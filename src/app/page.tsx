import Hero from "@/components/home/Hero";
import CommunityBand from "@/components/home/CommunityBand";
import Ecosystem from "@/components/home/Ecosystem";
import FeaturedIn from "@/components/home/FeaturedIn";
import CoursesStrip from "@/components/home/CoursesStrip";
import DownloadBand from "@/components/home/DownloadBand";
import JoinCTA from "@/components/home/JoinCTA";
import { getPlayerCountServer, getRegionCountServer, getCourseCountServer } from "@/lib/stats";
import { getFeaturedVideos } from "@/lib/featuredVideos";
import type { Metadata } from "next";

// Self-canonical so Google consolidates on the apex (non-www) homepage.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Regenerate hourly so the server-fetched stats (disc golfers / regions) stay close to live.
export const revalidate = 3600;

export default async function Home() {
  // Fetched server-side (reliable transport) and passed into the courses section — see CoursesStrip.
  const [players, regions, courseCount, featured] = await Promise.all([
    getPlayerCountServer().catch(() => 0),
    getRegionCountServer().catch(() => 0),
    getCourseCountServer().catch(() => 0),
    getFeaturedVideos().catch(() => []),
  ]);
  return (
    <>
      <Hero />
      <CommunityBand playerCount={players} regionCount={regions} />
      <Ecosystem />
      <FeaturedIn videos={featured} />
      <CoursesStrip courseCount={courseCount} />
      <DownloadBand />
      <JoinCTA />
    </>
  );
}
