import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  turbopack: {},
};

export default nextConfig;
