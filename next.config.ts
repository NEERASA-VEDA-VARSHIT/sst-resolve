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
  // Webpack configuration as fallback
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js modules from client bundle
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        perf_hooks: false,
        stream: false,
      };
    }
    return config;
  },
  // Turbopack configuration
  turbopack: {
    // Explicitly mark server-only packages
    resolveAlias: {
      // Ensure these are treated as external in server context
    },
  },
};

export default nextConfig;
