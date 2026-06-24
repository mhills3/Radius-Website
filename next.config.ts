import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: www<->non-www canonical redirect is handled at the Vercel domain layer (edge), NOT here.
  // Do NOT add a host redirect in next.config — if it points the opposite way to Vercel's domain
  // redirect it creates an infinite loop.
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
