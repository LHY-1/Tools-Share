import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // 告诉 webpack/Next.js 不要把这些包打包进输出文件
  // 生产环境由运行时环境提供（如 @sparticuz/chromium 的二进制）
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium'],
};

export default nextConfig;
