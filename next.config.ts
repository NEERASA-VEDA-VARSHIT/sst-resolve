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
  // Added drizzle-orm to fix server-only import errors in build
  serverExternalPackages: ['postgres', 'pg', 'better-sqlite3', 'drizzle-orm'],
  // Explicitly configure Turbopack
  // Using --turbopack flag in build scripts
  turbopack: {
    // Turbopack configuration - serverExternalPackages handles server-only modules
  },
};

export default nextConfig;
