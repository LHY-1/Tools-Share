/**
 * 图片存储工具 (Vercel Blob 版)
 *
 * 上传图片时：
 * 1. 先调用 saveLocalImage() 写入 IndexedDB（本地草稿缓存，快）
 * 2. 再调用 uploadToBlob() 上传到 Vercel Blob，获得永久 URL
 * 3. 工具字段里只存 Vercel Blob URL，不存图片本体
 *
 * 加载图片时：
 * - Blob URL / 外链 URL → 直接用 <img src={url}>
 * - __local_image:<id> → 从 IndexedDB 读取 data: URL（本地缓存优先）
 */

import { saveImage, loadImage, loadAllImages } from './db';
import type { StoredTool } from '../types';
import { useState, useEffect } from 'react';

// ─── Blob 上传 ─────────────────────────────────────────────────────────────────

/**
 * 上传 File/Blob 到 Vercel Blob，返回永久 URL。
 */
export async function uploadToBlob(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
  const json = await res.json() as { url?: string; error?: string };

  if (!res.ok || !json.url) {
    throw new Error(json.error ?? '上传失败');
  }
  return json.url;
}

/**
 * 把 data: URL 转成 File，再上传到 Vercel Blob。
 */
export async function uploadDataUrlToBlob(dataUrl: string): Promise<string> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error(`无法解析 data URL: ${dataUrl.slice(0, 50)}`);

  const { mimeType, base64 } = parsed;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const ext = extFromMime(mimeType);
  const filename = `${Date.now()}.${ext}`;
  const file = new File([blob], filename, { type: mimeType });

  return uploadToBlob(file);
}

// ─── IndexedDB 草稿缓存 ────────────────────────────────────────────────────────

/** data: URL → imageId（稳定哈希） */
export function dataUrlToImageId(dataUrl: string): string {
  let hash = 0;
  for (let i = 0; i < dataUrl.length; i++) {
    hash = (hash * 31 + dataUrl.charCodeAt(i)) >>> 0;
  }
  return `local_${hash.toString(16).padStart(8, '0')}`;
}

/**
 * 将一个 data: URL 写入 IndexedDB images store（本地草稿缓存）。
 * 幂等：已存在则直接返回 imageId。
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
 * 将工具中所有 data: URL 字段里的本地图片写入 IndexedDB（草稿缓存），
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

// ─── 图片类型判断 ─────────────────────────────────────────────────────────────

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
 * 判断是否是 Vercel Blob URL（永久 URL，包含cdn.vercel-storage.com）。
 */
export function isBlobUrl(value: string): boolean {
  return typeof value === 'string' && (
    value.includes('cdn.vercel-storage.com') ||
    value.includes('public-')
  );
}

// ─── 外链图片处理 ─────────────────────────────────────────────────────────────

/**
 * 抓取外链图片并上传到 Vercel Blob。
 * 返回 blob URL（形如 https://cdn.vercel-storage.com/xxx.png）。
 */
