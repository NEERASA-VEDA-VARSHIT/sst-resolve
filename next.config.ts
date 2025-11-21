import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Allow production builds to succeed even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to complete even if there are type errors
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  // Note: Using Turbopack (--turbopack flag in build scripts)
  // The 'server-only' package in src/db/index.ts handles server-only modules
  // No webpack config needed - Turbopack respects 'server-only' automatically
};

export default nextConfig;
