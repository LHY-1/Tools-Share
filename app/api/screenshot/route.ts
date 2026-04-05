import { NextRequest, NextResponse } from 'next/server';

// 动态导入 Playwright，避免 Turbopack 静态分析时崩溃
async function getPlaywright() {
  const { default: playwright } = await import('playwright');
  return playwright;
}

export async function POST(request: NextRequest) {
  try {
    const { url, fullPage = true } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let browser = null;
    try {
      const playwright = await getPlaywright();
      browser = await playwright.chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      const screenshotBuffer = await page.screenshot({ type: 'png', fullPage });

      return new Response(new Uint8Array(screenshotBuffer), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  } catch (error) {
    console.error('Screenshot error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate screenshot' },
      { status: 500 }
    );
  }
}
