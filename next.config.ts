import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    webpackBuildWorker: true,
  },
};

export default nextConfig;