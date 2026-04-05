import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  serverExternalPackages: ["playwright"],
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
