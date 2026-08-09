import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getThreadByIdSEO, getThreadRepliesSEO } from "@/lib/postsServer";
import ThreadDiscussion from "./ThreadDiscussion";

type Props = { params: Promise<{ id: string }> };
const SITE = "https://radiusdiscgolf.com";
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
const CAT_COLORS: Record<string, string> = { "Disc Advice": "#8b5cf6", "Course Talk": "#5fb87a", "Form Check": "#3b82f6", Tournament: "#F6C165", "Deals & Trade": "#ea8b3a", Memes: "#ec4899", "Rules Q&A": "#10b981", General: "#9aa6b2" };
const catColor = (c: string) => CAT_COLORS[c] ?? "#9aa6b2";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getThreadByIdSEO(id).catch(() => null);
  if (!t) return { title: "Discussion", description: "A disc golf discussion on Radius." };
  const description = (t.body.trim() || `${t.category} discussion on the Radius disc golf forum.`).slice(0, 160);
  const img = t.imageUrl || t.authorPhotoUrl;
  return {
    title: t.title,
    description,
    alternates: { canonical: `${SITE}/community/thread/${id}` },
    openGraph: { title: `${t.title} | Radius Disc Golf`, description, type: "article", images: img ? [img] : undefined },
    twitter: { card: img ? "summary_large_image" : "summary", title: `${t.title} | Radius Disc Golf`, description, images: img ? [img] : undefined },
  };
}

export default async function ThreadPage({ params }: Props) {
  const { id } = await params;
  const t = await getThreadByIdSEO(id).catch(() => null);
  if (!t) notFound();
  const replies = await getThreadRepliesSEO(id).catch(() => []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: t.title,
    articleBody: t.body || undefined,
    url: `${SITE}/community/thread/${id}`,
    ...(t.createdAt ? { datePublished: new Date(t.createdAt).toISOString() } : {}),
    author: { "@type": "Person", name: t.authorName },
    articleSection: t.category,
    ...(t.imageUrl ? { image: t.imageUrl } : {}),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: t.score },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: t.replyCount },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/ViewAction", userInteractionCount: t.viewCount },
    ],
    ...(replies.length ? { comment: replies.map((r) => ({ "@type": "Comment", text: r.text, author: { "@type": "Person", name: r.authorName }, ...(r.createdAt ? { datePublished: new Date(r.createdAt).toISOString() } : {}) })) } : {}),
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/community?tab=forums" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gold)] hover:underline">← Forums</Link>

        <article className="mt-6">
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ background: `${catColor(t.category)}26`, color: catColor(t.category) }}>{t.category}</span>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-extrabold leading-tight tracking-[-0.02em]">{t.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-[var(--sage-dim)]">
            <Avatar url={t.authorPhotoUrl} name={t.authorName} size={28} />
            <span className="font-semibold text-[var(--text-body)]">{t.authorName}</span>
            <span>· {fmtDate(t.createdAt)}</span>
          </div>
          {t.body && <p className="mt-4 whitespace-pre-wrap text-[17px] leading-relaxed text-[var(--text-body)]">{t.body}</p>}
          {t.imageUrl && (
            <div className="mt-4 overflow-hidden rounded-xl bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.imageUrl} alt="" className="max-h-[560px] w-full object-cover" />
            </div>
          )}
        </article>

        <ThreadDiscussion threadId={id} initialScore={t.score} initialReplyCount={t.replyCount} opId={t.authorId} />
      </div>
    </div>
  );
}

function Avatar({ url, name, size = 44 }: { url?: string; name: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] font-bold text-[var(--cream)] ring-1 ring-white/10" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
