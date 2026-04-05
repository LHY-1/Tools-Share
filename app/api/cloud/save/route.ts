import { NextRequest, NextResponse } from 'next/server';
import pako from 'pako';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || !value) {
      return NextResponse.json({ error: 'key and value required' }, { status: 400 });
    }

    // 自动识别：value 为 gzip+base64 时先解压
    let finalValue = value;
    if (body.compressed) {
      try {
        const raw = Buffer.from(value, 'base64');
        finalValue = pako.ungzip(raw, { to: 'string' });
      } catch {
        return NextResponse.json({ error: 'gzip decompress failed' }, { status: 400 });
      }
    }

    const url = process.env.KV_REST_API_URL!;
    const token = process.env.KV_REST_API_TOKEN!;

    const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: finalValue,
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
