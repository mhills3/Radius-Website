"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getFeed, createPost, getReactionMap, setReaction, getTrendingDiscs, hotScore, type FeedPost, type TrendingDisc, type CourseTag, type DiscTag } from "@/lib/feed";
import CourseTagPicker from "@/components/community/CourseTagPicker";
import DiscTagPicker from "@/components/community/DiscTagPicker";
import UserTagPicker from "@/components/community/UserTagPicker";
import { getLeaderboard, type MentionUser, type LeaderRow } from "@/lib/leaderboard";
import { createNotification } from "@/lib/notifications";
import { uploadPostImage } from "@/lib/postImage";
import { getThreads, getMeetups, getRanksFor, FORUM_CATEGORIES, categoryColor, type Thread, type Meetup, type RankInfo } from "@/lib/community";
import { getFollowingIds, myCanonicalId } from "@/lib/follow";
import PostCard from "@/components/community/PostCard";
import PostDetail from "@/components/community/PostDetail";
import ThreadCard from "@/components/community/ThreadCard";
import ThreadDetail from "@/components/community/ThreadDetail";
import MeetupCard from "@/components/community/MeetupCard";
import HighlightsBar from "@/components/community/HighlightsBar";
import NewThreadModal from "@/components/community/NewThreadModal";
import NewMeetupModal from "@/components/community/NewMeetupModal";

type Tab = "feed" | "forums" | "meetups";
type Sort = "hot" | "new" | "top" | "following";
const card = "rounded-2xl border border-white/[0.07] bg-white/[0.03]";

function reactPost(p: FeedPost, old: string | undefined, type: string): FeedPost {
  const r = { ...(p.reactions ?? {}) };
  let like = p.likeCount;
  if (old === type) { r[type] = Math.max(0, (r[type] ?? 1) - 1); like = Math.max(0, like - 1); }
  else if (old) { r[old] = Math.max(0, (r[old] ?? 1) - 1); r[type] = (r[type] ?? 0) + 1; }
  else { r[type] = (r[type] ?? 0) + 1; like += 1; }
  return { ...p, reactions: r, likeCount: like };
}

function PostSkeleton() {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="flex-1 space-y-2"><div className="h-3 w-28 animate-pulse rounded bg-white/[0.06]" /><div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.04]" /></div>
      </div>
      <div className="mt-3 space-y-2"><div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" /><div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.04]" /></div>
    </div>
  );
}

