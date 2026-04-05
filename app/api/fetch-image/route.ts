/**
 * 服务端图片抓取接口。
 * 接收图片 URL，服务端请求（绕过 CORS / Referer 限制），校验后返回 data URL。
 *
 * 安全措施：
 * - 仅允许 http / https
 * - 仅接受 image/* 响应类型
 * - 文件大小上限 10MB
 * - 只返回 data URL，不做代理转发
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url');

  if (!url) {
    return new Response(JSON.stringify({ error: 'url 参数缺失' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 协议白名单
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return new Response(JSON.stringify({ error: '无效的 URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return new Response(JSON.stringify({ error: '仅支持 http / https 协议' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 服务端请求（Vercel Edge / Node.js 均可）
  let response: Response;
  try {
    response = await fetch(parsedUrl.toString(), {
      signal: AbortSignal.timeout(15000),
      headers: {
        // 模拟常见浏览器 UA，减少被拦截概率
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `请求失败: ${msg}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: `图片服务器返回 ${response.status}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Content-Type 校验
  const contentType = response.headers.get('content-type') ?? '';
  const isImage = ALLOWED_TYPES.some((t) => contentType.startsWith(t));
  if (!isImage) {
    return new Response(
      JSON.stringify({ error: `非图片类型: ${contentType}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 大小校验
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
    return new Response(JSON.stringify({ error: '图片超过 10MB 限制' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 流式读取 + 大小上限保护
  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  const reader = response.body?.getReader();
  if (!reader) {
    return new Response(JSON.stringify({ error: '无法读取响应体' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_SIZE) {
        reader.cancel();
        return new Response(JSON.stringify({ error: '图片超过 10MB 限制' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      chunks.push(value);
    }
  } catch {
    return new Response(JSON.stringify({ error: '读取图片数据时出错' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 合并为 ArrayBuffer → base64 → data URL
  const buffer = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const base64 = btoa(
    Array.from(buffer)
      .map((b) => String.fromCharCode(b))
      .join('')
  );
  const dataUrl = `data:${contentType};base64,${base64}`;

  return new Response(JSON.stringify({ dataUrl }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
