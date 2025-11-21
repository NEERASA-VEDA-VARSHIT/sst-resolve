import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },
  // Mark server-only packages as external (prevents client bundling)
  // This works with both Turbopack and Webpack
  serverExternalPackages: ['postgres', 'pg', 'better-sqlite3'],
  // Explicitly configure Turbopack to eliminate webpack warning
  // Using --turbopack flag in build scripts
  turbopack: {
    // Turbopack configuration - empty object tells Next.js we're using Turbopack
    // The 'server-only' package in src/db/index.ts handles server-only modules
  },
};

export default nextConfig;
