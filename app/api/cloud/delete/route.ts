import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function DELETE(req: NextRequest) {
  try {
    const { key } = await req.json();
    if (!key) {
      return NextResponse.json({ error: 'key required' }, { status: 400 });
    }

    const url = process.env.KV_REST_API_URL!;
    const token = process.env.KV_REST_API_TOKEN!;

    const res = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
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
