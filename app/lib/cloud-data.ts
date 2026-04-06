/**
 * 云端数据访问层
 * 
 * 负责：从 Redis 读取/写入工具数据
 * 图片字段必须是 HTTPS URL（Vercel Blob）
 */

import { Tool, StoredTool } from '../types';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const CLOUD_KEY = 'tools:cloud:v1';

/**
 * 从云端加载工具列表
 */
export async function loadCloudTools(): Promise<Tool[]> {
  if (!KV_URL || !KV_TOKEN) {
    console.error('[cloud-data] Missing KV_REST_API_URL or KV_REST_API_TOKEN');
    return [];
  }

  try {
    const res = await fetch(`${KV_URL}/get/${CLOUD_KEY}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KV_TOKEN}`,
      },
    });

    if (!res.ok) {
      console.error('[cloud-data] Load failed:', res.status, res.statusText);
      return [];
    }

    const data = await res.json();
    const toolsJson = data.result;
    
    if (!toolsJson) {
      return [];
    }

    const tools = JSON.parse(toolsJson) as StoredTool[];
    
    // 转换为 Tool 类型
    return tools.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      categories: t.categories ?? (t.category ? [t.category] : []),
      imageUrl: t.imageUrl,
      downloadLinks: t.downloadLinks ?? (t.downloadLink ? [t.downloadLink] : []),
      downloadLinkLabels: t.downloadLinkLabels,
      screenshotLink: t.screenshotLink,
      screenshots: t.screenshots,
      screenshotLabels: t.screenshotLabels,
      createdAt: t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt),
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt),
      order: t.order,
      fullDescription: t.fullDescription,
      features: t.features,
      usage: t.usage,
      imageIds: t.imageIds,
    }));
  } catch (err) {
    console.error('[cloud-data] Load error:', err);
    return [];
  }
}

/**
 * 保存工具列表到云端
 */
export async function saveCloudTools(tools: Tool[]): Promise<boolean> {
  if (!KV_URL || !KV_TOKEN) {
    console.error('[cloud-data] Missing KV_REST_API_URL or KV_REST_API_TOKEN');
    return false;
  }

  try {
    // 验证数据：云端不能有本地引用
    const invalidTools = tools.filter(t => 
      t.imageUrl?.startsWith('__local_image:') ||
      t.imageUrl?.startsWith('blob:') ||
      t.imageUrl?.startsWith('data:') ||
      t.screenshotLink?.startsWith('__local_image:') ||
      t.screenshotLink?.startsWith('blob:') ||
      t.screenshotLink?.startsWith('data:') ||
      (t.screenshots || []).some(s => 
        s.startsWith('__local_image:') ||
        s.startsWith('blob:') ||
        s.startsWith('data:')
      )
    );

    if (invalidTools.length > 0) {
      console.error('[cloud-data] Invalid tools with local references:', invalidTools.map(t => t.id));
      return false;
    }

    const storedTools: StoredTool[] = tools.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      categories: t.categories,
      imageUrl: t.imageUrl,
      downloadLinks: t.downloadLinks,
      downloadLinkLabels: t.downloadLinkLabels,
      screenshotLink: t.screenshotLink,
      screenshots: t.screenshots,
      screenshotLabels: t.screenshotLabels,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      order: t.order,
      fullDescription: t.fullDescription,
      features: t.features,
      usage: t.usage,
      imageIds: t.imageIds,
    }));

    const res = await fetch(`${KV_URL}/set/${CLOUD_KEY}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: CLOUD_KEY, value: JSON.stringify(storedTools) }),
    });

    if (!res.ok) {
      console.error('[cloud-data] Save failed:', res.status, res.statusText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[cloud-data] Save error:', err);
    return false;
  }
}

/**
 * 验证云端数据是否有效（无本地引用）
 */
export function validateCloudData(tools: Tool[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const tool of tools) {
    if (tool.imageUrl?.startsWith('__local_image:')) {
      errors.push(`Tool ${tool.id}: imageUrl has __local_image reference`);
    }
    if (tool.imageUrl?.startsWith('blob:')) {
      errors.push(`Tool ${tool.id}: imageUrl has blob: reference`);
    }
    if (tool.imageUrl?.startsWith('data:')) {
      errors.push(`Tool ${tool.id}: imageUrl has data: URL`);
    }
    if (tool.screenshotLink?.startsWith('__local_image:')) {
      errors.push(`Tool ${tool.id}: screenshotLink has __local_image reference`);
    }
    if (tool.screenshotLink?.startsWith('blob:')) {
      errors.push(`Tool ${tool.id}: screenshotLink has blob: reference`);
    }
    if (tool.screenshotLink?.startsWith('data:')) {
      errors.push(`Tool ${tool.id}: screenshotLink has data: URL`);
    }
    for (let i = 0; i < (tool.screenshots || []).length; i++) {
      const s = tool.screenshots![i];
      if (s.startsWith('__local_image:') || s.startsWith('blob:') || s.startsWith('data:')) {
        errors.push(`Tool ${tool.id}: screenshots[${i}] has invalid reference`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
