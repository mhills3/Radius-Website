import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserByUsername } from "@/lib/profileServer";
import { rankForIQ, rankLabel } from "@/lib/rank";
import ProfileView from "@/components/profile/ProfileView";

type Props = { params: Promise<{ username: string }>; searchParams: Promise<{ id?: string }> };
const SITE = "https://radiusdiscgolf.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const u = await getUserByUsername(username).catch(() => null);
  if (!u || u.hidden) return { title: "Player profile", description: "A disc golfer on Radius.", robots: u?.hidden ? { index: false } : undefined };
  const rank = rankForIQ(u.gameIQ);
  const title = `${u.name} (@${u.username}) — Disc Golf Profile`;
  const description = `${u.name} is ${rankLabel(rank)} on Radius${u.gameIQ ? ` with a ${u.gameIQ} Game IQ` : ""}. See their stats, bag, achievements, and recent rounds.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/u/${u.username}` },
    openGraph: { title: `${title} | Radius Disc Golf`, description, type: "profile" },
    twitter: { card: "summary_large_image", title: `${title} | Radius Disc Golf`, description },
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { username } = await params;
  const { id } = await searchParams;
  const u = await getUserByUsername(username, id || undefined).catch(() => null);
  if (!u) notFound();

  if (u.hidden) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--bg-deep)] px-6 text-center text-[var(--cream)]">
        <div className="text-4xl">🔒</div>
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">This profile is private</h1>
        <p className="max-w-sm text-sm text-[var(--text-body)]">@{u.username} has chosen to keep their Radius profile private.</p>
        <Link href="/leaderboard" className="mt-2 text-sm font-bold text-[var(--gold)] hover:underline">← Browse the leaderboard</Link>
      </div>
    );
  }

  const rank = rankForIQ(u.gameIQ);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: { "@type": "Person", name: u.name, alternateName: `@${u.username}`, ...(u.photo ? { image: u.photo } : {}), description: `${rankLabel(rank)} disc golfer on Radius` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProfileView canonicalId={u.id} identity={{ name: u.name, username: u.username, photo: u.photo, bio: u.bio, homeCourseName: u.homeCourseName, homeCourseId: u.homeCourseId }} />
    </>
  );
}
