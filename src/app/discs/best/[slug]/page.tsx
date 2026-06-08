import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllDiscsServer } from "@/lib/discsServer";
import { discSlug, type DiscData } from "@/lib/discs";
import { normCat } from "@/lib/bag";
import DiscCard from "@/components/discs/DiscCard";

type Props = { params: Promise<{ slug: string }> };
const SITE = "https://radiusdiscgolf.com";

interface Guide {
  title: string;
  h1: string;
  intro: string;
  filter: (d: DiscData) => boolean;
  sort: (a: DiscData, b: DiscData) => number;
}
const byName = (a: DiscData, b: DiscData) => a.name.localeCompare(b.name);

const GUIDES: Record<string, Guide> = {
  beginners: {
    title: "Best Disc Golf Discs for Beginners",
    h1: "Best Disc Golf Discs for Beginners",
    intro: "New players fly farther with lighter, slower, understable discs — they go straight without perfect form. These high-glide, easy-to-turn discs are the best place to start.",
    filter: (d) => d.speed <= 9 && d.stability <= 0 && d.glide >= 4,
    sort: (a, b) => b.glide - a.glide || a.speed - b.speed,
  },
  overstable: {
    title: "Most Overstable Disc Golf Discs",
    h1: "Most Overstable Discs",
    intro: "Overstable discs fade hard and reliably — perfect for headwinds, forehands, flex shots, and finishing left (RHBH). These are the most overstable discs in the database.",
    filter: (d) => d.stability >= 2.5,
    sort: (a, b) => b.stability - a.stability,
  },
  understable: {
    title: "Most Understable Disc Golf Discs",
    h1: "Most Understable Discs",
    intro: "Understable discs turn right (RHBH) and finish gently — great for turnovers, rollers, tailwinds, and players with lower arm speed. Here are the most understable discs.",
    filter: (d) => d.stability <= -2,
    sort: (a, b) => a.stability - b.stability,
  },
  putters: {
    title: "Best Disc Golf Putters",
    h1: "Disc Golf Putters",
    intro: "Putters are the most-thrown disc in any bag — for putting and accurate approach shots. Browse every putter with full flight numbers and stability.",
    filter: (d) => normCat(d.category) === "PUTTER",
    sort: byName,
  },
  midranges: {
    title: "Best Disc Golf Midranges",
    h1: "Disc Golf Midranges",
    intro: "Reliable midranges are the discs that lower your scores the fastest — they go where you aim and hold up in wind. Compare every midrange below.",
    filter: (d) => normCat(d.category) === "MIDRANGE",
    sort: byName,
  },
  "fairway-drivers": {
    title: "Best Disc Golf Fairway Drivers",
    h1: "Disc Golf Fairway Drivers",
    intro: "Fairway (control) drivers add distance while staying accurate. They're the bridge between midranges and high-speed distance drivers.",
    filter: (d) => normCat(d.category) === "FAIRWAY",
    sort: byName,
  },
  "distance-drivers": {
    title: "Best Disc Golf Distance Drivers",
    h1: "Disc Golf Distance Drivers",
    intro: "High-speed distance drivers reward arm speed with maximum distance. Browse every distance driver with flight numbers and a flight-path chart.",
    filter: (d) => normCat(d.category) === "DISTANCE",
    sort: byName,
  },
};

export function generateStaticParams() {
  return Object.keys(GUIDES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIDES[slug];
  if (!g) return { title: "Disc Guide" };
  return {
    title: g.title,
    description: g.intro,
    alternates: { canonical: `${SITE}/discs/best/${slug}` },
    openGraph: { title: `${g.title} | Radius Disc Golf`, description: g.intro, type: "website" },
  };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const g = GUIDES[slug];
  if (!g) notFound();
  const discs = getAllDiscsServer().filter(g.filter).sort(g.sort).slice(0, 30);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: g.title,
    numberOfItems: discs.length,
    itemListElement: discs.map((d, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/discs/${discSlug(d)}`, name: `${d.manufacturer} ${d.name}` })),
  };

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="relative overflow-hidden border-b border-black/[0.06]">
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#16221b", opacity: 0.04 }} />
        <div className="relative mx-auto max-w-5xl px-6 pb-8 pt-12">
          <Link href="/discs" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#9a7a3a] hover:underline">← Disc database</Link>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">{g.h1}</h1>
          <p className="mt-3 max-w-2xl text-lg text-[#46554c]">{g.intro}</p>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {discs.length === 0 ? (
          <p className="rounded-2xl border border-black/8 bg-white p-12 text-center text-sm text-[#6b7a70]">No discs found.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{discs.map((d) => <DiscCard key={d.slug} disc={d} />)}</div>
        )}
        <p className="mt-8 text-sm text-[#8a968d]">Flight numbers and stability come from the Radius disc database. Tap any disc to see its flight path and similar options.</p>
      </div>
    </div>
  );
}
