import { NextRequest, NextResponse } from 'next/server';
import { loadTools } from '@/app/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json();
    if (!key || !value) {
      return NextResponse.json({ error: 'key and value required' }, { status: 400 });
    }

    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;

    const res = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
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
