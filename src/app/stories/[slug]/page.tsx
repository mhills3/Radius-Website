import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getAllPosts, blogCatColor } from "@/lib/blog";
import { getStoryBySlugServer } from "@/lib/storiesServer";
import ArticleBody from "@/components/blog/ArticleBody";

type Props = { params: Promise<{ slug: string }> };
const SITE = "https://radiusdiscgolf.com";

interface Resolved { title: string; excerpt: string; category: string; body: string; tags: string[]; author: string; dateMs: number; coverUrl?: string }

async function resolve(slug: string): Promise<Resolved | null> {
  const live = await getStoryBySlugServer(slug).catch(() => null);
  if (live) return { title: live.title, excerpt: live.excerpt, category: live.category, body: live.body, tags: live.tags, author: live.author, dateMs: live.dateMs, coverUrl: live.coverUrl };
  const seed = getPostBySlug(slug);
  if (seed) return { title: seed.title, excerpt: seed.excerpt, category: seed.category, body: seed.body, tags: seed.tags, author: seed.author, dateMs: new Date(seed.date + "T12:00:00").getTime() };
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await resolve(slug);
  if (!post) return { title: "Story" };
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `${SITE}/stories/${slug}` },
    openGraph: { title: `${post.title} | Radius Disc Golf`, description: post.excerpt, type: "article", publishedTime: new Date(post.dateMs).toISOString(), images: post.coverUrl ? [post.coverUrl] : undefined },
    twitter: { card: "summary_large_image", title: `${post.title} | Radius Disc Golf`, description: post.excerpt, images: post.coverUrl ? [post.coverUrl] : undefined },
    keywords: post.tags,
  };
}

const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const post = await resolve(slug);
  if (!post) notFound();
  const related = getAllPosts().filter((p) => p.slug !== slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: new Date(post.dateMs).toISOString(),
    author: { "@type": "Person", name: post.author },
    publisher: { "@type": "Organization", name: "Radius Disc Golf", logo: { "@type": "ImageObject", url: `${SITE}/apple-icon.png` } },
    mainEntityOfPage: `${SITE}/stories/${slug}`,
    articleSection: post.category,
    ...(post.coverUrl ? { image: post.coverUrl } : {}),
    keywords: post.tags.join(", "),
  };

  return (
    <div className="min-h-screen bg-[#faf8f3] text-[#16221b]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="relative overflow-hidden" style={post.coverUrl ? undefined : { background: `linear-gradient(135deg, ${blogCatColor(post.category)}, #16221b)` }}>
        {post.coverUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(15,24,19,0.92),rgba(15,24,19,0.45))]" />
          </>
        )}
        <div className="relative mx-auto max-w-3xl px-6 pb-10 pt-10 text-white">
          <Link href="/stories" className="inline-flex items-center gap-1.5 text-sm font-bold text-white/90 hover:text-white">← Stories</Link>
          <span className="mt-5 inline-block rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur">{post.category}</span>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-tight tracking-[-0.02em] md:text-[2.6rem]">{post.title}</h1>
          <div className="mt-3 text-sm text-white/80">By {post.author} · {fmtDate(post.dateMs)}</div>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-6 py-10">
        <ArticleBody markdown={post.body} />
        {post.tags.length > 0 && <div className="mt-10 flex flex-wrap gap-2">{post.tags.map((t) => <span key={t} className="rounded-full bg-black/[0.05] px-3 py-1 text-xs font-medium text-[#46554c]">#{t}</span>)}</div>}
        <div className="mt-10 overflow-hidden rounded-3xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 p-8 text-center">
          <h3 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight">Put it into practice with <span className="text-[#9a7a3a]">Radius</span></h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#46554c]">Track rounds, scan your bag, find courses, and watch your Radius Rating climb.</p>
          <Link href="/login" className="mt-5 inline-block rounded-full bg-[#16221b] px-8 py-3.5 text-sm font-bold text-[var(--cream)] transition-all hover:-translate-y-0.5 hover:bg-[#22332a]">Create your free account</Link>
        </div>
      </article>

      {related.length > 0 && (
        <div className="mx-auto max-w-3xl px-6 pb-16">
          <h2 className="mb-4 font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight">Keep reading</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((p) => (
              <Link key={p.slug} href={`/stories/${p.slug}`} className="group rounded-2xl border border-black/8 bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: blogCatColor(p.category) }}>{p.category}</span>
                <h3 className="mt-1 font-[family-name:var(--font-heading)] text-sm font-bold leading-snug group-hover:text-[#9a7a3a]">{p.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
