// Server-only: the "Featured In" video list + view counts. No YouTube Data API key is wired up
// (the Firebase key is blocked for it), so we read the count from YouTube's InnerTube player API
// (a JSON POST — far more reliable from datacenter/build IPs than scraping the consent-walled watch
// page). Each entry also carries a fallback count so the chip ALWAYS renders even if the live fetch
// is blocked. Cached 6h; data flows server → the client <FeaturedIn> as a prop.

export interface FeaturedVideo {
  id: string;          // YouTube id — always used for the thumbnail
  title: string;
  channel: string;
  own?: boolean;       // one of our own channel films
  views?: number;
  href?: string;       // external watch URL (e.g. Facebook) — click opens this instead of the YT lightbox
  accent?: string;     // per-channel brand colour (dot + channel name)
  partner?: boolean;   // Radius's featured partner — gets a chip
}

// fallback = last-known count (2026-09-09) so a chip shows even if the live fetch is blocked.
// href entries use their fallback count directly (we want the platform they're routed to, not YT).
const GOLD = "#f6c165", BLUE = "#6fb2ff", RED = "#ef6f6b", LAVENDER = "#bb95e8";
const FEATURED: (Omit<FeaturedVideo, "views"> & { fallbackViews: number })[] = [
  { id: "idApg7z3t-U", title: "Robot vs. Human Caddie Battle at the Hardest Course", channel: "Foundation Disc Golf", accent: BLUE, fallbackViews: 58000 },
  // Thumbnail stays YouTube, but this one performed on Facebook (65K) — route the click there.
  { id: "uxOc3k9z9oY", title: "Why I Left UDisc and Built My Own Disc Golf App", channel: "Radius", own: true, accent: GOLD, href: "https://www.facebook.com/share/v/14pSew8DaJr/", fallbackViews: 65000 },
  { id: "ma_kNu_Z6CM", title: "Abandoned Six Flags — Buhr, Barela, Babcock, Gossage, Samson", channel: "Urban Disc Golf", accent: RED, partner: true, fallbackViews: 155000 },
  { id: "OB2rUsyAWZo", title: "How They Created a Groundbreaking Disc Golf App", channel: "Funsie Podcast", accent: LAVENDER, fallbackViews: 250 },
  { id: "ZbZdmr7s9Sk", title: "I Spent 1,000 Hours Building the Smartest Disc Golf App", channel: "Radius", own: true, accent: GOLD, fallbackViews: 2600 },
];

// Public InnerTube web key — a well-known constant, not a secret.
const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

async function fetchViews(id: string): Promise<number | undefined> {
  try {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20240726.00.00", hl: "en" } }, videoId: id }),
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 21600 }, // 6h
    });
    if (!r.ok) return undefined;
    const j = (await r.json()) as { videoDetails?: { viewCount?: string } };
    const n = Number(j?.videoDetails?.viewCount);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

export async function getFeaturedVideos(): Promise<FeaturedVideo[]> {
  // href entries are routed off YouTube, so use their fixed count; others fetch the live YT count.
  const views = await Promise.all(FEATURED.map((v) => (v.href ? Promise.resolve(v.fallbackViews) : fetchViews(v.id))));
  return FEATURED.map(({ fallbackViews, ...v }, i) => ({ ...v, views: views[i] ?? fallbackViews }));
}
