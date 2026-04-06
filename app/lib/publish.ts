/**
 * 发布到云端服务
 * 
 * 将本地数据发布到云端：
 * 1. 遍历所有图片字段
 * 2. __local_image:* → 读取 IndexedDB → 上传 Blob
 * 3. 外链图片 → 服务端下载 → 上传 Blob
 * 4. data: / blob: → 上传 Blob
 * 5. 生成纯云端 JSON → 写入 Redis
 */

import { Tool, StoredTool } from '../types';
import { loadTools as loadLocalTools, loadImage } from './db';
import { saveCloudTools, validateCloudData } from './cloud-data';

const BLOB_UPLOAD_URL = '/api/upload-image';

interface PublishResult {
  success: boolean;
  publishedCount: number;
  failedTools: { id: string; name: string; error: string }[];
  totalImages: number;
  uploadedImages: number;
}

/**
 * 上传图片到 Vercel Blob
 */
async function uploadImageToBlob(imageData: string, filename: string): Promise<string | null> {
  try {
    // 如果已经是 Blob URL，直接返回
    if (imageData.startsWith('https://') && imageData.includes('blob.vercel-storage.com')) {
      return imageData;
    }

    let blob: Blob;
    let contentType = 'image/png';

    if (imageData.startsWith('data:')) {
      // Base64 data URL
      const [header, base64] = imageData.split(',');
      const match = header.match(/data:(image\/[^;]+)/);
      if (match) contentType = match[1];
      
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: contentType });
    } else if (imageData.startsWith('__local_image:')) {
      // 本地 IndexedDB 引用
      const imageId = imageData.replace('__local_image:', '');
      const stored = await loadImage(imageId);
      if (!stored) {
        console.error(`[publish] Image not found: ${imageId}`);
        return null;
      }
      blob = stored.blob;
    } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      // 外链图片，通过服务端下载
      const res = await fetch('/api/fetch-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageData }),
      });
      
      if (!res.ok) {
        console.error(`[publish] Failed to fetch external image: ${imageData}`);
        return null;
      }
      
      const data = await res.json();
      if (!data.dataUrl) {
        return null;
      }
      
      // 转为 Blob
      const base64 = data.dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: 'image/png' });
    } else if (imageData.startsWith('blob:')) {
      // blob: URL（浏览器内存引用）
      const res = await fetch(imageData);
      blob = await res.blob();
    } else {
      console.error(`[publish] Unknown image format: ${imageData.substring(0, 30)}...`);
      return null;
    }

    // 上传到 Blob
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('filename', filename);

    const uploadRes = await fetch(BLOB_UPLOAD_URL, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error(`[publish] Upload failed:`, err);
      return null;
    }

    const result = await uploadRes.json();
    return result.url;
  } catch (err) {
    console.error(`[publish] Upload error:`, err);
    return null;
  }
}

/**
 * 处理单个工具的所有图片字段
 */
async function processToolImages(tool: Tool): Promise<{ tool: Tool; errors: string[] }> {
  const errors: string[] = [];
  const result = { ...tool };
  let imageIndex = 0;

  // 处理 imageUrl
  if (result.imageUrl && !result.imageUrl.startsWith('https://')) {
    const url = await uploadImageToBlob(result.imageUrl, `tool-${tool.id}-cover-${Date.now()}.png`);
    if (url) {
      result.imageUrl = url;
      imageIndex++;
    } else {
      errors.push(`封面图上传失败`);
    }
  }

  // 处理 screenshotLink
  if (result.screenshotLink && !result.screenshotLink.startsWith('https://')) {
    const url = await uploadImageToBlob(result.screenshotLink, `tool-${tool.id}-snapshot-${Date.now()}.png`);
    if (url) {
      result.screenshotLink = url;
      imageIndex++;
    } else {
      errors.push(`快照上传失败`);
    }
  }

  // 处理 screenshots[]
  if (result.screenshots && result.screenshots.length > 0) {
    const newScreenshots: string[] = [];
    for (let i = 0; i < result.screenshots.length; i++) {
      const s = result.screenshots[i];
      if (s.startsWith('https://')) {
        newScreenshots.push(s);
      } else {
        const url = await uploadImageToBlob(s, `tool-${tool.id}-screenshot-${i}-${Date.now()}.png`);
        if (url) {
          newScreenshots.push(url);
          imageIndex++;
        } else {
          errors.push(`截图[${i}]上传失败`);
        }
      }
    }
    result.screenshots = newScreenshots;
  }

  return { tool: result, errors };
}

/**
 * 发布所有本地工具到云端
 */
export async function publishToCloud(): Promise<PublishResult> {
  console.log('[publish] Starting publish to cloud...');
  
  const localTools = await loadLocalTools<StoredTool>();
  console.log(`[publish] Found ${localTools.length} local tools`);

  const failedTools: { id: string; name: string; error: string }[] = [];
  const cloudReadyTools: Tool[] = [];
  let totalImages = 0;
  let uploadedImages = 0;

  for (const tool of localTools) {
    // 统计图片数量
    if (tool.imageUrl && !tool.imageUrl.startsWith('https://')) totalImages++;
    if (tool.screenshotLink && !tool.screenshotLink.startsWith('https://')) totalImages++;
    for (const s of (tool.screenshots || [])) {
      if (!s.startsWith('https://')) totalImages++;
    }
  }

  for (const tool of localTools) {
    const { tool: processedTool, errors } = await processToolImages(tool as Tool);
    
    if (errors.length > 0) {
      failedTools.push({
        id: tool.id,
        name: tool.name,
        error: errors.join('; '),
      });
      console.error(`[publish] Tool ${tool.name} failed:`, errors);
    } else {
      cloudReadyTools.push(processedTool);
      uploadedImages += 
        (tool.imageUrl && !tool.imageUrl.startsWith('https://') ? 1 : 0) +
        (tool.screenshotLink && !tool.screenshotLink.startsWith('https://') ? 1 : 0) +
        (tool.screenshots || []).filter(s => !s.startsWith('https://')).length;
    }
  }

  if (failedTools.length > 0) {
    console.error(`[publish] ${failedTools.length} tools failed, aborting save`);
    return {
      success: false,
      publishedCount: 0,
      failedTools,
      totalImages,
      uploadedImages,
    };
  }

  // 验证云端数据
  const validation = validateCloudData(cloudReadyTools);
  if (!validation.valid) {
    console.error(`[publish] Validation failed:`, validation.errors);
    return {
      success: false,
      publishedCount: 0,
      failedTools: [{ id: 'validation', name: '数据验证', error: validation.errors.join('; ') }],
      totalImages,
      uploadedImages,
    };
  }

  // 保存到云端
  const saved = await saveCloudTools(cloudReadyTools);
  if (!saved) {
    return {
      success: false,
      publishedCount: 0,
      failedTools: [{ id: 'save', name: '保存失败', error: '无法保存到 Redis' }],
      totalImages,
      uploadedImages,
    };
  }

  console.log(`[publish] Successfully published ${cloudReadyTools.length} tools`);
  
  return {
    success: true,
    publishedCount: cloudReadyTools.length,
    failedTools: [],
    totalImages,
    uploadedImages,
  };
}
