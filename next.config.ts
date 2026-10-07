import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: www<->non-www canonical redirect is handled at the Vercel domain layer (edge), NOT here.
  // Do NOT add a host redirect in next.config — if it points the opposite way to Vercel's domain
  // redirect it creates an infinite loop.
  async redirects() {
    return [
      // Shipped Android builds link the OLD static-site paths (/privacy.html,
      // /terms.html — SettingsSheet + PaywallSheet constants) which 404 on
      // this Next.js site ("page not found" report, tjthejawk 2026-10-06).
      // Android's constants get fixed in vc44+; these keep every build that's
      // already in the field working. Path-only — safe alongside the edge
      // host redirect.
      { source: "/privacy.html", destination: "/privacy", permanent: true },
      { source: "/terms.html", destination: "/terms", permanent: true },
    ];
  },
  images: {
    qualities: [75, 90, 100],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/radius-dg.firebasestorage.app/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/radius-dg.firebasestorage.app/**",
      },
    ],
  },
};

export default nextConfig;