export default function CommunityPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [ranks, setRanks] = useState<Map<string, RankInfo>>(new Map());
  const [trending, setTrending] = useState<TrendingDisc[]>([]);
  const [topPlayers, setTopPlayers] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reactionMap, setReactionMap] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [taggedCourse, setTaggedCourse] = useState<CourseTag | null>(null);
  const [taggedDisc, setTaggedDisc] = useState<DiscTag | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discPickerOpen, setDiscPickerOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<MentionUser[]>([]);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [sort, setSort] = useState<Sort>("hot");
  const [category, setCategory] = useState("All");
  const [open, setOpen] = useState<FeedPost | null>(null);
  const [openThread, setOpenThread] = useState<Thread | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newThread, setNewThread] = useState(false);
  const [newMeetup, setNewMeetup] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getFeed(20), getThreads(50), getMeetups(30), getTrendingDiscs(8)])
      .then(([p, t, m, tr]) => {
        if (!alive) return;
        setPosts(p); setThreads(t); setMeetups(m); setTrending(tr); setLoading(false);
        if (p.length < 20) setHasMore(false);
        const ids = [...p.map((x) => x.authorId), ...t.map((x) => x.authorId)].filter(Boolean) as string[];
        getRanksFor(ids).then((r) => alive && setRanks(r)).catch(() => {});
      })
      .catch(() => setLoading(false));
    getLeaderboard(6).then((rows) => alive && setTopPlayers(rows)).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (user) {
      getReactionMap(user.uid).then(setReactionMap).catch(() => {});
      myCanonicalId(user.uid).then(getFollowingIds).then(setFollowing).catch(() => {});
    } else { setReactionMap({}); setFollowing(new Set()); }
  }, [user]);

  // infinite scroll
  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  const loadMore = async () => {
    if (loadingMore || !hasMore || tab !== "feed" || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = Math.min(...posts.map((p) => p.createdAt));
      const more = await getFeed(20, cursor);
      const fresh = more.filter((m) => !posts.some((p) => p.id === m.id));
      if (more.length < 20 || fresh.length === 0) setHasMore(false);
      if (fresh.length) {
        setPosts((prev) => [...prev, ...fresh]);
        getRanksFor(fresh.map((m) => m.authorId).filter(Boolean) as string[]).then((r) => setRanks((prev) => new Map([...prev, ...r]))).catch(() => {});
      }
    } finally { setLoadingMore(false); }
  };
  loadMoreRef.current = loadMore;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => { if (e[0].isIntersecting) loadMoreRef.current(); }, { rootMargin: "700px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loading, tab]);

  const sortedPosts = useMemo(() => {
    const a = [...posts];
    if (sort === "new") a.sort((x, y) => y.createdAt - x.createdAt);
    else if (sort === "top") a.sort((x, y) => y.likeCount - x.likeCount);
    else a.sort((x, y) => hotScore(y) - hotScore(x));
    return a;
  }, [posts, sort]);
  // Featured post rotates on a rhythm (every 6h) through the most-engaging posts, so the
  // spotlight isn't always the same post visit-to-visit.
  const featured = useMemo(() => {
    if (!posts.length) return null;
    const ranked = [...posts].sort((a, b) => (b.likeCount + b.commentCount * 2) - (a.likeCount + a.commentCount * 2));
    const pool = ranked.slice(0, Math.min(5, ranked.length));
    const bucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
    return pool[bucket % pool.length];
  }, [posts]);
  const feedList = useMemo(() => {
    if (sort === "following") return sortedPosts.filter((p) => p.authorId && following.has(p.authorId));
    return sortedPosts.filter((p) => !featured || p.id !== featured.id);
  }, [sortedPosts, featured, sort, following]);
  const shownThreads = useMemo(() => {
    const a = category === "All" ? threads : threads.filter((t) => t.category === category);
    return [...a].sort((x, y) => y.score + y.replyCount - (x.score + x.replyCount));
  }, [threads, category]);
  const hotThreads = useMemo(() => [...threads].sort((x, y) => y.score + y.replyCount - (x.score + x.replyCount)).slice(0, 4), [threads]);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }
    e.target.value = "";
  };
  const submitPost = async () => {
    if (!user || (!text.trim() && !imageFile) || posting) return;
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) imageUrl = await uploadPostImage(user.uid, imageFile);
      const post = await createPost(user.uid, text.trim(), { course: taggedCourse ?? undefined, disc: taggedDisc ?? undefined, imageUrl, mentions: taggedUsers });
      if (post) { setPosts((prev) => [post, ...prev]); setText(""); setTaggedCourse(null); setTaggedDisc(null); setImageFile(null); setImagePreview(null); setTaggedUsers([]); }
    } finally { setPosting(false); }
  };
  const onReact = (id: string, type: string) => {
    if (!user) { router.push("/login"); return; }
    const old = reactionMap[id];
    setReactionMap((prev) => { const n = { ...prev }; if (old === type) delete n[id]; else n[id] = type; return n; });
    setPosts((prev) => prev.map((p) => (p.id === id ? reactPost(p, old, type) : p)));
    setOpen((o) => (o && o.id === id ? reactPost(o, old, type) : o));
    setReaction(user.uid, id, type, old).catch(() => { if (user) getReactionMap(user.uid).then(setReactionMap).catch(() => {}); });
    if (!old) { const author = posts.find((p) => p.id === id)?.authorId; if (author) createNotification({ recipientId: author, actor: user.uid, type: "like", postId: id }); }
  };
  const bumpComment = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, commentCount: p.commentCount + 1 } : p)));
    setOpen((o) => (o && o.id === id ? { ...o, commentCount: o.commentCount + 1 } : o));
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "feed", label: "Feed" },
    { key: "forums", label: "Forums" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* hero band */}
      <div className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{ maskImage: "url(/topo.png)", WebkitMaskImage: "url(/topo.png)", maskSize: "cover", WebkitMaskSize: "cover", maskPosition: "center", WebkitMaskPosition: "center", backgroundColor: "var(--cream)", opacity: 0.08 }}
        />
        <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.12),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-5 pt-10">
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">The home of disc golf</div>
            <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">Community</h1>
          </div>
          <div className="mt-5 inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] p-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${tab === t.key ? "bg-[var(--gold)] text-[#16221b]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-7">
        {tab === "feed" && <HighlightsBar />}
        <div className="grid gap-5 lg:grid-cols-[230px_1fr_300px]">
          {/* LEFT RAIL */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              {tab === "feed" && (
                <div className={`${card} p-2`}>
                  {(["hot", "top", "new", "following"] as Sort[]).map((s) => (
                    <button key={s} onClick={() => setSort(s)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${sort === s ? "bg-white/[0.06] text-[var(--cream)]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}><span>{s === "hot" ? "🔥" : s === "top" ? "⭐" : s === "new" ? "🕑" : "👥"}</span>{s === "hot" ? "Hot" : s === "top" ? "Top" : s === "new" ? "Latest" : "Following"}</button>
                  ))}
                </div>
              )}
              {tab === "forums" && (
                <div className={`${card} p-2`}>
                  <div className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">Categories</div>
                  {FORUM_CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setCategory(c)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${category === c ? "bg-white/[0.06] text-[var(--cream)]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{c !== "All" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(c) }} />}{c}</button>
                  ))}
                </div>
              )}
              <div className={`${card} p-4`}>
                <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Hot discussions</div>
                <div className="space-y-3">
                  {hotThreads.map((t) => (
                    <button key={t.id} onClick={() => setOpenThread(t)} className="block w-full text-left">
                      <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cream)] hover:text-[var(--gold)]">{t.title}</div>
                      <div className="mt-0.5 text-xs text-[var(--sage-dim)]">▲ {t.score} · {t.replyCount} repl{t.replyCount === 1 ? "y" : "ies"}</div>
                    </button>
                  ))}
                  {hotThreads.length === 0 && <p className="text-sm text-[var(--sage-dim)]">—</p>}
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER */}
          <div className="min-w-0">
            {tab === "feed" && (
              <div className="space-y-3">
                {user ? (
                  <div className={`${card} p-4`}>
                    <div className="flex gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
                        {profile?.profileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.profileImageUrl} alt="" className="h-9 w-9 object-cover" />
                        ) : ((profile?.name || "?").charAt(0).toUpperCase())}
                      </span>
                      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Share a round, a photo, a gear take…" className="w-full resize-none bg-transparent pt-1.5 text-[15px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none" />
                    </div>
                    {imagePreview && (
                      <div className="relative mt-2 inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imagePreview} alt="" className="max-h-52 rounded-xl object-cover" />
                        <button onClick={() => { setImageFile(null); setImagePreview(null); }} aria-label="Remove photo" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80">✕</button>
                      </div>
                    )}
                    {(taggedCourse || taggedDisc || taggedUsers.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {taggedCourse && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-sm font-semibold text-[var(--gold)]">⛳ {taggedCourse.name}<button onClick={() => setTaggedCourse(null)} aria-label="Remove course" className="text-[var(--gold)]/70 hover:text-[var(--gold)]">✕</button></span>
                        )}
                        {taggedDisc && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-sm font-semibold text-[var(--gold)]">🥏 {taggedDisc.name}<button onClick={() => setTaggedDisc(null)} aria-label="Remove disc" className="text-[var(--gold)]/70 hover:text-[var(--gold)]">✕</button></span>
                        )}
                        {taggedUsers.map((u) => (
                          <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#4d94fa]/15 px-3 py-1 text-sm font-semibold text-[#4d94fa]">@{u.username}<button onClick={() => setTaggedUsers((arr) => arr.filter((x) => x.id !== u.id))} aria-label="Remove tag" className="text-[#4d94fa]/70 hover:text-[#4d94fa]">✕</button></span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1.5">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">📷 Photo<input type="file" accept="image/*" onChange={onPickImage} className="hidden" /></label>
                        <button onClick={() => setUserPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">👤 {taggedUsers.length ? `People (${taggedUsers.length})` : "People"}</button>
                        <button onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">⛳ {taggedCourse ? "Course ✓" : "Course"}</button>
                        <button onClick={() => setDiscPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">🥏 {taggedDisc ? "Disc ✓" : "Disc"}</button>
                      </div>
                      <button onClick={submitPost} disabled={(!text.trim() && !imageFile) || posting} className="rounded-full bg-[var(--gold)] px-6 py-2 text-sm font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{posting ? "Posting…" : "Post"}</button>
                    </div>
                  </div>
                ) : (
                  <div className={`flex items-center gap-3 ${card} px-5 py-4`}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)]">+</span>
                    <p className="text-sm text-[var(--text-body)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to share a round or join the conversation.</p>
                  </div>
                )}
                {pickerOpen && <CourseTagPicker onSelect={setTaggedCourse} onClose={() => setPickerOpen(false)} />}
                {discPickerOpen && <DiscTagPicker onSelect={setTaggedDisc} onClose={() => setDiscPickerOpen(false)} />}
                {userPickerOpen && <UserTagPicker exclude={taggedUsers.map((u) => u.id)} onSelect={(u) => { setTaggedUsers((arr) => (arr.some((x) => x.id === u.id) ? arr : [...arr, u])); setText((t) => `${t}${t && !/\s$/.test(t) ? " " : ""}@${u.username} `); }} onClose={() => setUserPickerOpen(false)} />}

                {loading && [0, 1, 2].map((i) => <PostSkeleton key={i} />)}

                {sort === "following" && !user && <p className={`${card} p-8 text-center text-sm text-[var(--sage-dim)]`}><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to see rounds from players you follow.</p>}
                {sort === "following" && user && !loading && feedList.length === 0 && <p className={`${card} p-8 text-center text-sm text-[var(--sage-dim)]`}>You&apos;re not following anyone with posts yet. Find players on the <Link href="/leaderboard" className="font-bold text-[var(--gold)] hover:underline">leaderboard</Link> and tap Follow.</p>}

                {sort !== "following" && !loading && featured && (
                  <div className="relative rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/[0.05] p-px">
                    <div className="absolute -top-2.5 left-4 z-10 rounded-full bg-[var(--gold)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#16221b]">📌 Featured</div>
                    <PostCard post={featured} rank={featured.authorId ? ranks.get(featured.authorId) : undefined} myReaction={reactionMap[featured.id]} onReact={(t) => onReact(featured.id, t)} onOpen={() => setOpen(featured)} />
                  </div>
                )}

                {sort !== "following" && !loading && feedList.length === 0 && !featured && <p className={`${card} p-8 text-center text-sm text-[var(--sage-dim)]`}>No posts yet.</p>}
                {!loading && feedList.map((p) => (
                  <PostCard key={p.id} post={p} rank={p.authorId ? ranks.get(p.authorId) : undefined} myReaction={reactionMap[p.id]} onReact={(t) => onReact(p.id, t)} onOpen={() => setOpen(p)} />
                ))}
                {!loading && <div ref={sentinel} className="h-1" />}
                {loadingMore && <PostSkeleton />}
                {!loading && !hasMore && feedList.length > 4 && <p className="py-4 text-center text-xs text-[var(--sage-dim)]">You&apos;re all caught up 🥏</p>}
              </div>
            )}

            {tab === "forums" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--sage-dim)]">{shownThreads.length} thread{shownThreads.length === 1 ? "" : "s"}{category !== "All" ? ` in ${category}` : ""}</span>
                  <button onClick={() => (user ? setNewThread(true) : router.push("/login"))} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 py-2 text-xs font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>New thread
                  </button>
                </div>
                {loading && [0, 1, 2].map((i) => <PostSkeleton key={i} />)}
                {!loading && shownThreads.length === 0 && <p className={`${card} p-8 text-center text-sm text-[var(--sage-dim)]`}>No threads in {category}. Start one!</p>}
                {!loading && shownThreads.map((t) => (
                  <ThreadCard key={t.id} thread={t} rank={t.authorId ? ranks.get(t.authorId) : undefined} onOpen={() => setOpenThread(t)} />
                ))}
              </div>
            )}

            {tab === "meetups" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--sage-dim)]">{meetups.length} upcoming</span>
                  <button onClick={() => (user ? setNewMeetup(true) : router.push("/login"))} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 py-2 text-xs font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Host a meetup
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {loading && [0, 1].map((i) => <div key={i} className={`h-44 animate-pulse ${card}`} />)}
                  {!loading && meetups.length === 0 && <p className={`${card} p-8 text-center text-sm text-[var(--sage-dim)] sm:col-span-2`}>No meetups yet — host the first.</p>}
                  {!loading && meetups.map((m) => <MeetupCard key={m.id} meetup={m} />)}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT RAIL */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className={`${card} p-4`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">🏆 Top players</span>
                  <Link href="/leaderboard" className="text-[11px] font-bold text-[var(--gold)] hover:underline">View all →</Link>
                </div>
                <div className="space-y-3">
                  {topPlayers.length === 0 && <p className="text-sm text-[var(--sage-dim)]">—</p>}
                  {topPlayers.map((p, i) => {
                    const inner = (
                      <>
                        <span className="w-3 shrink-0 text-xs font-bold text-[var(--gold)]">{i + 1}</span>
                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.photo ? <img src={p.photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : p.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-[var(--cream)]">{p.name}</span>
                          <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${p.color}22`, color: p.color }}>{p.tier}</span>
                        </div>
                        <span className="text-xs font-bold text-[var(--text-body)]">{p.gameIQ}</span>
                      </>
                    );
                    return p.username ? (
                      <Link key={p.id + i} href={`/u/${p.username}`} className="flex items-center gap-3 rounded-lg -mx-1 px-1 py-0.5 hover:bg-white/[0.04]">{inner}</Link>
                    ) : (
                      <div key={p.id + i} className="flex items-center gap-3">{inner}</div>
                    );
                  })}
                </div>
              </div>
              <div className={`${card} p-4`}>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">🔥 Trending discs</div>
                {trending.length === 0 ? <p className="text-sm text-[var(--sage-dim)]">—</p> : (
                  <div className="space-y-2.5">
                    {trending.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-3"><span className="w-3 shrink-0 text-xs font-bold text-[var(--gold)]">{i + 1}</span><span className="flex-1 truncate text-sm font-semibold text-[var(--cream)]">{d.name}</span><span className="text-xs text-[var(--sage-dim)]">{d.throws.toLocaleString()}</span></div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-[var(--bg-mid)] p-5">
                <div className="font-[family-name:var(--font-heading)] text-lg font-bold">Your hub for disc golf</div>
                <p className="mt-1 text-sm text-[var(--text-body)]">Rounds, gear talk, forums, and meetups — all in one place.</p>
                {!user && <Link href="/login" className="mt-4 inline-block rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#16221b] hover:bg-[var(--gold-bright)]">Join free</Link>}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {open && <PostDetail post={open} uid={user?.uid} myReaction={reactionMap[open.id]} onReact={(t) => onReact(open.id, t)} onClose={() => setOpen(null)} onCommented={() => bumpComment(open.id)} />}
      {openThread && <ThreadDetail thread={openThread} rank={openThread.authorId ? ranks.get(openThread.authorId) : undefined} uid={user?.uid} onClose={() => setOpenThread(null)} />}
      {newThread && user && <NewThreadModal uid={user.uid} onCreated={(t) => { setThreads((prev) => [t, ...prev]); setNewThread(false); setTab("forums"); setOpenThread(t); }} onClose={() => setNewThread(false)} />}
      {newMeetup && user && <NewMeetupModal uid={user.uid} onCreated={(m) => { setMeetups((prev) => [m, ...prev]); setNewMeetup(false); }} onClose={() => setNewMeetup(false)} />}
    </div>
  );
}
