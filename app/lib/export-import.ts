/**
 * 导出 / 导入工具数据。
 * 完全在浏览器端执行，使用 IndexedDB + JSZip。
 *
 * ZIP 结构：
 *   manifest.json          — 工具数据 + 图片元信息
 *   images/<id>.png        — 本地图片二进制
 */

import JSZip from 'jszip';
import {
  loadTools,
  loadAllImages,
  saveImage,
  saveTools,
  clearTools,
  clearImages,
  type StoredImage,
} from './db';
import type { StoredTool } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportedTool extends StoredTool {
  // screenshots / screenshotLink 中的本地图片用 special ref 标记
  screenshotLink?: string;
  screenshots?: string[];
}

export interface ExportManifest {
  version: 1;
  exportedAt: string;
  tools: ExportedTool[];
  images: Array<{
    id: string;
    filename: string;
    mimeType: string;
  }>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** 判断 URL 是否是本地上传的（data: 或 blob:） */
function isLocalImage(value: string): boolean {
  return value.startsWith('data:') || value.startsWith('blob:');
}

/** 从 data: URL 中提取 mimeType 和 base64 数据 */
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

/** 提取所有被工具引用的本地图片 URL */
function collectLocalImageUrls(tools: StoredTool[]): Set<string> {
  const urls = new Set<string>();
  for (const tool of tools) {
    if (isLocalImage(tool.imageUrl)) urls.add(tool.imageUrl);
    if (isLocalImage(tool.screenshotLink ?? '')) urls.add(tool.screenshotLink!);
    if (tool.screenshots) {
      for (const s of tool.screenshots) {
        if (isLocalImage(s)) urls.add(s);
      }
    }
  }
  return urls;
}

/** data: URL → imageId */
function dataUrlToId(dataUrl: string): string {
  // 用简单哈希作为稳定 ID
  let hash = 0;
  for (let i = 0; i < dataUrl.length; i++) {
    hash = (hash * 31 + dataUrl.charCodeAt(i)) >>> 0;
  }
  return `local_${hash.toString(16).padStart(8, '0')}`;
}

// ─── Export ─────────────────────────────────────────────────────────────────

/** 导出全部工具和本地图片为 ZIP */
export async function exportAllData(): Promise<void> {
  const [tools, images] = await Promise.all([loadTools<StoredTool>(), loadAllImages()]);

  if (tools.length === 0) throw new Error('没有可导出的数据');

  const zip = new JSZip();
  const imageIdMap = new Map<string, string>(); // dataUrl → imageId
  const exportedImages: ExportManifest['images'] = [];

  // 处理每一张图片
  for (const img of images) {
    // 重新构建 data: URL（IndexedDB 存的是 blob）
    const dataUrl = await blobToDataUrl(img.blob);
    imageIdMap.set(dataUrl, img.id);
    imageIdMap.set(img.id, img.id); // 也支持直接用 ID 引用

    const filename = `${img.id}.${extFromMime(img.mimeType)}`;
    zip.file(`images/${filename}`, img.blob);
    exportedImages.push({ id: img.id, filename, mimeType: img.mimeType });
  }

  // 替换工具中的 data: URL 为 imageId（方便导入时重建关联）
  const exportedTools: ExportedTool[] = tools.map((tool) => {
    const clone = { ...tool };
    if (isLocalImage(clone.imageUrl)) {
      const id = imageIdMap.get(clone.imageUrl) ?? dataUrlToId(clone.imageUrl);
      clone.imageUrl = `__local_image:${id}`;
    }
    if (isLocalImage(clone.screenshotLink ?? '')) {
      const id = imageIdMap.get(clone.screenshotLink!) ?? dataUrlToId(clone.screenshotLink!);
      clone.screenshotLink = `__local_image:${id}`;
    }
    if (clone.screenshots) {
      clone.screenshots = clone.screenshots.map((s) => {
        if (isLocalImage(s)) {
          const id = imageIdMap.get(s) ?? dataUrlToId(s);
          return `__local_image:${id}`;
        }
        return s;
      });
    }
    return clone as ExportedTool;
  });

  const manifest: ExportManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tools: exportedTools,
    images: exportedImages,
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `tool-share-export-${Date.now()}.zip`);
}

// ─── Import ─────────────────────────────────────────────────────────────────

export interface ImportResult {
  success: boolean;
  toolsImported: number;
  imagesImported: number;
  error?: string;
}

/** 导入 ZIP 数据，返回结果 */
export async function importData(zipBlob: Blob): Promise<ImportResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBlob);
  } catch {
    return { success: false, toolsImported: 0, imagesImported: 0, error: '无法解压 ZIP 文件' };
  }

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    return { success: false, toolsImported: 0, imagesImported: 0, error: 'ZIP 中没有 manifest.json' };
  }

  let manifest: ExportManifest;
  try {
    manifest = JSON.parse(await manifestFile.async('string'));
  } catch {
    return { success: false, toolsImported: 0, imagesImported: 0, error: 'manifest.json 解析失败' };
  }

  if (manifest.version !== 1) {
    return { success: false, toolsImported: 0, imagesImported: 0, error: `不支持的导出格式版本: ${manifest.version}` };
  }

  // 1. 恢复图片
  const imageIdToDataUrl = new Map<string, string>();
  let imagesImported = 0;

  await Promise.all(
    manifest.images.map(async ({ id, filename, mimeType }) => {
      const file = zip.file(`images/${filename}`);
      if (!file) return;
      const blob = await file.async('blob');
      await saveImage({ id, blob, mimeType, filename });
      const dataUrl = await blobToDataUrl(blob);
      imageIdToDataUrl.set(id, dataUrl);
      imagesImported++;
    })
  );

  // 2. 恢复工具（把 __local_image:xxx 替换回真实 data: URL）
  const restoredTools: StoredTool[] = manifest.tools.map((tool) => {
    const clone = { ...tool };
    if (typeof clone.imageUrl === 'string' && clone.imageUrl.startsWith('__local_image:')) {
      const id = clone.imageUrl.replace('__local_image:', '');
      clone.imageUrl = imageIdToDataUrl.get(id) ?? clone.imageUrl;
    }
    if (typeof clone.screenshotLink === 'string' && clone.screenshotLink.startsWith('__local_image:')) {
      const id = clone.screenshotLink.replace('__local_image:', '');
      clone.screenshotLink = imageIdToDataUrl.get(id) ?? clone.screenshotLink;
    }
    if (clone.screenshots) {
      clone.screenshots = clone.screenshots.map((s) => {
        if (s.startsWith('__local_image:')) {
          const id = s.replace('__local_image:', '');
          return imageIdToDataUrl.get(id) ?? s;
        }
        return s;
      });
    }
    return clone;
  });

  await clearTools();
  await saveTools(restoredTools);

  return { success: true, toolsImported: restoredTools.length, imagesImported };
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
