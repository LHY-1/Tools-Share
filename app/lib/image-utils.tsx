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
 *
 * 同步去重机制：
 * - IndexedDB blob-url-map store 维护 contentHash → blobUrl 映射
 * - 上传前先查映射，已存在则复用 URL，不重复上传
 * - 上传成功后写入映射表
 */

import { saveImage, loadImage, loadAllImages, getBlobUrlByHash, setBlobUrlByHash } from './db';
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
 * 带去重：上传前用内容哈希查全局映射表，已存在则跳过。
 * 颜色编码进 URL query (?bg=rgb(...))。
 */
export async function uploadDataUrlToBlob(dataUrl: string): Promise<string> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error(`无法解析 data URL: ${dataUrl.slice(0, 50)}`);

  const { mimeType, base64 } = parsed;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  // ── 去重 ───────────────────────────────────────────────────────────────
  const hash = await computeBlobHash(blob);
  const existing = await getBlobUrlByHash(hash);
  if (existing) {
    console.log(`[去重] data: URL 已有相同图片，跳过上传: ${hash.slice(0, 8)}...`);
    return existing;
  }

  // 计算边缘颜色
  const edgeColor = await computeEdgeColor(blob);

  const ext = extFromMime(mimeType);
  const filename = `${hash.slice(0, 12)}.${ext}`;
  const file = new File([blob], filename, { type: mimeType });
  let blobUrl: string = await uploadToBlob(file);

  // 颜色编码进 URL
  blobUrl = `${blobUrl}?bg=${encodeURIComponent(edgeColor)}`;
  await setBlobUrlByHash(hash, blobUrl, edgeColor);
  return blobUrl;
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
 * 用 Canvas 从 Blob 边缘采样，计算平均颜色。
 * 失败时返回默认灰色。
 */
async function computeEdgeColor(blob: Blob): Promise<string> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    const size = 50;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, size, size);
    bitmap.close();

    // 采样四边
    const edgePixels: number[] = [];
    const imgData = ctx.getImageData(0, 0, size, size).data;

    // 顶行 + 底行
    for (let x = 0; x < size; x++) {
      edgePixels.push(imgData[(x * 4)], imgData[(x * 4) + 1], imgData[(x * 4) + 2]);
      edgePixels.push(imgData[((size - 1) * size + x) * 4], imgData[((size - 1) * size + x) * 4 + 1], imgData[((size - 1) * size + x) * 4 + 2]);
    }
    // 左列 + 右列（排除四角）
    for (let y = 1; y < size - 1; y++) {
      edgePixels.push(imgData[(y * size) * 4], imgData[(y * size) * 4 + 1], imgData[(y * size) * 4 + 2]);
      edgePixels.push(imgData[(y * size + size - 1) * 4], imgData[(y * size + size - 1) * 4 + 1], imgData[(y * size + size - 1) * 4 + 2]);
    }

    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < edgePixels.length; i += 3) {
      r += edgePixels[i]; g += edgePixels[i + 1]; b += edgePixels[i + 2]; count++;
    }
    if (count === 0) return '#f1f5f9';
    return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
  } catch {
    return '#f1f5f9';
  }
}

/**
 * 将 data: URL 保存到 IndexedDB，同时计算边缘颜色。
 * 幂等：已存在则直接返回 imageId（含旧颜色）。
 */
export async function saveLocalImage(dataUrl: string): Promise<{ id: string; edgeColor: string }> {
  const imageId = dataUrlToImageId(dataUrl);
  const existing = await loadImage(imageId);
  if (existing) return { id: imageId, edgeColor: existing.edgeColor ?? '#f1f5f9' };

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) throw new Error(`无法解析 data URL: ${dataUrl.slice(0, 50)}`);

  const { mimeType, base64 } = parsed;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  // 同时计算边缘颜色
  const edgeColor = await computeEdgeColor(blob);
  const filename = `${imageId}.${extFromMime(mimeType)}`;

  await saveImage({ id: imageId, blob, mimeType, filename, edgeColor });
  return { id: imageId, edgeColor };
}

/**
 * 将 data: URL 保存到 IndexedDB，返回 imageId（兼容旧调用）。
 * @deprecated 请用 saveLocalImage() 返回 { id, edgeColor }
 */
export async function _saveLocalImage_legacy(dataUrl: string): Promise<string> {
  return (await saveLocalImage(dataUrl)).id;
}

