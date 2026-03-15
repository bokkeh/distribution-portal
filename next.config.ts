import type { NextConfig } from "next";

const allowedOrigins = [
  'localhost:3000',
  'ahawc.com',
  'www.ahawc.com',
]

if (process.env.VERCEL_URL) {
  allowedOrigins.push(process.env.VERCEL_URL)
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
