// Server-only: the "Featured In" video list + a best-effort view-count fetch. There's no YouTube
// Data API key wired up, so we read the public watch page and pull `viewCount` out of ytInitialData
// (same pragmatic approach as youtube.ts's Shorts probe). Cached 6h; if a fetch fails the card just
// omits the count. Data flows server → the client <FeaturedIn> as a prop.

export interface FeaturedVideo {
  id: string;
  title: string;
  channel: string;
  own?: boolean;   // one of our own channel films
  views?: number;
}

const FEATURED: Omit<FeaturedVideo, "views">[] = [
  { id: "idApg7z3t-U", title: "Robot vs. Human Caddie Battle at the Hardest Course", channel: "Foundation Disc Golf" },
  { id: "uxOc3k9z9oY", title: "Why I Left UDisc and Built My Own Disc Golf App", channel: "Radius", own: true },
  { id: "ma_kNu_Z6CM", title: "Abandoned Six Flags — Buhr, Barela, Babcock, Gossage, Samson", channel: "Urban Disc Golf" },
  { id: "OB2rUsyAWZo", title: "How They Created a Groundbreaking Disc Golf App", channel: "Funsie Podcast" },
  { id: "ZbZdmr7s9Sk", title: "I Spent 1,000 Hours Building the Smartest Disc Golf App", channel: "Radius", own: true },
];

async function fetchViews(id: string): Promise<number | undefined> {
  try {
    const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+1" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 21600 }, // 6h
    });
    if (!r.ok) return undefined;
    const html = await r.text();
    const m = html.match(/"viewCount":"(\d+)"/);
    return m ? Number(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

export async function getFeaturedVideos(): Promise<FeaturedVideo[]> {
  const views = await Promise.all(FEATURED.map((v) => fetchViews(v.id)));
  return FEATURED.map((v, i) => ({ ...v, views: views[i] }));
}
