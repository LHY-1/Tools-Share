import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    turbo: false, // ÍêÈ«½ûÓÃTurbopack
  },
};

export default nextConfig;