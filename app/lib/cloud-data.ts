/**
 * 云端数据访问层（客户端）
 * 
 * 通过 API 路由访问 Redis，不直接使用环境变量
 */

import { Tool, StoredTool } from '../types';

/**
 * 从云端加载工具列表
 */
export async function loadCloudTools(): Promise<Tool[]> {
  try {
    const res = await fetch('/api/cloud/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'tools:cloud:v1' }),
    });

    if (!res.ok) {
      console.error('[cloud-data] Load failed:', res.status);
      return [];
    }

    const data = await res.json();
    const tools: Tool[] = Array.isArray(data.tools) ? data.tools : [];

    // 转换日期字符串
    return tools.map(t => ({
      ...t,
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.updatedAt),
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
  try {
    const res = await fetch('/api/cloud/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'tools:cloud:v1',
        value: JSON.stringify(tools),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      console.error('[cloud-data] Save failed:', data.error);
      return false;
    }

    console.log('[cloud-data] Saved', tools.length, 'tools to cloud');
    return true;
  } catch (err) {
    console.error('[cloud-data] Save error:', err);
    return false;
  }
}

/**
 * 验证云端数据格式
 */
export function validateCloudData(tools: Tool[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const tool of tools) {
    // 图片字段必须是 HTTPS URL
    if (tool.imageUrl && !tool.imageUrl.startsWith('https://')) {
      errors.push(`Tool ${tool.name}: imageUrl must be HTTPS URL`);
    }
    if (tool.screenshotLink && !tool.screenshotLink.startsWith('https://')) {
      errors.push(`Tool ${tool.name}: screenshotLink must be HTTPS URL`);
    }
    for (const s of tool.screenshots || []) {
      if (!s.startsWith('https://')) {
        errors.push(`Tool ${tool.name}: screenshot must be HTTPS URL`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
