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
  // Explicitly configure Turbopack to eliminate webpack warning
  // Using --turbopack flag in build scripts
  experimental: {
    // Mark server-only packages as external (prevents client bundling)
    // This works with both Turbopack and Webpack
    serverComponentsExternalPackages: ['postgres', 'pg', 'better-sqlite3'],
    // Turbopack configuration - empty object tells Next.js we're using Turbopack
    turbo: {},
  },
};

export default nextConfig;
