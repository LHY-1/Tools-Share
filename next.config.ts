import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  serverExternalPackages: ["playwright"],
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
