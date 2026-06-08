// Live disc-golf highlights via YouTube RSS feeds (no API key / no quota).
// Each channel exposes its latest ~15 uploads at /feeds/videos.xml?channel_id=…
// Urban Disc Golf is our partner and is always featured in the first (gold) slot.

export interface Highlight {
  id: string;            // youtube video id
  title: string;
  channel: string;       // display name
  channelId: string;
  published: number;     // epoch ms
  url: string;
  thumb: string;
  views?: number;
  featured?: boolean;    // Urban Disc Golf partner card
}

const UDG_ID = "UCoXpqth3OS3XzaRcp0TtvXw";

// Order is cosmetic; UDG is pinned to the featured slot regardless.
const CHANNELS: { name: string; id: string }[] = [
  { name: "Urban Disc Golf", id: UDG_ID },
  { name: "Jomez Pro", id: "UCmGyCEbHfY91NFwHgioNLMQ" },
  { name: "GK Pro", id: "UC96v9uB8ZKe1TFdYzBOGnpw" },
  { name: "DGPT", id: "UCw0WzNn6m2Na6ZW7rKqWI3g" },
  { name: "Gannon Buhr", id: "UCKFgm3T-5-znjkI_felRY_w" },
  { name: "Simon Lizotte", id: "UCed6me7QtjJiV-tvVgF7Rpg" },
];

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function parseFeed(xml: string, channelName: string): Highlight[] {
  const out: Highlight[] = [];
  for (const block of xml.split("<entry>").slice(1)) {
    const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
    const channelId = block.match(/<yt:channelId>([^<]+)<\/yt:channelId>/)?.[1] || "";
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const published = block.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!id || !title || !published) continue;
    const views = block.match(/<media:statistics views="(\d+)"/)?.[1];
    out.push({
      id,
      title: decode(title.trim()),
      channel: channelName,
      channelId,
      published: new Date(published).getTime(),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      views: views ? Number(views) : undefined,
    });
  }
  return out;
}

async function fetchChannel(id: string, name: string): Promise<Highlight[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, {
      next: { revalidate: 900 }, // 15 min — fresh without hammering YouTube every load
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), name);
  } catch {
    return [];
  }
}

// A video's Short/long-form status never changes, so cache it per id for the process lifetime.
const longFormCache = new Map<string, Promise<boolean>>();
function isLongForm(id: string): Promise<boolean> {
  let p = longFormCache.get(id);
  if (!p) {
    // /shorts/{id} stays 200 for an actual Short, but 3xx-redirects to /watch for a long-form.
    p = fetch(`https://www.youtube.com/shorts/${id}`, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 },
    })
      .then((r) => r.status !== 200) // redirect → long-form
      .catch(() => true); // on error keep it rather than hide content
    longFormCache.set(id, p);
  }
  return p;
}

const isUDG = (v: Highlight) => v.channelId === UDG_ID || v.channel === "Urban Disc Golf";

/** Newest long-form disc-golf videos (Shorts excluded), Urban Disc Golf featured first. */
export async function getHighlights(limit = 12): Promise<Highlight[]> {
  const all = (await Promise.all(CHANNELS.map((c) => fetchChannel(c.id, c.name)))).flat();
  if (all.length === 0) return [];

  // Always consider ALL of UDG's videos (low-volume partner) plus the most recent from everyone
  // else — otherwise the high-volume pro channels crowd UDG out before we filter Shorts.
  const udgVids = all.filter(isUDG).sort((a, b) => b.published - a.published);
  const others = all.filter((v) => !isUDG(v)).sort((a, b) => b.published - a.published).slice(0, 28);
  const candidates = [...udgVids, ...others];

  // Drop Shorts — feed is long-form only.
  const flags = await Promise.all(candidates.map((v) => isLongForm(v.id)));
  const longs = candidates.filter((_, i) => flags[i]);
  if (longs.length === 0) return [];

  // Featured = Urban Disc Golf's newest long-form (udgVids is already newest-first).
  const udg = longs.find(isUDG);
  const rest = longs.filter((v) => v.id !== udg?.id).sort((a, b) => b.published - a.published);

  const list = udg ? [{ ...udg, featured: true }, ...rest] : rest;
  return list.slice(0, limit);
}
