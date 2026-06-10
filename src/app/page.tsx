import Hero from "@/components/home/Hero";
import HubStats from "@/components/home/HubStats";
import CommunityBand from "@/components/home/CommunityBand";
import Ecosystem from "@/components/home/Ecosystem";
import CoursesStrip from "@/components/home/CoursesStrip";
import DownloadBand from "@/components/home/DownloadBand";
import JoinCTA from "@/components/home/JoinCTA";

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
