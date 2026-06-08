import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, blogCatColor } from "@/lib/blog";
import { getPublishedStories } from "@/lib/storiesServer";
import WriterBar from "@/components/stories/WriterBar";

export const metadata: Metadata = {
  title: "Stories — Disc Golf Tips, Gear & Culture",
  description: "Disc golf tips, gear guides, technique breakdowns, course strategy, and stories from the Radius community. Improve your game and find your next round.",
  alternates: { canonical: "https://radiusdiscgolf.com/stories" },
  openGraph: { title: "Radius Stories — Disc Golf Tips, Gear & Culture", description: "Tips, gear guides, technique, and stories from the disc golf community.", type: "website" },
};

interface Card { slug: string; title: string; excerpt: string; category: string; dateMs: number; readMins: number; author: string; coverUrl?: string }
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");

export default async function StoriesIndex() {
  const live = await getPublishedStories().catch(() => []);
  const seed = getAllPosts();
  const cards: Card[] = [
    ...live.map((s) => ({ slug: s.slug, title: s.title, excerpt: s.excerpt, category: s.category, dateMs: s.dateMs, readMins: s.readMins, author: s.author, coverUrl: s.coverUrl })),
    ...seed.map((p) => ({ slug: p.slug, title: p.title, excerpt: p.excerpt, category: p.category, dateMs: new Date(p.date + "T12:00:00").getTime(), readMins: p.readMins, author: p.author })),
  ].sort((a, b) => b.dateMs - a.dateMs);

  const [feature, ...rest] = cards;
  const Cover = ({ c, h2 }: { c: Card; h2?: boolean }) => (
    <div className="relative h-full w-full overflow-hidden" style={c.coverUrl ? undefined : { background: `linear-gradient(135deg, ${blogCatColor(c.category)}, #16221b)` }}>
      {c.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.coverUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#fff", opacity: 0.12 }} />
      )}
      {h2 && <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <div className="relative overflow-hidden border-b border-black/[0.06]">
        <div className="pointer-events-none absolute inset-0" style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", backgroundColor: "#16221b", opacity: 0.04 }} />
        <div className="relative mx-auto max-w-5xl px-6 pb-8 pt-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a7a3a]">Radius Stories</div>
              <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Disc golf, told well</h1>
              <p className="mt-3 max-w-xl text-lg text-[#46554c]">Tips, gear guides, technique, and stories from the disc golf community — to help you lower your scores and love the game.</p>
            </div>
            <WriterBar />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {feature && (
          <Link href={`/stories/${feature.slug}`} className="group mb-10 block overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.3)]">
            <div className="relative aspect-[21/9] w-full">
              <Cover c={feature} h2 />
              <div className="absolute bottom-5 left-6 right-6 text-white">
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur">{feature.category}</span>
                <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-extrabold drop-shadow md:text-3xl">{feature.title}</h2>
              </div>
            </div>
            <div className="p-6"><p className="text-[#46554c]">{feature.excerpt}</p><div className="mt-3 text-xs text-[#8a968d]">{fmtDate(feature.dateMs)} · {feature.readMins} min read · {feature.author}</div></div>
          </Link>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <Link key={p.slug} href={`/stories/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_rgba(0,0,0,0.25)]">
              <div className="relative aspect-[16/9] w-full">
                <Cover c={p} />
                <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">{p.category}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold leading-snug tracking-tight group-hover:text-[#9a7a3a]">{p.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[#46554c]">{p.excerpt}</p>
                <div className="mt-3 text-xs text-[#8a968d]">{fmtDate(p.dateMs)} · {p.readMins} min read · {p.author}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
