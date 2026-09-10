import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/bag", "/login", "/lab", "/auth"] }],
    sitemap: "https://radiusdiscgolf.com/sitemap.xml",
    host: "https://radiusdiscgolf.com",
  };
}
