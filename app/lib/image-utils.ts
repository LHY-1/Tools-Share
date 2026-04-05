/**
 * 图片存储工具。
 * 上传图片时调用 saveLocalImage()，将图片本体写入 IndexedDB images store，
 * 返回稳定 imageId，将工具字段中的 data: URL 替换为 __local_image:<id> 引用。
 */

import { saveImage, loadImage, loadAllImages } from './db';
import type { StoredTool } from '../types';

/** data: URL → imageId（稳定哈希） */
export function dataUrlToImageId(dataUrl: string): string {
  let hash = 0;
  for (let i = 0; i < dataUrl.length; i++) {
    hash = (hash * 31 + dataUrl.charCodeAt(i)) >>> 0;
  }
  return `local_${hash.toString(16).padStart(8, '0')}`;
}

/**
 * 将一个 data: URL 写入 IndexedDB images store。
 * 幂等：已存在则直接返回 imageId。
 * 返回 imageId。
 */
export async function saveLocalImage(dataUrl: string): Promise<string> {
  const imageId = dataUrlToImageId(dataUrl);
  const existing = await loadImage(imageId);
  if (existing) return imageId;

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error(`无法解析 data URL: ${dataUrl.slice(0, 50)}`);

  const { mimeType, base64 } = parsed;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const filename = `${imageId}.${extFromMime(mimeType)}`;

  await saveImage({ id: imageId, blob, mimeType, filename });
  return imageId;
}

/**
 * 将工具中所有 data: URL 字段里的本地图片写入 IndexedDB，
 * 并将 data: URL 替换为 __local_image:<id> 引用。
 * 返回更新后的字段。
 */
export async function persistLocalImages(fields: {
  imageUrl?: string;
  screenshotLink?: string;
  screenshots?: string[];
}): Promise<{
  imageUrl: string;
  screenshotLink: string;
  screenshots: string[];
}> {
  const results = {
    imageUrl: fields.imageUrl ?? '',
    screenshotLink: fields.screenshotLink ?? '',
    screenshots: [...(fields.screenshots ?? [])],
  };

  if (isLocalImage(results.imageUrl)) {
    const id = await saveLocalImage(results.imageUrl);
    results.imageUrl = `__local_image:${id}`;
  }
  if (isLocalImage(results.screenshotLink)) {
    const id = await saveLocalImage(results.screenshotLink);
    results.screenshotLink = `__local_image:${id}`;
  }
  for (let i = 0; i < results.screenshots.length; i++) {
    if (isLocalImage(results.screenshots[i])) {
      const id = await saveLocalImage(results.screenshots[i]);
      results.screenshots[i] = `__local_image:${id}`;
    }
  }

  return results;
}

export function isLocalImage(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('blob:');
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mimeType] ?? 'bin';
}

// ─── 外链图片自动转本地 ────────────────────────────────────────────────────────

/**
 * 判断一个字符串是否是外部 http/https URL。
 * 注意：__local_image:* 和 data: URL 返回 false。
 */
