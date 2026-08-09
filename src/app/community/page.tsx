"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getFeed, createPost, ensureSystemPost, getReactionMap, setReaction, hotScore, SYSTEM_AUTHOR_ID, type FeedPost, type CourseTag, type DiscTag, type SharedRound } from "@/lib/feed";
import RoundPicker from "@/components/community/RoundPicker";
import { getPlayedCourses } from "@/lib/rounds";
import CourseTagPicker from "@/components/community/CourseTagPicker";
import DiscTagPicker from "@/components/community/DiscTagPicker";
import UserTagPicker from "@/components/community/UserTagPicker";
import { getLeaderboard, getLeaderboardWithRegion, getMostActivePlayers, type MentionUser, type LeaderRow, type GeoLeaderRow, type ActiveRow } from "@/lib/leaderboard";
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

// Counts up 0 → value on mount (community-wide numbers get this treatment, in blue).
function CountUp({ to, className }: { to: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now(); const dur = 900;
    const tick = (t: number) => { const p = Math.min(1, (t - start) / dur); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span className={className}>{n.toLocaleString()}</span>;
}

type PulseMetric = { label: string; value: number; plus: boolean };
function Pulse({ metrics }: { metrics: PulseMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--cream)]/75">
      {metrics.map((m) => (
        <span key={m.label} className="inline-flex items-baseline gap-2">
          <CountUp to={m.value} className="text-lg font-extrabold tracking-normal text-[#8FBDE3]" />{m.plus ? <span className="-ml-1.5 text-[#8FBDE3]">+</span> : null}<span>{m.label}</span>
        </span>
      ))}
    </div>
  );
}

// Dense, heavily-darkened, slowly-drifting mosaic of real member/course imagery. Texture only.
function HeroMosaic({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  const tiles = images.length >= 40 ? images : Array.from({ length: 48 }, (_, i) => images[i % images.length]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="hero-drift grid h-[132%] w-[112%] grid-cols-6 gap-2.5 opacity-[0.55] blur-[2.5px] sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
        {tiles.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" loading="lazy" decoding="async" className="aspect-square w-full rounded-lg object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
        ))}
      </div>
    </div>
  );
}

type SpotItem = { id: string; name: string; username?: string; count: number; photo?: string; cover?: string };

