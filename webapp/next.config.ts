import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "img.hellofresh.com" }] },
  // Allow access to hero images served from the recipes/ directory at the repo root.
  // The recipe data lives outside webapp/ — see src/lib/repo-paths.ts.
};

export default config;