export async function fetchAndStoreExternalImage(
  url: string
): Promise<{ blobUrl: string } | { blobUrl: null; error: string }> {
  try {
    const apiUrl = `/api/fetch-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl);
    const json = await res.json() as { dataUrl?: string; error?: string };

    if (!res.ok || !json.dataUrl) {
      return { blobUrl: null, error: json.error ?? `HTTP ${res.status}` };
    }

    // data URL 已到手 → 上传到 Vercel Blob
    const blobUrl = await uploadDataUrlToBlob(json.dataUrl);
    return { blobUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { blobUrl: null, error: msg };
  }
}

export interface ProcessImagesResult {
  results: {
    imageUrl: { success: boolean; error?: string };
    screenshotLink: { success: boolean; error?: string };
    screenshots: Array<{ success: boolean; error?: string; index: number }>;
  };
  processedFields: {
    imageUrl: string;
    screenshotLink: string;
    screenshots: string[];
  };
}

/**
 * 处理工具的所有图片字段，统一转成 Vercel Blob URL：
 * - Blob URL（cdn.vercel-storage.com）→ 跳过，已是最终形态
 * - __local_image:<id> → 从 IndexedDB 读取 data: URL → 上传到 Blob
 * - data: / blob: → 上传到 Blob
 * - 外链 URL → /api/fetch-image 下载 → 上传到 Blob
 *
 * 工具数据中最终只存 Vercel Blob URL。
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

  interface FieldResult { success: boolean; error?: string; }
  const result: {
    imageUrl: FieldResult;
    screenshotLink: FieldResult;
    screenshots: Array<FieldResult & { index: number }>;
  } = {
    imageUrl: { success: false },
    screenshotLink: { success: false },
    screenshots: [],
  };

  // ── imageUrl ──────────────────────────────────────────────────────────────
  if (isBlobUrl(outImageUrl)) {
    result.imageUrl = { success: true };
  } else if (isExternalUrl(outImageUrl)) {
    onProgress?.(`正在抓取外链图片 imageUrl: ${outImageUrl}`);
    const r = await fetchAndStoreExternalImage(outImageUrl);
    if (r.blobUrl) {
      outImageUrl = r.blobUrl;
      result.imageUrl = { success: true };
    } else {
      const err = (r as { blobUrl: null; error: string }).error;
      result.imageUrl = { success: false, error: err };
    }
  } else if (outImageUrl.startsWith('__local_image:')) {
    // 从 IndexedDB 读取并上传到 Blob
    const id = outImageUrl.replace('__local_image:', '');
    const img = await loadImage(id);
    if (img) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(img.blob);
      });
      outImageUrl = await uploadDataUrlToBlob(dataUrl);
      result.imageUrl = { success: true };
    } else {
      result.imageUrl = { success: false, error: '本地图片未找到' };
    }
  } else if (isLocalImage(outImageUrl)) {
    outImageUrl = await uploadDataUrlToBlob(outImageUrl);
    result.imageUrl = { success: true };
  } else if (outImageUrl) {
    result.imageUrl = { success: false, error: '非 URL 内容' };
  }

  // ── screenshotLink ──────────────────────────────────────────────────────
  if (isBlobUrl(outScreenshotLink)) {
    result.screenshotLink = { success: true };
  } else if (isExternalUrl(outScreenshotLink)) {
    onProgress?.(`正在抓取外链图片 screenshotLink: ${outScreenshotLink}`);
    const r = await fetchAndStoreExternalImage(outScreenshotLink);
    if (r.blobUrl) {
      outScreenshotLink = r.blobUrl;
      result.screenshotLink = { success: true };
    } else {
      const err = (r as { blobUrl: null; error: string }).error;
      result.screenshotLink = { success: false, error: err };
    }
  } else if (outScreenshotLink.startsWith('__local_image:')) {
    const id = outScreenshotLink.replace('__local_image:', '');
    const img = await loadImage(id);
    if (img) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(img.blob);
      });
      outScreenshotLink = await uploadDataUrlToBlob(dataUrl);
      result.screenshotLink = { success: true };
    } else {
      result.screenshotLink = { success: false, error: '本地图片未找到' };
    }
  } else if (isLocalImage(outScreenshotLink)) {
    outScreenshotLink = await uploadDataUrlToBlob(outScreenshotLink);
    result.screenshotLink = { success: true };
  } else if (outScreenshotLink) {
    result.screenshotLink = { success: false, error: '非 URL 内容' };
  }

  // ── screenshots ─────────────────────────────────────────────────────────
  for (let i = 0; i < outScreenshots.length; i++) {
    const s = outScreenshots[i];
    if (isBlobUrl(s)) {
      result.screenshots.push({ success: true, index: i });
    } else if (isExternalUrl(s)) {
      onProgress?.(`正在抓取外链图片 screenshots[${i}]: ${s}`);
      const r = await fetchAndStoreExternalImage(s);
      if (r.blobUrl) {
        outScreenshots[i] = r.blobUrl;
        result.screenshots.push({ success: true, index: i });
      } else {
        const err = (r as { blobUrl: null; error: string }).error;
        result.screenshots.push({ success: false, error: err, index: i });
      }
    } else if (s.startsWith('__local_image:')) {
      const id = s.replace('__local_image:', '');
      const img = await loadImage(id);
      if (img) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(img.blob);
        });
        outScreenshots[i] = await uploadDataUrlToBlob(dataUrl);
        result.screenshots.push({ success: true, index: i });
      } else {
        result.screenshots.push({ success: false, error: '本地图片未找到', index: i });
      }
    } else if (isLocalImage(s)) {
      outScreenshots[i] = await uploadDataUrlToBlob(s);
      result.screenshots.push({ success: true, index: i });
    } else {
      result.screenshots.push({ success: false, error: '非 URL 内容', index: i });
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

// ─── 加载时解析引用（保留，向后兼容）───────────────────────────────────────────

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
 * 仅用于向后兼容（老数据中 __local_image 引用还没迁移到 Blob URL 的情况）。
 */
export async function resolveImageRefs(tool: StoredTool): Promise<StoredTool> {
  const clone = { ...tool };
  const refs = extractLocalRefs(tool);
  if (refs.length === 0) return clone;

  const allImages = await loadAllImages();
  const imageMap = new Map(allImages.map((img) => [img.id, img]));

  if (typeof clone.imageUrl === 'string' && clone.imageUrl.startsWith('__local_image:')) {
    const img = imageMap.get(clone.imageUrl.replace('__local_image:', ''));
    if (img) clone.imageUrl = await blobToDataUrl(img.blob);
  }

  if (typeof clone.screenshotLink === 'string' && clone.screenshotLink.startsWith('__local_image:')) {
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

// ─── LocalImage 组件（保留，向后兼容）──────────────────────────────────────────

/**
 * 智能图片组件：
 * - Blob URL / 外链 URL → 直接渲染
 * - __local_image:<id> → 从 IndexedDB 读取 data: URL 再渲染
 *
 * 新数据迁移完成后，图片字段基本都是 URL，此组件退化为普通 <img>。
 */
export function LocalImage({
  src,
  alt,
  ...imgProps
}: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  const [resolved, setResolved] = useState(src);

  useEffect(() => {
    if (!src.startsWith('__local_image:')) {
      setResolved(src);
      return;
    }
    const id = src.replace('__local_image:', '');
    loadImage(id)
      .then((img) => {
        if (!img) return;
        const reader = new FileReader();
        reader.onload = () => setResolved(reader.result as string);
        reader.readAsDataURL(img.blob);
      })
      .catch(() => {});
  }, [src]);

  return <img src={resolved} alt={alt} {...imgProps} />;
}

// ─── 云端同步：图片实化 ────────────────────────────────────────────────────────

export interface SyncImageResult {
  field: 'imageUrl' | 'screenshotLink' | 'screenshots';
  index?: number;
  original: string;
  finalUrl: string;
  success: boolean;
  error?: string;
}

/**
 * 云端同步专用：将单个图片 URL 实化为云端 Blob URL。
 * 规则：
 * - Blob URL → 跳过（已是云端形态）
 * - __local_image:<id> → 读 IndexedDB → 上传 Blob → blobUrl
 * - data: / blob: → 上传 Blob → blobUrl
 * - 外链 URL → 下载 → 上传 Blob → blobUrl
 * - 空值 → 跳过，保留空字符串
 *
 * 失败时抛出错误。
 */
export async function materializeImageToCloud(
  field: 'imageUrl' | 'screenshotLink' | 'screenshots',
  value: string,
  index?: number
): Promise<SyncImageResult> {
  // 空值
  if (!value) {
    return { field, index, original: value, finalUrl: '', success: true };
  }

  // Blob URL：已是云端，跳过
  if (isBlobUrl(value)) {
    return { field, index, original: value, finalUrl: value, success: true };
  }

  // 外链 URL：下载 → 上传 Blob
  if (isExternalUrl(value)) {
    const r = await fetchAndStoreExternalImage(value);
    if (!r.blobUrl) {
      const err = (r as { blobUrl: null; error: string }).error;
      throw new Error(`[${field}${index !== undefined ? `[${index}]` : ''}] 外链下载失败: ${err}`);
    }
    return { field, index, original: value, finalUrl: r.blobUrl, success: true };
  }

  // __local_image:<id>：从 IndexedDB 读取 → 上传 Blob
  if (value.startsWith('__local_image:')) {
    const id = value.replace('__local_image:', '');
    const img = await loadImage(id);
    if (!img) {
      throw new Error(`[${field}${index !== undefined ? `[${index}]` : ''}] 本地图片未找到: ${id}`);
    }
    const blobUrl = await uploadBlobFromIndexedDB(img, `local-${id}`);
    return { field, index, original: value, finalUrl: blobUrl, success: true };
  }

  // data: / blob:：直接上传 Blob
  if (isLocalImage(value)) {
    const blobUrl = await uploadDataUrlToBlob(value);
    return { field, index, original: value, finalUrl: blobUrl, success: true };
  }

  // 其他非图片字符串（如下载链接）：跳过
  return { field, index, original: value, finalUrl: value, success: true };
}

/** 将 IndexedDB 中的图片记录上传到 Vercel Blob */
async function uploadBlobFromIndexedDB(
  img: { blob: Blob; mimeType: string },
  prefix: string
): Promise<string> {
  const ext = extFromMime(img.mimeType);
  const filename = `${prefix}-${Date.now()}.${ext}`;
  const file = new File([img.blob], filename, { type: img.mimeType });
  return uploadToBlob(file);
}

/**
 * 将工具中所有图片字段实化为云端 Blob URL。
 * 任意一张图片失败 → 整工具同步失败。
 *
 * @param tool 原始工具数据
 * @param onProgress 进度回调
 * @returns 实化后的工具（图片字段全是 Blob URL）
 */
export async function materializeToolImagesToCloud(
  tool: StoredTool,
  onProgress?: (msg: string) => void
): Promise<{ tool: StoredTool; results: SyncImageResult[] }> {
  const results: SyncImageResult[] = [];

  // imageUrl
  const r1 = await materializeImageToCloud('imageUrl', tool.imageUrl ?? '');
  results.push(r1);
  const imageUrl = r1.finalUrl;

  // screenshotLink
  const r2 = await materializeImageToCloud('screenshotLink', tool.screenshotLink ?? '');
  results.push(r2);
  const screenshotLink = r2.finalUrl;

  // screenshots[]
  const screenshots: string[] = [];
  for (let i = 0; i < (tool.screenshots ?? []).length; i++) {
    onProgress?.(`正在上传截图 ${i + 1}/${tool.screenshots!.length}...`);
    const rs = await materializeImageToCloud('screenshots', tool.screenshots![i], i);
    results.push(rs);
    screenshots.push(rs.finalUrl);
  }

  return {
    tool: { ...tool, imageUrl, screenshotLink, screenshots },
    results,
  };
}
