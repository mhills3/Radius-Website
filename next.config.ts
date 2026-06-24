import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Canonicalize on the non-www apex domain — 301 any www request to it so SEO signals don't split
  // across two hostnames. (Belt-and-suspenders alongside the Vercel primary-domain setting.)
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.radiusdiscgolf.com" }],
        destination: "https://radiusdiscgolf.com/:path*",
        permanent: true,
      },
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
