import Hero from "@/components/home/Hero";
import HubStats from "@/components/home/HubStats";
import CommunityBand from "@/components/home/CommunityBand";
import Ecosystem from "@/components/home/Ecosystem";
import CoursesStrip from "@/components/home/CoursesStrip";
import DownloadBand from "@/components/home/DownloadBand";
import JoinCTA from "@/components/home/JoinCTA";
import type { Metadata } from "next";

// Self-canonical so Google consolidates on the apex (non-www) homepage.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Regenerate hourly so the server-fetched hub stats (courses / disc golfers) stay close to live.
export const revalidate = 3600;

export default function Home() {
  return (
    <>
      <Hero />
      <HubStats />
      <CommunityBand />
      <Ecosystem />
      <CoursesStrip />
      <DownloadBand />
      <JoinCTA />
    </>
  );
}
