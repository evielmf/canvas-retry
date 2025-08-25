import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Updated Turbopack configuration
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  typescript: {
    // Allow production builds to successfully complete even if there are type errors
    ignoreBuildErrors: false,
  },
  eslint: {
    // Disable during builds for faster compilation (optional)
    ignoreDuringBuilds: false,
  },
  images: {
    domains: ['images.unsplash.com', 'github.com', 'avatars.githubusercontent.com'],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
};

export default nextConfig;