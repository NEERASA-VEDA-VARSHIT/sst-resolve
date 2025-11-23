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
  serverExternalPackages: ['postgres', 'pg', 'better-sqlite3', 'drizzle-orm'],
};

export default nextConfig;
