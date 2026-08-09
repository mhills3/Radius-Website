"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getFeed, createPost, ensureSystemPost, softDeleteSystemPost, getReactionMap, setReaction, hotScore, SYSTEM_AUTHOR_ID, type FeedPost, type CourseTag, type DiscTag, type SharedRound } from "@/lib/feed";
import RoundPicker from "@/components/community/RoundPicker";
import { getPlayedCourses } from "@/lib/rounds";
import CourseTagPicker from "@/components/community/CourseTagPicker";
import DiscTagPicker from "@/components/community/DiscTagPicker";
import UserTagPicker from "@/components/community/UserTagPicker";
import { getLeaderboard, getLeaderboardWithRegion, type MentionUser, type LeaderRow, type GeoLeaderRow } from "@/lib/leaderboard";
import { followUser, unfollowUser } from "@/lib/follow";
import { createNotification } from "@/lib/notifications";
import { uploadPostImage } from "@/lib/postImage";
import { getThreads, getMeetups, getRanksFor, FORUM_CATEGORIES, categoryColor, type Thread, type Meetup, type RankInfo } from "@/lib/community";
import { getTopBuilders, getAllCourses, slugify, type Builder, type Course } from "@/lib/courses";
import { getFollowingIds, myCanonicalId } from "@/lib/follow";
import PostCard from "@/components/community/PostCard";
import PostDetail from "@/components/community/PostDetail";
import ThreadCard from "@/components/community/ThreadCard";
import ThreadDetail from "@/components/community/ThreadDetail";
import MeetupCard from "@/components/community/MeetupCard";
import HighlightsBar from "@/components/community/HighlightsBar";
import NewThreadModal from "@/components/community/NewThreadModal";
import NewMeetupModal from "@/components/community/NewMeetupModal";

function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type Tab = "feed" | "forums" | "meetups";
type Sort = "hot" | "new" | "top" | "following";
// One surface system: no borders — elevation from a slightly-lighter fill + a soft ambient shadow, one radius.
const card = "rounded-2xl bg-white/[0.045] shadow-[0_16px_40px_-24px_rgba(0,0,0,0.65)]";

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

