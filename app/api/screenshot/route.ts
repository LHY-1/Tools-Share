import { NextRequest, NextResponse } from 'next/server';
import { captureScreenshot } from '@/app/lib/screenshot';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body?.url as string | undefined;
    const fullPage = body?.fullPage !== false;

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const buffer = await captureScreenshot({ url, fullPage });

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/screenshot]', message);
    return NextResponse.json({ error: `Screenshot failed: ${message}` }, { status: 500 });
  }
}
