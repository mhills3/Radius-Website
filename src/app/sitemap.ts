import type { MetadataRoute } from "next";
import { slugify, isUSState, citySlug } from "@/lib/courses";
import { listCoursesLite } from "@/lib/coursesServer";
import { listPosts, listThreads } from "@/lib/postsServer";
import { getAllDiscsServer } from "@/lib/discsServer";
import { getAllPosts } from "@/lib/blog";
import { getPublishedStories } from "@/lib/storiesServer";

const BASE = "https://radiusdiscgolf.com";
export const revalidate = 86400; // rebuild daily

const STATIC_PATHS = ["", "/features", "/courses", "/discs", "/community", "/leaderboard", "/stories", "/learn", "/subscription", "/story", "/contact", "/rewards"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({
    url: `${BASE}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : p === "/courses" ? 0.9 : 0.7,
  }));

  const courses = await listCoursesLite().catch(() => []);
  if (courses.length === 0) return staticEntries;

  const stateCodes = [...new Set(courses.filter((c) => isUSState(c.state)).map((c) => c.state!.trim().toUpperCase()))];
  const stateEntries: MetadataRoute.Sitemap = stateCodes.map((s) => ({
    url: `${BASE}/courses/state/${s}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // City landing pages — one per unique state+city, for "[city] disc golf" long-tail.
  const cityKeys = new Set<string>();
  for (const c of courses) {
    if (!isUSState(c.state) || !c.city?.trim()) continue;
    cityKeys.add(`${c.state!.trim().toUpperCase()}/${citySlug(c.city)}`);
  }
  const cityEntries: MetadataRoute.Sitemap = [...cityKeys].map((k) => ({
    url: `${BASE}/courses/city/${k}`,
    changeFrequency: "weekly",
    priority: 0.55,
  }));

  const courseEntries: MetadataRoute.Sitemap = courses.map((c) => ({
    url: `${BASE}/courses/${slugify(c.name, c.id)}`,
    lastModified: c.dateCreated ? new Date(c.dateCreated) : undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const [posts, threads] = await Promise.all([listPosts().catch(() => []), listThreads().catch(() => [])]);
  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE}/community/post/${p.id}`,
    lastModified: p.createdAt ? new Date(p.createdAt) : undefined,
    changeFrequency: "monthly",
    priority: 0.5,
  }));
  const threadEntries: MetadataRoute.Sitemap = threads.map((t) => ({
    url: `${BASE}/community/thread/${t.id}`,
    lastModified: t.createdAt ? new Date(t.createdAt) : undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const discEntries: MetadataRoute.Sitemap = getAllDiscsServer().map((d) => ({
    url: `${BASE}/discs/${d.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const liveStories = await getPublishedStories().catch(() => []);
  const seedSlugs = new Set(getAllPosts().map((p) => p.slug));
  const blogEntries: MetadataRoute.Sitemap = [
    ...getAllPosts().map((p) => ({ url: `${BASE}/stories/${p.slug}`, lastModified: new Date(p.date + "T12:00:00"), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...liveStories.filter((s) => !seedSlugs.has(s.slug)).map((s) => ({ url: `${BASE}/stories/${s.slug}`, lastModified: s.dateMs ? new Date(s.dateMs) : undefined, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];

  const DISC_GUIDES = ["beginners", "overstable", "understable", "putters", "midranges", "fairway-drivers", "distance-drivers"];
  const guideEntries: MetadataRoute.Sitemap = DISC_GUIDES.map((g) => ({
    url: `${BASE}/discs/best/${g}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticEntries, ...blogEntries, ...guideEntries, ...stateEntries, ...cityEntries, ...courseEntries, ...discEntries, ...threadEntries, ...postEntries];
}
