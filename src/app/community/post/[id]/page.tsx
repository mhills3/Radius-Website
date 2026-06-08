import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostById, getPostComments } from "@/lib/postsServer";
import PostInteractions from "./PostInteractions";

type Props = { params: Promise<{ id: string }> };
const SITE = "https://radiusdiscgolf.com";
const fmtScore = (n: number) => (n === 0 ? "E" : n > 0 ? `+${n}` : `${n}`);
const fmtDate = (ms: number) => (ms ? new Date(ms).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
const titleOf = (text: string, author: string) => {
  const t = text.trim().replace(/\s+/g, " ");
  if (!t) return `${author} shared a post`;
  const firstSentence = t.split(/(?<=[.!?])\s/)[0];
  return (firstSentence.length <= 80 ? firstSentence : t.slice(0, 77) + "…");
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostById(id).catch(() => null);
  if (!post) return { title: "Post", description: "A post from the Radius disc golf community." };
  const title = titleOf(post.text, post.authorName);
  const description = (post.text.trim() || `${post.authorName} on Radius — disc golf community.`).slice(0, 160);
  const img = post.imageUrl || post.authorPhotoUrl;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/community/post/${id}` },
    openGraph: { title: `${title} | Radius Disc Golf`, description, type: "article", images: img ? [img] : undefined },
    twitter: { card: img ? "summary_large_image" : "summary", title: `${title} | Radius Disc Golf`, description, images: img ? [img] : undefined },
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPostById(id).catch(() => null);
  if (!post) notFound();
  const comments = await getPostComments(id).catch(() => []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: titleOf(post.text, post.authorName),
    articleBody: post.text || undefined,
    url: `${SITE}/community/post/${id}`,
    ...(post.createdAt ? { datePublished: new Date(post.createdAt).toISOString() } : {}),
    author: { "@type": "Person", name: post.authorName },
    ...(post.imageUrl ? { image: post.imageUrl } : {}),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: post.likeCount },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: post.commentCount },
    ],
    ...(comments.length ? { comment: comments.map((c) => ({ "@type": "Comment", text: c.text, author: { "@type": "Person", name: c.authorName }, ...(c.createdAt ? { datePublished: new Date(c.createdAt).toISOString() } : {}) })) } : {}),
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/community" className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gold)] hover:underline">← Community</Link>

        <article className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <div className="flex items-center gap-3">
            <Avatar url={post.authorPhotoUrl} name={post.authorName} />
            <div>
              <div className="font-bold">{post.authorName}</div>
              <div className="text-xs text-[var(--sage-dim)]">{post.authorHandle ? `@${post.authorHandle} · ` : ""}{fmtDate(post.createdAt)}</div>
            </div>
          </div>

          {post.text && <p className="mt-4 whitespace-pre-wrap text-[17px] leading-relaxed text-[var(--text-body)]">{post.text}</p>}

          {post.linkedCourseName && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gold-dim)] text-lg text-[var(--gold)]">⛳</span>
              <div className="min-w-0 flex-1"><div className="truncate font-bold">{post.linkedCourseName}</div><div className="text-xs text-[var(--sage-dim)]">Round</div></div>
              {post.scoreToPar != null && <span className="font-[family-name:var(--font-heading)] text-2xl font-extrabold" style={{ color: post.scoreToPar < 0 ? "#5fcf80" : "var(--cream)" }}>{fmtScore(post.scoreToPar)}</span>}
            </div>
          )}
          {post.taggedDiscName && <div className="mt-3 inline-flex rounded-full bg-white/[0.05] px-3 py-1.5 text-sm text-[var(--text-body)]">🥏 {post.taggedDiscName}</div>}
          {post.imageUrl && (
            <div className="mt-4 overflow-hidden rounded-xl bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.imageUrl} alt="" className="max-h-[560px] w-full object-cover" />
            </div>
          )}

          <div className="mt-4 flex items-center gap-5 border-t border-white/[0.06] pt-3 text-sm text-[var(--sage)]">
            <span>❤️ {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</span>
            <span>💬 {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}</span>
          </div>
        </article>

        <section className="mt-6">
          <h2 className="mb-3 font-[family-name:var(--font-heading)] text-lg font-bold">{comments.length} {comments.length === 1 ? "comment" : "comments"}</h2>
          <div className="space-y-4">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar name={c.authorName} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-white/[0.05] px-3.5 py-2.5">
                    <div className="text-sm font-bold">{c.authorName}{c.authorHandle ? <span className="ml-1.5 text-xs font-normal text-[var(--sage-dim)]">@{c.authorHandle}</span> : null}</div>
                    <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text-body)]">{c.text}</div>
                  </div>
                  <div className="mt-1 pl-1 text-xs text-[var(--sage-dim)]">{fmtDate(c.createdAt)}</div>
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-sm text-[var(--sage-dim)]">No comments yet — be the first.</p>}
          </div>
          <PostInteractions postId={id} likeCount={post.likeCount} />
        </section>
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