// Dense, heavily-darkened, slowly-drifting mosaic of real member/course imagery. Texture only.
function HeroMosaic({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  // Denser tiling (tight gaps, more columns) so complete rows fill the frame and the top isn't
  // awkwardly clipped. Oversized + offset so the slow drift never reveals an edge.
  const tiles = images.length >= 70 ? images : Array.from({ length: 84 }, (_, i) => images[i % images.length]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hero-drift grid h-[150%] w-[120%] grid-cols-8 gap-1 opacity-[0.6] blur-[2px] sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-[repeat(14,minmax(0,1fr))]">
        {tiles.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" loading="lazy" decoding="async" className="aspect-square w-full rounded-md object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
        ))}
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  // Initialize the tab from the URL (?tab=forums) so returning from a thread lands back on Forums,
  // not the feed. The tab is mirrored into the URL below.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "feed" || t === "forums" || t === "meetups") return t as Tab;
    }
    return "feed";
  });
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [ranks, setRanks] = useState<Map<string, RankInfo>>(new Map());
  const [topPlayers, setTopPlayers] = useState<LeaderRow[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [builderRanks, setBuilderRanks] = useState<Map<string, RankInfo>>(new Map());
  const [geoRows, setGeoRows] = useState<GeoLeaderRow[]>([]);
  const [improveCourses, setImproveCourses] = useState<Course[]>([]);
  const [myCid, setMyCid] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [playedNames, setPlayedNames] = useState<Set<string>>(new Set());
  const [composerOpen, setComposerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reactionMap, setReactionMap] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [taggedCourse, setTaggedCourse] = useState<CourseTag | null>(null);
  const [taggedDisc, setTaggedDisc] = useState<DiscTag | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [discPickerOpen, setDiscPickerOpen] = useState(false);
  const [roundPickerOpen, setRoundPickerOpen] = useState(false);
  const [sharedRound, setSharedRound] = useState<SharedRound | null>(null);
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
  // Return mechanics: unread dots on the tabs + a "N new posts" pill.
  const [seen, setSeen] = useState<{ feed: number; forums: number }>({ feed: 0, forums: 0 });
  const [pendingNew, setPendingNew] = useState<FeedPost[]>([]);
  const [scrolledDown, setScrolledDown] = useState(false);

  // Mirror the active tab into the URL (Forums → ?tab=forums) so the browser Back button from a
  // thread returns to the tab you were on, not the feed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = tab === "feed" ? "/community" : `/community?tab=${tab}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [tab]);

  useEffect(() => {
    let alive = true;
    Promise.all([getFeed(20), getThreads(50), getMeetups(30)])
      .then(([p, t, m]) => {
        if (!alive) return;
        setPosts(p); setThreads(t); setMeetups(m); setLoading(false);
        if (p.length < 20) setHasMore(false);
        const ids = [...p.map((x) => x.authorId), ...t.map((x) => x.authorId)].filter(Boolean) as string[];
        getRanksFor(ids).then((r) => alive && setRanks(r)).catch(() => {});
      })
      .catch(() => setLoading(false));
    getLeaderboard(6).then((rows) => alive && setTopPlayers(rows)).catch(() => {});
    // Top builders drive the hero spotlight; their rank photos give avatars for it and the mosaic.
    getTopBuilders(12).then((b) => { if (!alive) return; setBuilders(b); getRanksFor(b.map((x) => x.id).filter(Boolean)).then((r) => alive && setBuilderRanks(r)).catch(() => {}); }).catch(() => {});
    // Right-rail action modules: region-aware players + courses that need a cover.
    getLeaderboardWithRegion(150).then((rows) => alive && setGeoRows(rows)).catch(() => {});
    // Courses that need help: no cover, no reviews, or only one layout. Keep coords for nearest sort.
    getAllCourses().then((cs) => { if (alive) setImproveCourses(cs.filter((c) => c.name && (!c.coverPhotoUrl || !c.reviewCount || Object.keys(c.layoutAverages || {}).length < 2)).slice(0, 1500)); }).catch(() => {});
    // Best-effort current location so "near you" is actually near you (falls back to home-course region).
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => alive && setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
      );
    }
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (user) {
      getReactionMap(user.uid).then(setReactionMap).catch(() => {});
      myCanonicalId(user.uid).then((cid) => { setMyCid(cid); return getFollowingIds(cid); }).then(setFollowing).catch(() => {});
      getPlayedCourses(user.uid).then((m) => setPlayedNames(new Set(m.keys()))).catch(() => {});
    } else { setReactionMap({}); setFollowing(new Set()); setMyCid(null); setPlayedNames(new Set()); }
  }, [user]);
  const toggleFollow = (targetId: string) => {
    if (!user) { router.push("/login"); return; }
    const isFollowing = following.has(targetId);
    setFollowing((prev) => { const n = new Set(prev); if (isFollowing) n.delete(targetId); else n.add(targetId); return n; });
    (isFollowing ? unfollowUser : followUser)(user.uid, targetId).catch(() => setFollowing((prev) => { const n = new Set(prev); if (isFollowing) n.add(targetId); else n.delete(targetId); return n; }));
  };
  // The signed-in player's region (from their leaderboard row) drives the "near you" modules.
  const myRegion = useMemo(() => geoRows.find((r) => r.id === myCid) ?? undefined, [geoRows, myCid]);
  // My anchor point: real geolocation if granted, else my home-course coordinates.
  const myLoc = useMemo(() => userLoc ?? (myRegion?.lat != null && myRegion?.lng != null ? { lat: myRegion.lat, lng: myRegion.lng } : null), [userLoc, myRegion]);
  const playersNearYou = useMemo(() => {
    const pool = geoRows.filter((r) => r.id !== myCid && !following.has(r.id) && r.username);
    if (myLoc) {
      const withDist = pool.filter((r) => r.lat != null && r.lng != null).map((r) => ({ r, d: milesBetween(myLoc, { lat: r.lat!, lng: r.lng! }) })).sort((a, b) => a.d - b.d);
      if (withDist.length >= 3) return withDist.slice(0, 8).map((x) => ({ ...x.r, dist: x.d }));
    }
    // Fallback: same state, then same country (never just one when the region has players).
    const st = myRegion?.state ? pool.filter((r) => r.state === myRegion.state) : [];
    const co = myRegion?.country ? pool.filter((r) => r.country === myRegion.country) : [];
    return (st.length >= 3 ? st : co.length >= 3 ? co : pool).slice(0, 8).map((r) => ({ ...r, dist: undefined as number | undefined }));
  }, [geoRows, myCid, following, myLoc, myRegion]);
  // Courses to improve — a MIX of task types (one clean line each), nearest first. We classify each
  // course by its single most-useful next task, then round-robin across the task buckets so the rail
  // always shows variety: at least one "leave a review", one "add a cover photo", one "add a layout".
  const nearbyImprove = useMemo(() => {
    type Kind = "review" | "cover" | "layout";
    const dist = (c: Course) => (myLoc && c.latitude != null && c.longitude != null ? milesBetween(myLoc, { lat: c.latitude, lng: c.longitude }) : Infinity);
    const classify = (c: Course): { kind: Kind; reason: string; action: string } | null => {
      if (!c.coverPhotoUrl) return { kind: "cover", reason: "Add a cover photo", action: "Add cover" };
      if (!c.reviewCount) return { kind: "review", reason: playedNames.has(c.name.trim().toLowerCase()) ? "You've played here — leave a review" : "Be the first to review it", action: "Review" };
      if (Object.keys(c.layoutAverages || {}).length < 2) return { kind: "layout", reason: "Add an alternate layout", action: "Add layout" };
      return null;
    };
    const buckets: Record<Kind, { c: Course; reason: string; action: string; d: number }[]> = { review: [], cover: [], layout: [] };
    for (const c of improveCourses) { const cl = classify(c); if (cl) buckets[cl.kind].push({ c, ...cl, d: dist(c) }); }
    (Object.keys(buckets) as Kind[]).forEach((k) => buckets[k].sort((a, b) => a.d - b.d));
    // Round-robin across task types so the four slots stay diverse (review → cover → layout → …).
    const order: Kind[] = ["review", "cover", "layout"];
    const idx: Record<Kind, number> = { review: 0, cover: 0, layout: 0 };
    const out: { c: Course; reason: string; action: string; d: number }[] = [];
    while (out.length < 4) {
      let added = false;
      for (const k of order) { if (out.length >= 4) break; if (idx[k] < buckets[k].length) { out.push(buckets[k][idx[k]++]); added = true; } }
      if (!added) break;
    }
    return out;
  }, [improveCourses, playedNames, myLoc]);

  // Load the last-seen marks (per device) so we can show unread dots on the tabs.
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("community_seen") || "{}"); setSeen({ feed: Number(s.feed) || 0, forums: Number(s.forums) || 0 }); } catch { /* ignore */ }
  }, []);
  // Mark the active tab seen (up to its newest item) shortly after viewing it.
  useEffect(() => {
    const newest = tab === "feed" ? posts[0]?.createdAt : tab === "forums" ? threads[0]?.createdAt : undefined;
    if (!newest) return;
    const t = setTimeout(() => setSeen((prev) => { const next = { ...prev, [tab]: Math.max(prev[tab as "feed" | "forums"] ?? 0, newest) }; try { localStorage.setItem("community_seen", JSON.stringify(next)); } catch { /* ignore */ } return next; }), 1500);
    return () => clearTimeout(t);
  }, [tab, posts, threads]);
  // Poll for genuinely newer posts while on the feed; surface them via the pill (never auto-inject).
  useEffect(() => {
    if (tab !== "feed") return;
    const iv = setInterval(async () => {
      if (posts.length === 0) return;
      const top = posts[0].createdAt;
      const latest = await getFeed(6).catch(() => [] as FeedPost[]);
      const fresh = latest.filter((m) => m.createdAt > top && !posts.some((p) => p.id === m.id));
      if (fresh.length) setPendingNew((prev) => [...fresh.filter((f) => !prev.some((p) => p.id === f.id)), ...prev].slice(0, 30));
    }, 30000);
    return () => clearInterval(iv);
  }, [tab, posts]);
  useEffect(() => {
    const onScroll = () => setScrolledDown(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const showNewPosts = () => {
    if (pendingNew.length === 0) return;
    setPosts((prev) => [...pendingNew, ...prev.filter((p) => !pendingNew.some((n) => n.id === p.id))]);
    getRanksFor(pendingNew.map((m) => m.authorId).filter(Boolean) as string[]).then((r) => setRanks((prev) => new Map([...prev, ...r]))).catch(() => {});
    setPendingNew([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const unreadFeed = (posts[0]?.createdAt ?? 0) > seen.feed;
  const unreadForums = (threads[0]?.createdAt ?? 0) > seen.forums;

  // infinite scroll
  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  // Floating "+ Post" / composer bar — open the centered compose modal from anywhere.
  const openComposer = () => { if (!user) { router.push("/login"); return; } setComposerOpen(true); };
  const closeComposer = () => setComposerOpen(false);
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

  // A stable key of WHICH posts exist (ids only). It changes on load / new posts / pagination /
  // removal — but NOT when an existing post's like or comment count changes.
  const postIdsKey = useMemo(() => [...posts.map((p) => p.id)].sort().join("|"), [posts]);
  const postById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  // Radius milestone posts flow through the SAME feed algorithm as everyone else's — sorted by hot
  // score, so they decay with age and don't stay pinned forever.
  //
  // IMPORTANT: the feed ORDER is frozen against likes. We recompute the ranking only when the sort
  // mode or the SET of posts changes (postIdsKey) — never when a post's counts change. So liking a
  // post updates its count in place but never makes it jump/disappear under you; the new ranking
  // takes effect on the next reload. (We intentionally omit `posts` from the deps for this reason.)
  const orderedIds = useMemo(() => {
    const a = [...posts];
    if (sort === "new") a.sort((x, y) => y.createdAt - x.createdAt);
    else if (sort === "top") a.sort((x, y) => y.likeCount - x.likeCount);
    else a.sort((x, y) => hotScore(y) - hotScore(x));
    return a.map((p) => p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, postIdsKey]);
  const sortedPosts = useMemo(() => orderedIds.map((id) => postById.get(id)).filter((p): p is FeedPost => !!p), [orderedIds, postById]);
  // Featured spotlight — WHICH post is featured is frozen the same way (by id, stable across likes);
  // we resolve it to the live post object so its counts still update. Radius system posts aren't
  // eligible (they're not a person's post).
  const featuredId = useMemo(() => {
    const pool0 = posts.filter((p) => !p.isSystem);
    if (!pool0.length) return null;
    const ranked = [...pool0].sort((a, b) => (b.likeCount + b.commentCount * 2) - (a.likeCount + a.commentCount * 2));
    const pool = ranked.slice(0, Math.min(5, ranked.length));
    const bucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
    return pool[bucket % pool.length]?.id ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIdsKey]);
  const featured = useMemo(() => (featuredId ? postById.get(featuredId) ?? null : null), [featuredId, postById]);
  const feedList = useMemo(() => {
    if (sort === "following") return sortedPosts.filter((p) => p.authorId && following.has(p.authorId));
    return sortedPosts.filter((p) => !featured || p.id !== featured.id);
  }, [sortedPosts, featured, sort, following]);
  const shownThreads = useMemo(() => {
    const a = category === "All" ? threads : threads.filter((t) => t.category === category);
    return [...a].sort((x, y) => y.score + y.replyCount - (x.score + x.replyCount));
  }, [threads, category]);
  const hotThreads = useMemo(() => [...threads].sort((x, y) => y.score + y.replyCount - (x.score + x.replyCount)).slice(0, 4), [threads]);

  // Hero mosaic — real avatars + post images + course covers, deduped. Texture only, never readable.
  const mosaicImages = useMemo(() => {
    const urls = new Set<string>();
    topPlayers.forEach((p) => p.photo && urls.add(p.photo));
    builders.forEach((b) => { const ph = builderRanks.get(b.id)?.photo; if (ph) urls.add(ph); });
    posts.forEach((p) => { if (p.authorPhotoUrl) urls.add(p.authorPhotoUrl); if (p.imageUrl) urls.add(p.imageUrl); });
    return [...urls].slice(0, 84);
  }, [topPlayers, builders, builderRanks, posts]);
  // Radius milestone posts — created as REAL `posts` docs with deterministic ids so the first
  // signed-in visitor writes them once (Firestore rules allow any authed write; no server) and
  // everyone else no-ops. Being real posts, they're likeable + commentable like any post.
  //  • The #1-builder card is a LIVE standing: a single `sys_topbuilder` doc that always shows the
  //    exact current leader and their exact course count (kept fresh — that count is what makes them #1).
  //  • A second card celebrates a non-#1 builder who just crossed a round-number tier (25/50/100).
  useEffect(() => {
    if (!user || builders.length === 0) return;
    const top = builders[0];
    if (!top?.username) return;
    let alive = true;
    (async () => {
      const made: FeedPost[] = [];
      const removeIds: string[] = [];
      const lead = await ensureSystemPost({
        id: "sys_topbuilder",
        text: `🏆 @${top.username} is Radius's #1 course builder with ${top.count} courses mapped. Congrats! 🎉`,
        user: { id: top.id, name: top.name, username: top.username },
      }, true); // keepFresh — updates text/tag when the leader or their count changes
      if (lead) made.push(lead);
      // Retire any legacy per-builder "#1" tier card for the current champion (older format baked the
      // #1 claim into a "crossed 100" tier post) — the standing card above now owns that.
      for (const t of [100, 50, 25]) removeIds.push(`sys_builder_${t}_${top.id}`);
      await Promise.all(removeIds.map((id) => softDeleteSystemPost(id)));
      // A non-#1 builder who just crossed a tier — a genuine milestone, frozen at the crossing.
      const tiers = [100, 50, 25];
      for (const b of builders.slice(1)) {
        if (!b.username) continue;
        const t = tiers.find((x) => b.count >= x);
        if (t) {
          const p = await ensureSystemPost({
            id: `sys_builder_${t}_${b.id}`,
            text: `🏗️ @${b.username} just crossed ${t} courses mapped on Radius — a huge contribution to the community!`,
            user: { id: b.id, name: b.name, username: b.username },
          });
          if (p) made.push(p);
          break;
        }
      }
      if (!alive) return;
      setPosts((prev) => {
        const madeById = new Map(made.map((p) => [p.id, p]));
        const kept = prev.filter((p) => !removeIds.includes(p.id) && !madeById.has(p.id));
        return [...made, ...kept];
      });
    })().catch(() => {});
    return () => { alive = false; };
  }, [user, builders]);
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)); }
    e.target.value = "";
  };
  const submitPost = async () => {
    if (!user || (!text.trim() && !imageFile && !sharedRound) || posting) return;
    setPosting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) imageUrl = await uploadPostImage(user.uid, imageFile);
      const post = await createPost(user.uid, text.trim(), { course: taggedCourse ?? undefined, disc: taggedDisc ?? undefined, imageUrl, mentions: taggedUsers, round: sharedRound ?? undefined });
      if (post) { setPosts((prev) => [post, ...prev]); setText(""); setTaggedCourse(null); setTaggedDisc(null); setImageFile(null); setImagePreview(null); setTaggedUsers([]); setSharedRound(null); setComposerOpen(false); }
    } finally { setPosting(false); }
  };
  const onReact = (id: string, type: string) => {
    if (!user) { router.push("/login"); return; }
    const old = reactionMap[id];
    setReactionMap((prev) => { const n = { ...prev }; if (old === type) delete n[id]; else n[id] = type; return n; });
    setPosts((prev) => prev.map((p) => (p.id === id ? reactPost(p, old, type) : p)));
    setOpen((o) => (o && o.id === id ? reactPost(o, old, type) : o));
    setReaction(user.uid, id, type, old).catch(() => { if (user) getReactionMap(user.uid).then(setReactionMap).catch(() => {}); });
    if (!old) { const author = posts.find((p) => p.id === id)?.authorId; if (author && author !== SYSTEM_AUTHOR_ID) createNotification({ recipientId: author, actor: user.uid, type: "like", postId: id }); }
  };
  const bumpComment = (id: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, commentCount: p.commentCount + 1 } : p)));
    setOpen((o) => (o && o.id === id ? { ...o, commentCount: o.commentCount + 1 } : o));
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "feed", label: "Feed" },
    { key: "forums", label: "Forums" },
  ];

  const avatarInitial = (profile?.name || "?").charAt(0).toUpperCase();
  // Ghost icon-button for the composer's attach toolbar; goes gold when its attachment is active.
  const attachBtn = (on: boolean) => `group relative grid h-9 w-9 place-items-center rounded-full transition-colors ${on ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-[var(--sage)] hover:bg-white/[0.07] hover:text-[var(--cream)]"}`;
  // Label that appears on hover above an icon-only attach button.
  const tip = (label: string) => (
    <span className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--bg-mid)] px-2 py-1 text-[11px] font-semibold text-[var(--cream)] opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100">{label}</span>
  );
  // Collapsed entry at the top of the column. On Forums it starts a THREAD (a specific kind of
  // post); on Feed it opens the centered compose modal.
  const onForums = tab === "forums";
  const composerBar = user ? (
    <button onClick={onForums ? () => setNewThread(true) : openComposer} className="flex w-full items-center gap-2.5 border-b border-white/[0.055] py-3.5 text-left">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
        {profile?.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.profileImageUrl} alt="" className="h-9 w-9 object-cover" />
        ) : avatarInitial}
      </span>
      <span className="flex-1 rounded-full bg-white/[0.05] px-4 py-2.5 text-[15px] text-[var(--sage-dim)] transition-colors hover:bg-white/[0.08]">{onForums ? "Start a new thread…" : "What's your disc golf story today?"}</span>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-[#141b16] sm:inline-flex">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>{onForums ? "New thread" : "Post"}
      </span>
    </button>
  ) : (
    <div className="flex items-center gap-2.5 border-b border-white/[0.055] py-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)]">+</span>
      <p className="text-sm text-[var(--text-body)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to {onForums ? "start a thread or join the conversation" : "share a round or join the conversation"}.</p>
    </div>
  );

  // Centered, backdrop-blurred compose modal (opened by the bar or the floating + Post pill).
  const composerModal = composerOpen && user && (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-[fadeIn_0.2s_ease]" onClick={closeComposer} />
      <div className="relative my-auto w-full max-w-xl rounded-3xl border border-white/10 bg-[var(--bg-deep)] p-5 text-[var(--cream)] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)] animate-[fadeIn_0.22s_ease]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold">Create a post</span>
          <button onClick={closeComposer} aria-label="Close" className="rounded-full p-1.5 text-[var(--sage)] hover:bg-white/10 hover:text-[var(--cream)]"><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="flex gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-deep)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
            {profile?.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.profileImageUrl} alt="" className="h-9 w-9 object-cover" />
            ) : avatarInitial}
          </span>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="What's your disc golf story today?" className="min-h-[104px] w-full resize-none bg-transparent pt-1 text-[15px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none" />
        </div>
        {imagePreview && (
          <div className="relative mt-2 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="" className="max-h-52 rounded-xl object-cover" />
            <button onClick={() => { setImageFile(null); setImagePreview(null); }} aria-label="Remove photo" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80">✕</button>
          </div>
        )}
        {sharedRound && (
          <div className="mt-2.5 flex items-center gap-3 overflow-hidden rounded-xl bg-[var(--gold)]/[0.1] p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--bg-deep)] text-lg text-[var(--gold)]">
              {sharedRound.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sharedRound.cover} alt="" className="h-full w-full object-cover" />
              ) : "⛳"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-[var(--cream)]">{sharedRound.courseName}</div>
              <div className="text-xs text-[var(--sage-dim)]">Sharing a round · {sharedRound.holesPlayed} holes{sharedRound.birdies ? ` · ${sharedRound.birdies} birdie${sharedRound.birdies === 1 ? "" : "s"}` : ""}</div>
            </div>
            <span className="font-[family-name:var(--font-heading)] text-xl font-extrabold" style={{ color: sharedRound.scoreToPar < 0 ? "#5fcf80" : sharedRound.scoreToPar === 0 ? "var(--cream)" : "#f08c8c" }}>{sharedRound.scoreToPar === 0 ? "E" : sharedRound.scoreToPar > 0 ? `+${sharedRound.scoreToPar}` : sharedRound.scoreToPar}</span>
            <button onClick={() => setSharedRound(null)} aria-label="Remove round" className="shrink-0 text-[var(--gold)]/70 hover:text-[var(--gold)]">✕</button>
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
              <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-[#8FBDE3]/15 px-3 py-1 text-sm font-semibold text-[#8FBDE3]">@{u.username}<button onClick={() => setTaggedUsers((arr) => arr.filter((x) => x.id !== u.id))} aria-label="Remove tag" className="text-[#8FBDE3]/70 hover:text-[#8FBDE3]">✕</button></span>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1">
            {/* Share a round — the flagship attach, so it keeps a label */}
            <button onClick={() => setRoundPickerOpen(true)} title="Share a round" className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${sharedRound ? "bg-[var(--gold)]/15 text-[var(--gold)]" : "text-[var(--gold)] hover:bg-[var(--gold)]/12"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M5 21V4M5 4h11l-2.2 3.5L16 11H5" /></svg>
              Share a round
            </button>
            <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
            {/* Icon-only attach tools — camera, people, course, disc — each with a hover tooltip */}
            <label aria-label="Add a photo" className={`${attachBtn(!!imageFile)} cursor-pointer`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.4-1.8A1 1 0 0 1 9.2 5h5.6a1 1 0 0 1 .8.4L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /><circle cx="12" cy="13" r="3.2" /></svg>
              <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
              {tip("Add a photo")}
            </label>
            <button onClick={() => setUserPickerOpen(true)} aria-label="Tag people" className={attachBtn(taggedUsers.length > 0)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><circle cx="9" cy="8" r="3.2" /><path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0" /><path d="M16 5.3a3.2 3.2 0 0 1 0 5.9M17.8 13.6a5.8 5.8 0 0 1 3 5.2" /></svg>
              {taggedUsers.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--gold)] px-1 text-[9px] font-bold text-[#141b16]">{taggedUsers.length}</span>}
              {tip("Tag people")}
            </button>
            <button onClick={() => setPickerOpen(true)} aria-label="Tag a course" className={attachBtn(!!taggedCourse)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M12 21s-6.5-5.5-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.5 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.3" /></svg>
              {tip("Tag a course")}
            </button>
            <button onClick={() => setDiscPickerOpen(true)} aria-label="Tag a disc" className={attachBtn(!!taggedDisc)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><ellipse cx="12" cy="14.2" rx="8.4" ry="3" /><path d="M4 13.6C5.4 11.2 8.4 10 12 10s6.6 1.2 8 3.6" /><path d="M9.2 13.4c.5-.7 1.6-1.2 2.8-1.2s2.3.5 2.8 1.2" /></svg>
              {tip("Tag a disc")}
            </button>
          </div>
          <button onClick={submitPost} disabled={(!text.trim() && !imageFile && !sharedRound) || posting} className="shrink-0 rounded-full bg-[var(--gold)] px-6 py-2 text-sm font-bold text-[#141b16] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{posting ? "Posting…" : "Post"}</button>
        </div>
      </div>
      {pickerOpen && <CourseTagPicker onSelect={setTaggedCourse} onClose={() => setPickerOpen(false)} />}
      {discPickerOpen && <DiscTagPicker onSelect={setTaggedDisc} onClose={() => setDiscPickerOpen(false)} />}
      {roundPickerOpen && user && <RoundPicker uid={user.uid} onSelect={setSharedRound} onClose={() => setRoundPickerOpen(false)} />}
      {userPickerOpen && <UserTagPicker exclude={taggedUsers.map((u) => u.id)} onSelect={(u) => { setTaggedUsers((arr) => (arr.some((x) => x.id === u.id) ? arr : [...arr, u])); setText((t) => `${t}${t && !/\s$/.test(t) ? " " : ""}@${u.username} `); }} onClose={() => setUserPickerOpen(false)} />}
    </div>
  );

  return (
    <div className="relative min-h-screen text-[var(--cream)]">
      {/* Ambient, slowly-drifting mosaic behind ALL page content — the old hero photo, now page
          texture. Sits at -z-10 with its own solid base so page content (z-10) shows over it while
          the footer (which follows this page in the layout) is NOT covered by it. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-deep)]">
        <HeroMosaic images={mosaicImages} />
        <div className="absolute inset-0 bg-[var(--bg-deep)]/85" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_-10%,transparent_45%,rgba(11,17,14,0.72))]" />
        <div className="absolute -right-40 -top-44 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.12),transparent_70%)]" />
      </div>

      {/* Compact sticky header — small tagline + Community title on the left, Feed/Forums toggle far right. */}
      <div className="sticky top-[72px] z-30 border-b border-white/[0.06] bg-[var(--bg-deep)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <span className="hidden font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--gold)] sm:inline">The home of disc golf</span>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-black leading-none tracking-[-0.03em] text-[var(--cream)] sm:text-4xl">Community</h1>
          </div>
          <div className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/[0.05] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_28px_-18px_rgba(0,0,0,0.7)] backdrop-blur-md">
            {TABS.map((t) => {
              const active = tab === t.key;
              const unread = !active && ((t.key === "feed" && unreadFeed) || (t.key === "forums" && unreadForums));
              return (
                <button key={t.key} onClick={() => setTab(t.key)} className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-all ${active ? "bg-gradient-to-b from-[var(--gold-bright)] to-[var(--gold)] text-[#141b16] shadow-[0_6px_16px_-6px_rgba(232,181,96,0.7)]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}>
                  {t.key === "feed" ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" /></svg>
                  )}
                  {t.label}
                  {unread && <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-[#8FBDE3] ring-2 ring-[var(--bg-deep)]" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Video rail */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-6"><HighlightsBar /></div>

      {/* Feed */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-10 pt-6">
        <div className="grid gap-5 lg:grid-cols-[230px_1fr_300px]">
          {/* LEFT RAIL */}
          <aside className="hidden lg:block">
            <div className="sticky top-[148px] space-y-4">
              {tab === "feed" && (
                <div className="space-y-0.5">
                  {(["hot", "top", "new", "following"] as Sort[]).map((s) => (
                    <button key={s} onClick={() => setSort(s)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${sort === s ? "text-[var(--gold)]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}><span>{s === "hot" ? "🔥" : s === "top" ? "⭐" : s === "new" ? "🕑" : "👥"}</span>{s === "hot" ? "Hot" : s === "top" ? "Top" : s === "new" ? "Latest" : "Following"}</button>
                  ))}
                </div>
              )}
              {tab === "forums" && (
                <div className="space-y-0.5">
                  <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">Categories</div>
                  {FORUM_CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setCategory(c)} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${category === c ? "text-[var(--gold)]" : "text-[var(--sage)] hover:text-[var(--cream)]"}`}>{c !== "All" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(c) }} />}{c}</button>
                  ))}
                </div>
              )}
              <div className="pt-2">
                <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">Hot discussions</div>
                <div className="space-y-3">
                  {hotThreads.map((t) => (
                    <button key={t.id} onClick={() => setOpenThread(t)} className="block w-full px-2 text-left">
                      <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--cream)] hover:text-[var(--gold)]">{t.title}</div>
                      <div className="mt-0.5 text-xs text-[var(--sage-dim)]">▲ {t.score} · {t.replyCount} repl{t.replyCount === 1 ? "y" : "ies"}</div>
                    </button>
                  ))}
                  {hotThreads.length === 0 && <p className="px-2 text-sm text-[var(--sage-dim)]">—</p>}
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER */}
          <div className="min-w-0">
            {/* Composer entry — opens the centered compose modal */}
            {composerBar}
            {tab === "feed" && (
              <div className="space-y-0">
                {loading && <div className="mt-3 space-y-3">{[0, 1, 2].map((i) => <PostSkeleton key={i} />)}</div>}

                {sort === "following" && !user && <p className={`py-10 text-center text-sm text-[var(--sage-dim)]`}><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to see rounds from players you follow.</p>}
                {sort === "following" && user && !loading && feedList.length === 0 && <p className={`py-10 text-center text-sm text-[var(--sage-dim)]`}>You&apos;re not following anyone with posts yet. Find players on the <Link href="/leaderboard" className="font-bold text-[var(--gold)] hover:underline">leaderboard</Link> and tap Follow.</p>}

                {sort !== "following" && !loading && featured && (
                  <div className="border-l-2 border-[var(--gold)]/45 pl-3">
                    <div className="flex items-center gap-1.5 pt-3 text-[10px] font-bold uppercase tracking-wide text-[var(--gold)]">📌 Featured</div>
                    <PostCard post={featured} rank={featured.authorId ? ranks.get(featured.authorId) : undefined} myReaction={reactionMap[featured.id]} onReact={(t) => onReact(featured.id, t)} onOpen={() => setOpen(featured)} />
                  </div>
                )}

                {sort !== "following" && !loading && feedList.length === 0 && !featured && <p className={`py-10 text-center text-sm text-[var(--sage-dim)]`}>No posts yet.</p>}
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
                </div>
                {loading && [0, 1, 2].map((i) => <PostSkeleton key={i} />)}
                {!loading && shownThreads.length === 0 && <p className={`py-10 text-center text-sm text-[var(--sage-dim)]`}>No threads in {category}. Start one!</p>}
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
                  {!loading && meetups.length === 0 && <p className={`py-10 text-center text-sm text-[var(--sage-dim)] sm:col-span-2`}>No meetups yet — host the first.</p>}
                  {!loading && meetups.map((m) => <MeetupCard key={m.id} meetup={m} />)}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT RAIL — borderless modules (label + list) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[148px] space-y-8">
              {/* Suggested for you — grows the follow graph (nearest players first) */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">✨ Suggested for you</span>
                  <Link href="/leaderboard" className="text-[11px] font-bold text-[var(--gold)] hover:underline">All →</Link>
                </div>
                {playersNearYou.length === 0 ? (
                  <p className="text-sm text-[var(--sage-dim)]">Finding players to suggest…</p>
                ) : (
                  <div className="space-y-2.5">
                    {playersNearYou.map((p) => (
                      <div key={p.id} className="flex items-center gap-2.5">
                        <Link href={`/u/${p.username}`} className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-xs font-bold text-[var(--cream)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.photo ? <img src={p.photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : p.name.charAt(0).toUpperCase()}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link href={`/u/${p.username}`} className="block truncate text-sm font-semibold text-[var(--cream)] hover:text-[var(--gold)]">{p.name}</Link>
                          <div className="truncate text-[11px] text-[var(--sage-dim)]">{p.state || p.country || (p.username ? `@${p.username}` : "")}</div>
                        </div>
                        <button onClick={() => toggleFollow(p.id)} className="shrink-0 rounded-full bg-[#8FBDE3]/15 px-3 py-1 text-xs font-bold text-[#8FBDE3] transition-colors hover:bg-[#8FBDE3]/25">Follow</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Courses to improve — drives contribution; each has a concrete reason + action */}
              {nearbyImprove.length > 0 && (
                <div>
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">🛠️ Courses to improve near you</div>
                  <div className="space-y-3">
                    {nearbyImprove.map(({ c, reason, action }) => (
                      <div key={c.id} className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--gold-dim)] text-base text-[var(--gold)]">⛳</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-[var(--cream)]">{c.name}</div>
                          <div className="truncate text-[11px] text-[var(--sage-dim)]">{reason}</div>
                        </div>
                        <Link href={`/courses/${slugify(c.name, c.id)}`} className="shrink-0 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-xs font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/25">{action}</Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!user && (
                <div>
                  <div className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--cream)]">Your hub for disc golf</div>
                  <p className="mt-1 text-sm text-[var(--text-body)]">Rounds, gear talk, forums, and meetups — all in one place.</p>
                  <Link href="/login" className="mt-4 inline-block rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-bold text-[#141b16] hover:bg-[var(--gold-bright)]">Join free</Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* "N new posts" — appears once you've scrolled down and fresh posts have arrived; jumps to top */}
      {tab === "feed" && pendingNew.length > 0 && scrolledDown && (
        <button onClick={showNewPosts} className="fixed left-1/2 top-[140px] z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#8FBDE3] px-4 py-2 text-sm font-bold text-[#0b110e] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)] transition-transform hover:-translate-y-0.5 hover:-translate-x-1/2">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          {pendingNew.length} new post{pendingNew.length === 1 ? "" : "s"}
        </button>
      )}

      {/* Floating action — starts a thread on Forums, a post on Feed */}
      <button onClick={onForums ? () => (user ? setNewThread(true) : router.push("/login")) : openComposer} aria-label={onForums ? "Start a new thread" : "Create a post"} className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-bold text-[#141b16] shadow-[0_16px_40px_-12px_rgba(0,0,0,0.75)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--gold-bright)]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        {onForums ? "New thread" : "Post"}
      </button>

      {composerModal}
      {open && <PostDetail post={open} uid={user?.uid} myReaction={reactionMap[open.id]} onReact={(t) => onReact(open.id, t)} onClose={() => setOpen(null)} onCommented={() => bumpComment(open.id)} />}
      {openThread && <ThreadDetail thread={openThread} rank={openThread.authorId ? ranks.get(openThread.authorId) : undefined} uid={user?.uid} onClose={() => setOpenThread(null)} />}
      {newThread && user && <NewThreadModal uid={user.uid} onCreated={(t) => { setThreads((prev) => [t, ...prev]); setNewThread(false); setTab("forums"); setOpenThread(t); }} onClose={() => setNewThread(false)} />}
      {newMeetup && user && <NewMeetupModal uid={user.uid} onCreated={(m) => { setMeetups((prev) => [m, ...prev]); setNewMeetup(false); }} onClose={() => setNewMeetup(false)} />}
    </div>
  );
}