// Avatar with a graceful fallback chain: profile photo → blurred latest-course-cover + monogram →
// refined monogram with a gold ring. Never a bare letter on a flat circle.
function PodiumAvatar({ item, big }: { item: SpotItem; big: boolean }) {
  const size = big ? "h-24 w-24" : "h-16 w-16";
  const mono = (item.name || "?").charAt(0).toUpperCase();
  if (item.photo) {
    return (
      <span className={`relative block overflow-hidden rounded-full border-2 border-[var(--gold)] p-[3px] ${size}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.photo} alt="" className="h-full w-full rounded-full object-cover" />
      </span>
    );
  }
  if (item.cover) {
    return (
      <span className={`relative block overflow-hidden rounded-full ring-2 ring-[var(--gold)] ${size}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.cover} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-[6px] brightness-[0.45]" />
        <span className={`relative grid h-full w-full place-items-center font-[family-name:var(--font-heading)] font-bold text-[var(--cream)] ${big ? "text-3xl" : "text-xl"}`}>{mono}</span>
      </span>
    );
  }
  return (
    <span className={`grid place-items-center rounded-full border-2 border-[var(--gold)] bg-[radial-gradient(circle_at_30%_25%,rgba(232,181,96,0.22),var(--bg-mid))] font-[family-name:var(--font-heading)] font-bold text-[var(--gold)] ${size} ${big ? "text-3xl" : "text-xl"}`}>{mono}</span>
  );
}
function PodiumPerson({ item, big }: { item: SpotItem; big: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center ${big ? "" : "opacity-70"}`}>
      <span className="relative">
        {big && <span aria-hidden className="absolute -inset-3 rounded-full" style={{ background: "radial-gradient(closest-side, rgba(232,181,96,0.4), transparent)" }} />}
        <span className="relative block">{item.username ? <Link href={`/u/${item.username}`}><PodiumAvatar item={item} big={big} /></Link> : <PodiumAvatar item={item} big={big} />}</span>
      </span>
      <div className={`mt-3 max-w-[8rem] truncate font-[family-name:var(--font-heading)] font-extrabold tracking-tight text-[var(--cream)] ${big ? "text-xl" : "text-sm"}`}>{item.name}</div>
      {big && item.username && <Link href={`/u/${item.username}`} className="text-sm text-[var(--sage)] hover:text-[var(--gold)]">@{item.username}</Link>}
      <div className={`font-[family-name:var(--font-heading)] font-black leading-none tracking-[-0.02em] text-[var(--gold)] ${big ? "mt-2.5 text-5xl sm:text-6xl" : "mt-1.5 text-2xl"}`}>{item.count}</div>
    </div>
  );
}
function Podium({ items, metric }: { items: SpotItem[]; metric: string }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / 3));
  useEffect(() => { setPage(0); }, [metric]); // reset when the source (toggle) changes
  useEffect(() => {
    if (pages <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages), 8000);
    return () => clearInterval(t);
  }, [pages]);
  if (items.length === 0) return null;
  const p = Math.min(page, pages - 1);
  const trio = items.slice(p * 3, p * 3 + 3); // [1st, 2nd, 3rd] on this page
  const [c, l, r] = [trio[0], trio[1], trio[2]];
  return (
    <div className="flex flex-col items-center">
      <div key={`${metric}-${p}`} className="hero-fade flex items-end justify-center gap-5 sm:gap-9">
        <div className="w-24 shrink-0">{l && <PodiumPerson item={l} big={false} />}</div>
        {c && <PodiumPerson item={c} big />}
        <div className="w-24 shrink-0">{r && <PodiumPerson item={r} big={false} />}</div>
      </div>
      <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--sage-dim)]">{metric}</div>
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          {Array.from({ length: pages }, (_, idx) => (
            <button key={idx} onClick={() => setPage(idx)} aria-label={`Page ${idx + 1}`} className={`h-1.5 rounded-full transition-all ${idx === p ? "w-5 bg-[var(--gold)]" : "w-1.5 bg-white/25 hover:bg-white/40"}`} />
          ))}
        </div>
      )}
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
  const [topPlayers, setTopPlayers] = useState<LeaderRow[]>([]);
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [builderRanks, setBuilderRanks] = useState<Map<string, RankInfo>>(new Map());
  const [geoRows, setGeoRows] = useState<GeoLeaderRow[]>([]);
  const [improveCourses, setImproveCourses] = useState<Course[]>([]);
  const [myCid, setMyCid] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [playedNames, setPlayedNames] = useState<Set<string>>(new Set());
  const [composerExpanded, setComposerExpanded] = useState(false);
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
  const [heroMode, setHeroMode] = useState<"builders" | "players" | "active">("builders");
  const [activePlayers, setActivePlayers] = useState<ActiveRow[]>([]);
  // Return mechanics: unread dots on the tabs + a "N new posts" pill.
  const [seen, setSeen] = useState<{ feed: number; forums: number }>({ feed: 0, forums: 0 });
  const [pendingNew, setPendingNew] = useState<FeedPost[]>([]);
  const [scrolledDown, setScrolledDown] = useState(false);

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
    getMostActivePlayers(12).then((rows) => alive && setActivePlayers(rows)).catch(() => {});
    // Courses that need help: no cover, or no reviews yet. Keep coords for nearest-to-you sorting.
    getAllCourses().then((cs) => { if (alive) setImproveCourses(cs.filter((c) => c.name && (!c.coverPhotoUrl || !c.reviewCount)).slice(0, 1200)); }).catch(() => {});
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
  // Courses to improve, nearest first, each with a concrete reason to act.
  const nearbyImprove = useMemo(() => {
    const withReason = improveCourses.map((c) => {
      const played = playedNames.has(c.name.trim().toLowerCase());
      const reason = !c.coverPhotoUrl ? "No cover photo yet" : played ? "You've played here — leave a review" : "No reviews yet — be the first";
      const action = !c.coverPhotoUrl ? "Add cover" : "Review";
      const d = myLoc && c.latitude != null && c.longitude != null ? milesBetween(myLoc, { lat: c.latitude, lng: c.longitude }) : Infinity;
      return { c, reason, action, d };
    });
    // Prioritize played-but-unreviewed courses, then sort by distance.
    withReason.sort((a, b) => {
      const ap = playedNames.has(a.c.name.trim().toLowerCase()) && a.c.coverPhotoUrl ? 0 : 1;
      const bp = playedNames.has(b.c.name.trim().toLowerCase()) && b.c.coverPhotoUrl ? 0 : 1;
      return ap - bp || a.d - b.d;
    });
    return withReason.slice(0, 4);
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

  // Radius milestone posts (real, interactive) are pinned at the top of the feed on their own —
  // keep them out of the regular sort/featured/list so they render once, prominently.
  const nonSystemPosts = useMemo(() => posts.filter((p) => !p.isSystem), [posts]);
  const systemPosts = useMemo(() => posts.filter((p) => p.isSystem).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3), [posts]);
  const sortedPosts = useMemo(() => {
    const a = [...nonSystemPosts];
    if (sort === "new") a.sort((x, y) => y.createdAt - x.createdAt);
    else if (sort === "top") a.sort((x, y) => y.likeCount - x.likeCount);
    else a.sort((x, y) => hotScore(y) - hotScore(x));
    return a;
  }, [nonSystemPosts, sort]);
  // Featured post rotates on a rhythm (every 6h) through the most-engaging posts, so the
  // spotlight isn't always the same post visit-to-visit.
  const featured = useMemo(() => {
    if (!nonSystemPosts.length) return null;
    const ranked = [...nonSystemPosts].sort((a, b) => (b.likeCount + b.commentCount * 2) - (a.likeCount + a.commentCount * 2));
    const pool = ranked.slice(0, Math.min(5, ranked.length));
    const bucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
    return pool[bucket % pool.length];
  }, [nonSystemPosts]);
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
    return [...urls].slice(0, 48);
  }, [topPlayers, builders, builderRanks, posts]);
  // Hero podium — top builders (courses mapped), up to 3 pages of 3.
  const builderPodium = useMemo(() => builders.filter((b) => b.count > 0).slice(0, 9).map((b) => ({ id: b.id, name: b.name, username: b.username, count: b.count, photo: builderRanks.get(b.id)?.photo, cover: b.cover })), [builders, builderRanks]);
  // Top players by Game IQ (geoRows is already ordered by gameIQ desc).
  const playerPodium = useMemo(() => geoRows.filter((r) => r.username && r.gameIQ > 0).slice(0, 9).map((r) => ({ id: r.id, name: r.name, username: r.username, count: r.gameIQ, photo: r.photo })), [geoRows]);
  // Most active players by total rounds logged.
  const activePodium = useMemo(() => activePlayers.filter((r) => r.username && r.rounds > 0).slice(0, 9).map((r) => ({ id: r.id, name: r.name, username: r.username, count: r.rounds, photo: r.photo })), [activePlayers]);
  // Radius milestone posts. We create them as REAL `posts` docs with a deterministic id, so the
  // first signed-in visitor after a threshold is crossed writes it once (Firestore rules allow any
  // authed write; no server needed) and everyone else no-ops. Being real posts, they're likeable +
  // commentable through the same paths as any post. Honest: each reflects a genuinely-crossed tier.
  useEffect(() => {
    if (!user || builders.length === 0) return;
    const tiers = [100, 50, 25];
    const picks: { b: Builder; tier: number; lead: boolean }[] = [];
    const top = builders[0];
    const t0 = top?.username ? tiers.find((t) => top.count >= t) : undefined;
    if (top?.username && t0) picks.push({ b: top, tier: t0, lead: true });
    for (const b of builders.slice(1)) {
      if (!b.username) continue;
      const t = tiers.find((x) => b.count >= x);
      if (t) { picks.push({ b, tier: t, lead: false }); break; }
    }
    if (picks.length === 0) return;
    let alive = true;
    Promise.all(picks.map(({ b, tier, lead }) => ensureSystemPost({
      id: `sys_builder_${tier}_${b.id}`,
      text: lead
        ? `🏆 @${b.username} just crossed ${tier} courses mapped — the community's #1 course builder. Congrats! 🎉`
        : `🏗️ @${b.username} just crossed ${tier} courses mapped on Radius — a huge contribution to the community!`,
      user: { id: b.id, name: b.name, username: b.username },
    }))).then((res) => {
      if (!alive) return;
      const made = res.filter((p): p is FeedPost => !!p);
      if (!made.length) return;
      setPosts((prev) => {
        const have = new Set(prev.map((p) => p.id));
        const add = made.filter((p) => !have.has(p.id));
        return add.length ? [...add, ...prev] : prev;
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [user, builders]);
  // Pulse — honest 7-day counts from the loaded feed. Metrics below a floor of 10 hide; fewer than two hides the strip.
  const pulse = useMemo(() => {
    const wk = Date.now() - 7 * 86400_000;
    const recent = posts.filter((p) => p.createdAt >= wk);
    const players = new Set(recent.map((p) => p.authorId).filter(Boolean)).size;
    const rounds = recent.filter((p) => p.linkedCourseName).length;
    const saturated = posts.length > 0 && recent.length === posts.length; // whole loaded feed is within the window
    const metrics = [
      { label: "posts this week", value: recent.length, plus: saturated },
      { label: "active players", value: players, plus: false },
      { label: "rounds shared", value: rounds, plus: false },
    ].filter((m) => m.value >= 10);
    return metrics.length >= 2 ? metrics : [];
  }, [posts]);

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
      if (post) { setPosts((prev) => [post, ...prev]); setText(""); setTaggedCourse(null); setTaggedDisc(null); setImageFile(null); setImagePreview(null); setTaggedUsers([]); setSharedRound(null); setComposerExpanded(false); }
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

  // Composer lives directly below the hero (participation handoff) — same block for feed & forums.
  const composer = (
    <>
      {user ? (
        <div className="border-b border-white/[0.055] py-3.5">
          {!composerExpanded ? (
            <button onClick={() => setComposerExpanded(true)} className="flex w-full items-center gap-2.5 text-left">
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
                {profile?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profileImageUrl} alt="" className="h-8 w-8 object-cover" />
                ) : ((profile?.name || "?").charAt(0).toUpperCase())}
              </span>
              <span className="flex-1 rounded-full bg-white/[0.05] px-4 py-2.5 text-[15px] text-[var(--sage-dim)] transition-colors hover:bg-white/[0.08]">What&apos;s your disc golf story today?</span>
            </button>
          ) : (
          <>
          <div className="flex gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)] ring-1 ring-white/10">
              {profile?.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profileImageUrl} alt="" className="h-8 w-8 object-cover" />
              ) : ((profile?.name || "?").charAt(0).toUpperCase())}
            </span>
            <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="What's your disc golf story today?" className="w-full resize-none bg-transparent pt-1 text-[15px] text-[var(--cream)] placeholder-[var(--sage-dim)] outline-none" />
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
          <div className="mt-2 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setRoundPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/15 px-3 py-1.5 text-xs font-bold text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/25">⛳ Share a round</button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">📷 Photo<input type="file" accept="image/*" onChange={onPickImage} className="hidden" /></label>
              <button onClick={() => setUserPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">👤 {taggedUsers.length ? `People (${taggedUsers.length})` : "People"}</button>
              <button onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">⛳ {taggedCourse ? "Course ✓" : "Course"}</button>
              <button onClick={() => setDiscPickerOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-[var(--sage)] transition-colors hover:bg-white/[0.1] hover:text-[var(--cream)]">🥏 {taggedDisc ? "Disc ✓" : "Disc"}</button>
            </div>
            <button onClick={submitPost} disabled={(!text.trim() && !imageFile && !sharedRound) || posting} className="rounded-full bg-[var(--gold)] px-6 py-2 text-sm font-bold text-[#141b16] transition-colors hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50">{posting ? "Posting…" : "Post"}</button>
          </div>
          </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 border-b border-white/[0.055] py-3.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--bg-mid)] text-sm font-bold text-[var(--cream)]">+</span>
          <p className="text-sm text-[var(--text-body)]"><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to share a round or join the conversation.</p>
        </div>
      )}
      {pickerOpen && <CourseTagPicker onSelect={setTaggedCourse} onClose={() => setPickerOpen(false)} />}
      {discPickerOpen && <DiscTagPicker onSelect={setTaggedDisc} onClose={() => setDiscPickerOpen(false)} />}
      {roundPickerOpen && user && <RoundPicker uid={user.uid} onSelect={setSharedRound} onClose={() => setRoundPickerOpen(false)} />}
      {userPickerOpen && <UserTagPicker exclude={taggedUsers.map((u) => u.id)} onSelect={(u) => { setTaggedUsers((arr) => (arr.some((x) => x.id === u.id) ? arr : [...arr, u])); setText((t) => `${t}${t && !/\s$/.test(t) ? " " : ""}@${u.username} `); }} onClose={() => setUserPickerOpen(false)} />}
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[var(--cream)]">
      {/* ===== SECTION 1 — layered hero (mosaic · spotlight · pulse) ===== */}
      <section className="relative flex h-[100svh] min-h-[620px] w-full flex-col overflow-hidden">
        <HeroMosaic images={mosaicImages} />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[var(--bg-deep)]/80" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_75%_at_50%_-8%,transparent_42%,rgba(11,17,14,0.65))]" />
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-44 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(246,193,101,0.14),transparent_70%)]" />
        {/* generous fade — the mosaic dissolves into the page ground, no seam */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[46vh] bg-[linear-gradient(to_top,var(--bg-deep)_16%,transparent)]" />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16 pt-28">
          <div>
            <div className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--gold)]">The home of disc golf</div>
            <h1 className="font-[family-name:var(--font-heading)] text-6xl font-black leading-[0.95] tracking-[-0.04em] text-[var(--cream)] sm:text-7xl md:text-[5.5rem]">Community</h1>
            <Pulse metrics={pulse} />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-7 pb-4">
            <div className="inline-flex rounded-full bg-white/[0.06] p-1 backdrop-blur-md">
              {([["builders", "Builders"], ["players", "Top players"], ["active", "Most active"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setHeroMode(k)} className={`rounded-full px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors ${heroMode === k ? "bg-[var(--gold)] text-[#141b16]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}>{label}</button>
              ))}
            </div>
            {(() => {
              const items = heroMode === "players" ? playerPodium : heroMode === "active" ? activePodium : builderPodium;
              const metric = heroMode === "players" ? "Game IQ" : heroMode === "active" ? "rounds played" : "courses mapped";
              return <Podium items={items} metric={metric} />;
            })()}
          </div>
        </div>
      </section>

      {/* ===== SECTION 2 — video rail, directly after the hero ===== */}
      <div className="mx-auto max-w-7xl px-6 pt-10"><HighlightsBar /></div>

      {/* ===== SECTION 3 — feed (sticky tabs; composer sits at the top of the feed column) ===== */}
      <div className="mx-auto max-w-7xl px-6 pb-10 pt-6">
        <div className="sticky top-[58px] z-30 -mx-6 mb-5 bg-[var(--bg-deep)]/80 px-6 py-2.5 backdrop-blur-md">
          <div className="inline-flex rounded-full bg-white/[0.06] p-1 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.7)]">
          {TABS.map((t) => {
            const unread = t.key !== tab && ((t.key === "feed" && unreadFeed) || (t.key === "forums" && unreadForums));
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`relative rounded-full px-5 py-2 text-sm font-bold transition-colors ${tab === t.key ? "bg-[var(--gold)] text-[#141b16]" : "text-[var(--text-body)] hover:text-[var(--cream)]"}`}>
                {t.label}
                {unread && <span className="absolute right-2.5 top-1.5 h-2 w-2 rounded-full bg-[#8FBDE3] ring-2 ring-[var(--bg-deep)]" />}
              </button>
            );
          })}
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[230px_1fr_300px]">
          {/* LEFT RAIL */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
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
            {/* Composer — first element in the feed column, matching post width */}
            {composer}
            {tab === "feed" && (
              <div className="space-y-0">
                {loading && <div className="mt-3 space-y-3">{[0, 1, 2].map((i) => <PostSkeleton key={i} />)}</div>}

                {sort === "following" && !user && <p className={`py-10 text-center text-sm text-[var(--sage-dim)]`}><Link href="/login" className="font-bold text-[var(--gold)] hover:underline">Sign in</Link> to see rounds from players you follow.</p>}
                {sort === "following" && user && !loading && feedList.length === 0 && <p className={`py-10 text-center text-sm text-[var(--sage-dim)]`}>You&apos;re not following anyone with posts yet. Find players on the <Link href="/leaderboard" className="font-bold text-[var(--gold)] hover:underline">leaderboard</Link> and tap Follow.</p>}

                {sort !== "following" && !loading && systemPosts.map((p) => (
                  <PostCard key={p.id} post={p} myReaction={reactionMap[p.id]} onReact={(t) => onReact(p.id, t)} onOpen={() => setOpen(p)} />
                ))}

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
                  <button onClick={() => (user ? setNewThread(true) : router.push("/login"))} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 py-2 text-xs font-bold text-[#16221b] transition-colors hover:bg-[var(--gold-bright)]">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>New thread
                  </button>
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
            <div className="sticky top-24 space-y-8">
              {/* Players near you — grows the follow graph */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--gold)]">📍 Players near you</span>
                  <Link href="/leaderboard" className="text-[11px] font-bold text-[var(--gold)] hover:underline">All →</Link>
                </div>
                {playersNearYou.length === 0 ? (
                  <p className="text-sm text-[var(--sage-dim)]">Finding players in your area…</p>
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
                          <div className="truncate text-[11px] text-[var(--sage-dim)]">{reason}{c.city || c.state ? ` · ${[c.city, c.state].filter(Boolean).join(", ")}` : ""}</div>
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
        <button onClick={showNewPosts} className="fixed left-1/2 top-[74px] z-40 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#8FBDE3] px-4 py-2 text-sm font-bold text-[#0b110e] shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)] transition-transform hover:-translate-y-0.5 hover:-translate-x-1/2">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          {pendingNew.length} new post{pendingNew.length === 1 ? "" : "s"}
        </button>
      )}
      {open && <PostDetail post={open} uid={user?.uid} myReaction={reactionMap[open.id]} onReact={(t) => onReact(open.id, t)} onClose={() => setOpen(null)} onCommented={() => bumpComment(open.id)} />}
      {openThread && <ThreadDetail thread={openThread} rank={openThread.authorId ? ranks.get(openThread.authorId) : undefined} uid={user?.uid} onClose={() => setOpenThread(null)} />}
      {newThread && user && <NewThreadModal uid={user.uid} onCreated={(t) => { setThreads((prev) => [t, ...prev]); setNewThread(false); setTab("forums"); setOpenThread(t); }} onClose={() => setNewThread(false)} />}
      {newMeetup && user && <NewMeetupModal uid={user.uid} onCreated={(m) => { setMeetups((prev) => [m, ...prev]); setNewMeetup(false); }} onClose={() => setNewMeetup(false)} />}
    </div>
  );
}
