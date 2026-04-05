import { NextRequest, NextResponse } from 'next/server';
import pako from 'pako';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json();
    if (!key) {
      return NextResponse.json({ error: 'key required' }, { status: 400 });
    }

    const url = process.env.KV_REST_API_URL!;
    const token = process.env.KV_REST_API_TOKEN!;

    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json() as { result?: string; error?: string };
    if (!res.ok || data.error) {
      return NextResponse.json(data, { status: res.status });
    }

    // Upstash 返回的 result 是 gzip 字节的 base64 编码字符串
    // 转为 Buffer → pako ungzip → JSON.parse
    let tools: unknown;
    if (data.result) {
      try {
        const compressed = Buffer.from(data.result, 'base64');
        const jsonStr = pako.ungzip(compressed, { to: 'string' });
        tools = JSON.parse(jsonStr);
      } catch {
        // 尝试直接 parse（可能是未压缩的旧数据）
        try {
          tools = JSON.parse(data.result);
        } catch {
          return NextResponse.json({ error: '数据解压失败，可能是损坏的记录' }, { status: 500 });
        }
      }
    } else {
      tools = null;
    }

    return NextResponse.json({ tools });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
