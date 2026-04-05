/**
 * 截图核心逻辑，按环境选择不同的 Playwright 实现。
 * - 本地开发：playwright（带本地浏览器缓存）
 * - 生产环境（Vercel）：@sparticuz/chromium（serverless 专用）
 */

import type { Browser } from 'playwright-core';

export interface ScreenshotOptions {
  url: string;
  fullPage?: boolean;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** 生产环境（Vercel）：用 @sparticuz/chromium */
async function launchProductionBrowser(): Promise<Browser> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require('@sparticuz/chromium');
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });
}

/** 本地开发：用 playwright */
async function launchLocalBrowser(): Promise<Browser> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const playwright = require('playwright');
  return playwright.chromium.launch({ headless: true });
}

/**
 * 截取网页，返回 PNG Buffer
 */
export async function captureScreenshot({ url, fullPage = true }: ScreenshotOptions): Promise<Buffer> {
  const browser = await (isProduction() ? launchProductionBrowser() : launchLocalBrowser());
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const buffer = await page.screenshot({ type: 'png', fullPage });
    // playwright screenshot 返回 Buffer | string；统一转为 Buffer
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}
