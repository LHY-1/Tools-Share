/**
 * 从云端下载到本地服务
 * 
 * 1. 从 Redis 拉工具数据
 * 2. 下载所有 Blob URL 图片
 * 3. 写入 IndexedDB images store
 * 4. 把图片字段替换为 __local_image:*
 * 5. 写入本地 tools store
 */

import { Tool, StoredTool } from '../types';
import { saveTools, saveImage, StoredImage } from './db';
import { loadCloudTools } from './cloud-data';

interface DownloadResult {
  success: boolean;
  downloadedCount: number;
  totalImages: number;
  failedImages: string[];
}

/**
 * 下载图片并存储到 IndexedDB
 */
async function downloadImageToLocal(url: string, imageId: string): Promise<string | null> {
  try {
    console.log(`[download] Downloading: ${url}`);
    
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[download] Failed to fetch: ${url}`);
      return null;
    }
    
    const blob = await res.blob();
    const mimeType = blob.type || 'image/png';
    
    // 存入 IndexedDB images store
    await saveImage({
      id: imageId,
      blob,
      mimeType,
      filename: `image-${imageId}.${mimeType.split('/')[1] || 'png'}`,
    });
    
    return `__local_image:${imageId}`;
  } catch (err) {
    console.error(`[download] Error:`, err);
    return null;
  }
}

/**
 * 从云端下载到本地
 */
export async function downloadFromCloud(): Promise<DownloadResult> {
  console.log('[download] Starting download from cloud...');
  
  const cloudTools = await loadCloudTools();
  console.log(`[download] Found ${cloudTools.length} cloud tools`);

  const localTools: Tool[] = [];
  const failedImages: string[] = [];
  let totalImages = 0;
  let successImages = 0;

  for (const tool of cloudTools) {
    const localTool = { ...tool };
    
    // 处理 imageUrl
    if (localTool.imageUrl && localTool.imageUrl.startsWith('https://')) {
      totalImages++;
      const imageId = `${tool.id}-cover-${Date.now()}`;
      const localRef = await downloadImageToLocal(localTool.imageUrl, imageId);
      if (localRef) {
        localTool.imageUrl = localRef;
        successImages++;
      } else {
        failedImages.push(`${tool.name} 封面图`);
      }
    }

    // 处理 screenshotLink
    if (localTool.screenshotLink && localTool.screenshotLink.startsWith('https://')) {
      totalImages++;
      const imageId = `${tool.id}-snapshot-${Date.now()}`;
      const localRef = await downloadImageToLocal(localTool.screenshotLink, imageId);
      if (localRef) {
        localTool.screenshotLink = localRef;
        successImages++;
      } else {
        failedImages.push(`${tool.name} 快照`);
      }
    }

    // 处理 screenshots[]
    if (localTool.screenshots && localTool.screenshots.length > 0) {
      const newScreenshots: string[] = [];
      for (let i = 0; i < localTool.screenshots.length; i++) {
        const s = localTool.screenshots[i];
        if (s.startsWith('https://')) {
          totalImages++;
          const imageId = `${tool.id}-screenshot-${i}-${Date.now()}`;
          const localRef = await downloadImageToLocal(s, imageId);
          if (localRef) {
            newScreenshots.push(localRef);
            successImages++;
          } else {
            failedImages.push(`${tool.name} 截图[${i}]`);
          }
        } else {
          newScreenshots.push(s);
        }
      }
      localTool.screenshots = newScreenshots;
    }

    localTools.push(localTool);
  }

  // 保存到本地 IndexedDB
  await saveTools(localTools as unknown as StoredTool[]);

  console.log(`[download] Downloaded ${localTools.length} tools, ${successImages}/${totalImages} images`);

  return {
    success: failedImages.length === 0,
    downloadedCount: localTools.length,
    totalImages,
    failedImages,
  };
}