export function isExternalUrl(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 抓取外链图片并写入 IndexedDB images store。
 * 返回 imageId（形如 remote_<md5>_<timestamp>）。
 * 失败时返回 null。
 */
export async function fetchAndStoreExternalImage(
  url: string
): Promise<{ imageId: string; fallback: false } | { imageId: null; fallback: true; error: string }> {
  try {
    const apiUrl = `/api/fetch-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl);
    const json = (await res.json()) as { dataUrl?: string; error?: string };

    if (!res.ok || !json.dataUrl) {
      return { imageId: null, fallback: true, error: json.error ?? `HTTP ${res.status}` };
    }

    // data URL 已到手，后续走现有 saveLocalImage 流程
    const imageId = await saveLocalImage(json.dataUrl);
    return { imageId, fallback: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { imageId: null, fallback: true, error: msg };
  }
}

export interface ProcessImagesResult {
  results: {
    imageUrl: { success: boolean; fallback: boolean; error?: string };
    screenshotLink: { success: boolean; fallback: boolean; error?: string };
    screenshots: Array<{ success: boolean; fallback: boolean; error?: string; index: number }>;
  };
  processedFields: {
    imageUrl: string;
    screenshotLink: string;
    screenshots: string[];
  };
}

/**
 * 处理工具的所有图片字段：
 * - __local_image:* → 跳过（已是本地引用）
 * - data: / blob: → 跳过（本地图片走 saveLocalImage）
 * - 外链 URL → 调用 /api/fetch-image → 保存到 IndexedDB → 替换为 __local_image:<id>
 * - 其他（非 URL 字符串）→ 保留原值（fallback）
 *
 * 同时对 data: URL 调用 saveLocalImage（确保 IndexedDB images store 也有副本）。
 *
 * 返回每一步的处理结果及替换后的字段。
 */
export async function processExternalImages(
  fields: {
    imageUrl?: string;
    screenshotLink?: string;
    screenshots?: string[];
  },
  onProgress?: (msg: string) => void
): Promise<ProcessImagesResult> {
  let outImageUrl = fields.imageUrl ?? '';
  let outScreenshotLink = fields.screenshotLink ?? '';
  const outScreenshots = [...(fields.screenshots ?? [])];

  const result: {
    imageUrl: { success: boolean; fallback: boolean; error?: string };
    screenshotLink: { success: boolean; fallback: boolean; error?: string };
    screenshots: Array<{ success: boolean; fallback: boolean; error?: string; index: number }>;
  } = {
    imageUrl: { success: false, fallback: false },
    screenshotLink: { success: false, fallback: false },
    screenshots: [],
  };

  // ── imageUrl ────────────────────────────────────────────────────────────────
  if (isExternalUrl(outImageUrl)) {
    onProgress?.(`正在抓取外链图片 imageUrl: ${outImageUrl}`);
    const r = await fetchAndStoreExternalImage(outImageUrl);
    if (r.imageId) {
      outImageUrl = `__local_image:${r.imageId}`;
      result.imageUrl = { success: true, fallback: false };
    } else {
      const fallback = r as { imageId: null; fallback: true; error: string };
      result.imageUrl = { success: false, fallback: true, error: fallback.error };
    }
  } else if (isLocalImage(outImageUrl)) {
    // data: URL 也持久化到 IndexedDB
    try {
      await saveLocalImage(outImageUrl);
      const id = dataUrlToImageId(outImageUrl);
      outImageUrl = `__local_image:${id}`;
      result.imageUrl = { success: true, fallback: false };
    } catch {
      result.imageUrl = { success: false, fallback: true, error: 'data URL 解析失败' };
    }
  } else if (outImageUrl.startsWith('__local_image:')) {
    result.imageUrl = { success: true, fallback: false }; // 已本地，跳过
  } else if (outImageUrl) {
    // 非 URL 字符串，保留（fallback）
    result.imageUrl = { success: false, fallback: true, error: '非 URL 内容' };
  }

  // ── screenshotLink ───────────────────────────────────────────────────────────
  if (isExternalUrl(outScreenshotLink)) {
    onProgress?.(`正在抓取外链图片 screenshotLink: ${outScreenshotLink}`);
    const r2 = await fetchAndStoreExternalImage(outScreenshotLink);
    if (r2.imageId) {
      outScreenshotLink = `__local_image:${r2.imageId}`;
      result.screenshotLink = { success: true, fallback: false };
    } else {
      result.screenshotLink = { success: false, fallback: true, error: (r2 as { imageId: null; fallback: true; error: string }).error };
    }
  } else if (isLocalImage(outScreenshotLink)) {
    try {
      await saveLocalImage(outScreenshotLink);
      const id = dataUrlToImageId(outScreenshotLink);
      outScreenshotLink = `__local_image:${id}`;
      result.screenshotLink = { success: true, fallback: false };
    } catch {
      result.screenshotLink = { success: false, fallback: true, error: 'data URL 解析失败' };
    }
  } else if (outScreenshotLink.startsWith('__local_image:')) {
    result.screenshotLink = { success: true, fallback: false };
  } else if (outScreenshotLink) {
    result.screenshotLink = { success: false, fallback: true, error: '非 URL 内容' };
  }

  // ── screenshots ─────────────────────────────────────────────────────────────
  for (let i = 0; i < outScreenshots.length; i++) {
    const s = outScreenshots[i];
    if (isExternalUrl(s)) {
      onProgress?.(`正在抓取外链图片 screenshots[${i}]: ${s}`);
      const r3 = await fetchAndStoreExternalImage(s);
      if (r3.imageId) {
        outScreenshots[i] = `__local_image:${r3.imageId}`;
        result.screenshots.push({ success: true, fallback: false, index: i });
      } else {
        result.screenshots.push({ success: false, fallback: true, error: (r3 as { imageId: null; fallback: true; error: string }).error, index: i });
      }
    } else if (isLocalImage(s)) {
      try {
        await saveLocalImage(s);
        const id = dataUrlToImageId(s);
        outScreenshots[i] = `__local_image:${id}`;
        result.screenshots.push({ success: true, fallback: false, index: i });
      } catch {
        result.screenshots.push({ success: false, fallback: true, error: 'data URL 解析失败', index: i });
      }
    } else if (s.startsWith('__local_image:')) {
      result.screenshots.push({ success: true, fallback: false, index: i });
    } else {
      result.screenshots.push({ success: false, fallback: true, error: '非 URL 内容', index: i });
    }
  }

  return {
    results: result,
    processedFields: {
      imageUrl: outImageUrl,
      screenshotLink: outScreenshotLink,
      screenshots: outScreenshots,
    },
  };
}

// ─── 加载时解析引用 ───────────────────────────────────────────────────────────

/** blob → data: URL */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 将工具中所有 __local_image:<id> 引用替换为真实的 data: URL。
 * 加载工具时调用此函数，才能正确预览图片。
 */
export async function resolveImageRefs(
  tool: StoredTool
): Promise<StoredTool> {
  const clone = { ...tool };
  const refs = extractLocalRefs(tool);
  if (refs.length === 0) return clone;

  // 一次加载所有图片，避免多次 openDB
  const allImages = await loadAllImages();
  const imageMap = new Map(allImages.map((img) => [img.id, img]));

  if (
    typeof clone.imageUrl === 'string' &&
    clone.imageUrl.startsWith('__local_image:')
  ) {
    const img = imageMap.get(clone.imageUrl.replace('__local_image:', ''));
    if (img) clone.imageUrl = await blobToDataUrl(img.blob);
  }

  if (
    typeof clone.screenshotLink === 'string' &&
    clone.screenshotLink.startsWith('__local_image:')
  ) {
    const img = imageMap.get(clone.screenshotLink.replace('__local_image:', ''));
    if (img) clone.screenshotLink = await blobToDataUrl(img.blob);
  }

  if (clone.screenshots) {
    clone.screenshots = await Promise.all(
      clone.screenshots.map(async (s) => {
        if (s.startsWith('__local_image:')) {
          const img = imageMap.get(s.replace('__local_image:', ''));
          return img ? await blobToDataUrl(img.blob) : s;
        }
        return s;
      })
    );
  }

  return clone;
}

/** 从工具中提取所有 __local_image:<id> 引用 */
function extractLocalRefs(tool: StoredTool): string[] {
  const refs: string[] = [];
  if (typeof tool.imageUrl === 'string' && tool.imageUrl.startsWith('__local_image:'))
    refs.push(tool.imageUrl);
  if (typeof tool.screenshotLink === 'string' && tool.screenshotLink.startsWith('__local_image:'))
    refs.push(tool.screenshotLink);
  if (tool.screenshots) {
    for (const s of tool.screenshots) {
      if (s.startsWith('__local_image:')) refs.push(s);
    }
  }
  return refs;
}
