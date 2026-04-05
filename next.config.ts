import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  turbopack: {},
  serverExternalPackages: ['playwright'],
};

export default nextConfig;
