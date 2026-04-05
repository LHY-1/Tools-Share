import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

export async function POST(request: NextRequest) {
  try {
    const { url, fullPage = true } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Launch browser
    const browser = await chromium.launch({
      headless: true,
    });

    try {
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
      });

      const page = await context.newPage();

      // Navigate to the URL
      await page.goto(targetUrl.toString(), {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait a bit for any animations to settle
      await page.waitForTimeout(1000);

      // Take screenshot
      const screenshot = await page.screenshot({
        fullPage,
        type: 'png',
      });

      return new NextResponse(screenshot, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('Screenshot error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Screenshot failed' },
      { status: 500 }
    );
  }
}
