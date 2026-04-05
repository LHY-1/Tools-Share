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
