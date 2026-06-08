"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { saveStory, deleteStory, type StoryDoc, STORY_CATEGORIES, readMinsOf } from "@/lib/stories";
import ArticleBody from "@/components/blog/ArticleBody";

export default function StoryEditor({ existing }: { existing?: StoryDoc }) {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? STORY_CATEGORIES[0]);
  const [excerpt, setExcerpt] = useState(existing?.excerpt ?? "");
  const [coverUrl, setCoverUrl] = useState(existing?.coverUrl ?? "");
  const [tags, setTags] = useState((existing?.tags ?? []).join(", "));
  const [body, setBody] = useState(existing?.body ?? "");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

  const field = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[#16221b] outline-none focus:border-[var(--gold)]";

  const save = async (status: "published" | "draft") => {
    if (!user || !title.trim() || busy) return;
    setBusy(true);
    try {
      const s = await saveStory(user.uid, {
        id: existing?.id, slug: existing?.slug, title, excerpt, category, body,
        coverUrl: coverUrl || undefined, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), status,
        createdAt: existing?.createdAt, publishedAt: existing?.publishedAt,
      });
      if (s) router.push(status === "published" ? `/stories/${s.slug}` : "/stories/mine");
      else alert("Couldn't save — make sure your account has writer access.");
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!existing || !confirm("Delete this story? This can't be undone.")) return;
    await deleteStory(existing.id);
    router.push("/stories/mine");
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/stories/mine" className="text-sm font-bold text-[#9a7a3a] hover:underline">← My stories</Link>
        <button onClick={() => setPreview((v) => !v)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#16221b] hover:border-[var(--gold)]">{preview ? "✎ Edit" : "👁 Preview"}</button>
      </div>

      {preview ? (
        <article>
          <span className="inline-block rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#46554c]">{category}</span>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-extrabold tracking-[-0.02em] md:text-4xl">{title || "Untitled story"}</h1>
          <p className="mt-2 text-[#8a968d]">{readMinsOf(body)} min read</p>
          {coverUrl && (
            <div className="mt-5 overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt="" className="max-h-[360px] w-full object-cover" />
            </div>
          )}
          <div className="mt-6"><ArticleBody markdown={body || "_Nothing written yet._"} /></div>
        </article>
      ) : (
        <div className="space-y-4">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Story title" className={`${field} font-[family-name:var(--font-heading)] text-2xl font-extrabold`} />
          <div className="grid gap-4 sm:grid-cols-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>{STORY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma separated)" className={field} />
          </div>
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="Cover image URL (optional)" className={field} />
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} placeholder="Short summary (shown on cards & in search results)" className={`${field} resize-none`} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={20} placeholder={"Write your story…\n\n## Use ## for headings\n### and ### for subheadings\n- dashes for bullet points\n**double asterisks** for bold"} className={`${field} resize-y font-mono text-sm leading-relaxed`} />
          <p className="text-xs text-[#8a968d]">Formatting: <code className="rounded bg-black/5 px-1">## Heading</code> · <code className="rounded bg-black/5 px-1">### Subheading</code> · <code className="rounded bg-black/5 px-1">- bullet</code> · <code className="rounded bg-black/5 px-1">**bold**</code></p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-black/8 pt-6">
        <button onClick={() => save("published")} disabled={!title.trim() || busy} className="rounded-full bg-[var(--gold)] px-7 py-3 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : existing?.status === "published" ? "Update" : "Publish"}</button>
        <button onClick={() => save("draft")} disabled={!title.trim() || busy} className="rounded-full border border-black/10 bg-white px-7 py-3 text-sm font-semibold text-[#16221b] hover:border-[var(--gold)] disabled:opacity-50">Save draft</button>
        {existing && <button onClick={remove} className="ml-auto text-sm font-semibold text-[#dc2626] hover:underline">Delete</button>}
      </div>
    </div>
  );
}
