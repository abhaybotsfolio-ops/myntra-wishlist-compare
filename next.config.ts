import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // All imagery is local (public/products) — no remotePatterns needed, and
  // none should ever be added (RULES A1/A2: no Myntra CDN hotlinking).
  images: { formats: ["image/avif", "image/webp"] },
  experimental: { optimizePackageImports: ["lucide-react"] },
};

export default nextConfig;
