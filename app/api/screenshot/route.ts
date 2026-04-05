import { NextRequest, NextResponse } from 'next/server';
import playwright from 'playwright';

export async function POST(request: NextRequest) {
  try {
    const { url, fullPage = true } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let browser = null;
    try {
      browser = await playwright.chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // fullPage: true 截取整个页面，false 只截取视口区域
      const screenshotBuffer = await page.screenshot({ type: 'png', fullPage });
      
      return new NextResponse(screenshotBuffer, {
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
