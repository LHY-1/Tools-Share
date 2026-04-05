/**
 * 导出 / 导入工具数据。
 * 完全在浏览器端执行，使用 IndexedDB + JSZip。
 *
 * 设计原则：
 * - 工具字段中，图片用 data: URL 或 __local_image:<id> 引用。
 * - IndexedDB images store 作为图片本体的持久化存储。
 * - 导出时，直接从工具字段提取 data URL，写入 ZIP。
 * - 导入时，从 ZIP 读出图片 blob，写入 IndexedDB images store，
 *   同时把 __local_image:<id> 替换回真实 data URL，再写回 tools store。
 *
 * ZIP 结构：
 *   manifest.json          — 工具数据 + 图片元信息
 *   images/<id>.png        — 本地图片二进制
 */

import JSZip from 'jszip';
import {
  loadTools,
  saveTools,
  clearTools,
  saveImage,
  loadImage,
} from './db';
import { dataUrlToImageId, isLocalImage, resolveImageRefs } from './image-utils';
import type { StoredTool } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportedTool extends StoredTool {}

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

export interface ImportResult {
  success: boolean;
  toolsImported: number;
  imagesImported: number;
  error?: string;
}

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * 导出全部工具和本地图片为 ZIP。
 *
 * 调用链：
 * 1. loadTools()          → 读取 IndexedDB tools store
 * 2. collectLocalImages() → 从工具字段提取所有 data: URL（不依赖 images store）
 * 3. dataUrlToImageId()   → 将 data URL 哈希为稳定 imageId
 * 4. JSZip.zip.file()     → 把图片 blob 打包进 images/<id>.ext
 * 5. JSZip.generateAsync()→ 生成 ZIP blob → 触发下载
 */
export async function exportAllData(): Promise<void> {
  const tools = await loadTools<StoredTool>();
  if (tools.length === 0) throw new Error('没有可导出的数据');

  const zip = new JSZip();
  const imageIdToDataUrl = new Map<string, string>(); // imageId → data URL
  const exportedImages: ExportManifest['images'] = [];

  // 先把所有 __local_image:<id> 引用反解回 data URL，再提取
  const resolvedTools = await Promise.all(
    tools.map((tool) => resolveImageRefs(tool))
  );

  // 从已反解的工具字段中提取所有 data: URL，生成 imageId，去重
  for (const tool of resolvedTools) {
    for (const dataUrl of extractDataUrls(tool)) {
      const id = dataUrlToImageId(dataUrl);
      imageIdToDataUrl.set(id, dataUrl);
    }
  }

  // 第二遍：尝试从 IndexedDB images store 读取 blob；读不到就用 data URL 重建
  for (const [id, dataUrl] of imageIdToDataUrl) {
    let blob: Blob;
    let mimeType: string;

    const stored = await loadImage(id);
    if (stored) {
      blob = stored.blob;
      mimeType = stored.mimeType;
    } else {
      // images store 没有（历史数据直接存了 data URL），
      // 从 data URL 反解出 blob
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) continue;
      mimeType = parsed.mimeType;
      const { base64 } = parsed;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: mimeType });
    }

    const filename = `${id}.${extFromMime(mimeType)}`;
    zip.file(`images/${filename}`, blob);
    exportedImages.push({ id, filename, mimeType });
  }

  // 替换工具字段中的 data: URL → __local_image:<id>（在 resolvedTools 上操作，已有 data URL）
  const exportedTools: ExportedTool[] = resolvedTools.map((tool: StoredTool) => {
    const clone = { ...tool };
    const dataUrls = extractDataUrls(tool);

    for (const dataUrl of dataUrls) {
      const id = dataUrlToImageId(dataUrl);
      const ref = `__local_image:${id}`;
      if (clone.imageUrl === dataUrl) clone.imageUrl = ref;
      if ((clone.screenshotLink ?? '') === dataUrl) clone.screenshotLink = ref;
      if (clone.screenshots) {
        clone.screenshots = clone.screenshots.map((s) => (s === dataUrl ? ref : s));
      }
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

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, `tool-share-export-${Date.now()}.zip`);
}

// ─── Import ─────────────────────────────────────────────────────────────────

/**
 * 导入 ZIP 数据，恢复图片到 IndexedDB，重建 data: URL，写回 tools store。
 *
 * 调用链：
 * 1. JSZip.loadAsync()    → 解析 ZIP
 * 2. manifest.json        → 读取工具数据和图片元信息
 * 3. saveImage()          → 把 ZIP 中的图片 blob 写入 IndexedDB images store
 * 4. blobToDataUrl()      → 把 blob 转回 data: URL
 * 5. __local_image:<id>   → 替换回真实 data: URL
 * 6. clearTools() + saveTools() → 写回 tools store
 */
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
    return {
      success: false,
      toolsImported: 0,
      imagesImported: 0,
      error: `不支持的导出格式版本: ${manifest.version}`,
    };
  }

  // 1. 恢复图片到 IndexedDB images store
  const imageIdToDataUrl = new Map<string, string>();
  let imagesImported = 0;

  await Promise.all(
    manifest.images.map(async ({ id, filename, mimeType }) => {
      const file = zip.file(`images/${filename}`);
      if (!file) return;
      const blob = await file.async('blob');
      // 写入 IndexedDB images store
      await saveImage({ id, blob, mimeType, filename });
      // 同时在内存中记住 id → data URL 的映射（用于后续替换工具字段）
      const dataUrl = await blobToDataUrl(blob);
      imageIdToDataUrl.set(id, dataUrl);
      imagesImported++;
    })
  );

  // 2. 重建工具字段：把 __local_image:<id> 替换回真实 data: URL
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

  // 3. 清空旧数据，写回 tools store
  await clearTools();
  await saveTools(restoredTools);

  // 同步到 localStorage（HomePage 直接读 localStorage）
  try {
    localStorage.setItem('tools', JSON.stringify(restoredTools));
  } catch {
    // localStorage 可能已满（导入大量数据），忽略即可
  }

  return { success: true, toolsImported: restoredTools.length, imagesImported };
}

// ─── Utils ───────────────────────────────────────────────────────────────────

/** 从工具对象中提取所有 data: URL */
function extractDataUrls(tool: StoredTool): string[] {
  const urls: string[] = [];
  if (isLocalImage(tool.imageUrl ?? '')) urls.push(tool.imageUrl!);
  if (isLocalImage(tool.screenshotLink ?? '')) urls.push(tool.screenshotLink!);
  if (tool.screenshots) {
    for (const s of tool.screenshots) {
      if (isLocalImage(s)) urls.push(s);
    }
  }
  return urls;
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

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