/**
 * 将工具中所有图片字段（data:URL / 外链URL）写入 IndexedDB，
 * 替换为 __local_image:<id> 引用。
 * 外链会先下载再存本地。
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

  // imageUrl
  if (isLocalImage(results.imageUrl)) {
    const { id } = await saveLocalImage(results.imageUrl);
    results.imageUrl = `__local_image:${id}`;
  } else if (isExternalUrl(results.imageUrl)) {
    const { id } = await fetchAndSaveExternalImage(results.imageUrl);
    results.imageUrl = `__local_image:${id}`;
  }

  // screenshotLink
  if (isLocalImage(results.screenshotLink)) {
    const { id } = await saveLocalImage(results.screenshotLink);
    results.screenshotLink = `__local_image:${id}`;
  } else if (isExternalUrl(results.screenshotLink)) {
    const { id } = await fetchAndSaveExternalImage(results.screenshotLink);
    results.screenshotLink = `__local_image:${id}`;
  }

  // screenshots
  for (let i = 0; i < results.screenshots.length; i++) {
    const s = results.screenshots[i];
    if (isLocalImage(s)) {
      const { id } = await saveLocalImage(s);
      results.screenshots[i] = `__local_image:${id}`;
    } else if (isExternalUrl(s)) {
      const { id } = await fetchAndSaveExternalImage(s);
      results.screenshots[i] = `__local_image:${id}`;
    }
  }

  return results;
}

/** 下载外链图片 → 存 IndexedDB，返回 { id, edgeColor } */
async function fetchAndSaveExternalImage(url: string): Promise<{ id: string; edgeColor: string }> {
  const apiUrl = `/api/fetch-image?url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl);
  const json = await res.json() as { dataUrl?: string; error?: string };
  if (!res.ok || !json.dataUrl) throw new Error(json.error ?? `HTTP ${res.status}`);
  return saveLocalImage(json.dataUrl);
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
}: React.ImgHTMLAttributes<HTMLImageElement> & { src?: string; alt?: string }) {
  // 初始为空，让 useEffect 先执行，避免首次 render 时 src="__local_image:xxx" 导致 <img src=""> 错误
  const [resolved, setResolved] = useState('');

  useEffect(() => {
    if (!src) {
      setResolved('');
      return;
    }
    if (!src.startsWith('__local_image:')) {
      // 普通 URL（Blob URL / 外链 / data:）
      setResolved(src);
      return;
    }
    const id = src.replace('__local_image:', '');
    console.log('[LocalImage] loading id:', id);
    loadImage(id)
      .then((img) => {
        console.log('[LocalImage] loadImage result:', img ? `found blob=${img.blob.size}b` : 'null');
        if (!img) return;
        const reader = new FileReader();
        reader.onload = () => {
          console.log('[LocalImage] FileReader done, dataUrl len:', (reader.result as string).length);
          setResolved(reader.result as string);
        };
        reader.readAsDataURL(img.blob);
      })
      .catch((e) => {
        console.error('[LocalImage] loadImage error:', e);
      });
  }, [src]);

  if (!resolved) return null;
  return <img src={resolved} alt={alt ?? ''} {...imgProps} />;
}

// ─── 云端同步：图片实化 ────────────────────────────────────────────────────────

export interface SyncImageResult {
  field: 'imageUrl' | 'screenshotLink' | 'screenshots';
  index?: number;
  original: string;
  finalUrl: string;
  success: boolean;
  error?: string;
  /** 内容哈希，若跳过上传说已存在则也返回 */
  hash?: string;
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

/**
 * 用 Web Crypto API 计算 Blob 的 SHA-256 哈希（hex 字符串）。
 */
async function computeBlobHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 将 IndexedDB 中的图片记录上传到 Vercel Blob，颜色编码进 URL query。
 *
 * 去重逻辑：
 * 1. 用内容哈希（SHA-256）查全局映射表 blob-url-map
 * 2. 已存在 → 直接返回已有 URL（含颜色）
 * 3. 不存在 → 上传 → 写入映射表（含颜色）
 *
 * 返回 URL 格式：https://cdn.vercel-storage.com/xxx.png?bg=rgb(r,g,b)
 */
async function uploadBlobFromIndexedDB(
  img: { blob: Blob; mimeType: string; edgeColor?: string },
  prefix: string
): Promise<string> {
  const hash = await computeBlobHash(img.blob);

  // 查全局去重映射，已存在则复用
  const existing = await getBlobUrlByHash(hash);
  if (existing) {
    console.log(`[去重] 已有相同图片，跳过上传: ${hash.slice(0, 8)}...`);
    return existing;
  }

  // 上传
  const ext = extFromMime(img.mimeType);
  const filename = `${prefix}-${hash.slice(0, 12)}.${ext}`;
  const file = new File([img.blob], filename, { type: img.mimeType });
  let blobUrl: string = await uploadToBlob(file);

  // 颜色编码进 URL
  const edgeColor = img.edgeColor ?? '#f1f5f9';
  const bgParam = encodeURIComponent(edgeColor);
  blobUrl = `${blobUrl}?bg=${bgParam}`;

  // 写入映射表（含颜色）
  await setBlobUrlByHash(hash, blobUrl, edgeColor);

  console.log(`[上传] 新图片已上传: ${hash.slice(0, 8)}... → ${blobUrl}`);
  return blobUrl;
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
