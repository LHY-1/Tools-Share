/**
 * 云端工具数据读取（客户端专用）
 *
 * 策略：云端优先，断网自动降级到 IndexedDB 缓存。
 *
 * - 在线：从 Redis 拉最新数据（图片全是 Blob URL）
 * - 断网：回退到 IndexedDB（可能是旧数据，但至少能看）
 */

import { loadTools } from '@/app/lib/db';
import type { StoredTool } from '@/app/types';

export interface CloudTool extends StoredTool {
  createdAt: string;
  updatedAt: string;
}

/** 从 Redis 云端读取所有工具。返回 null 表示网络错误或未初始化。 */
async function fetchFromCloud(): Promise<CloudTool[] | null> {
  try {
    const res = await fetch('/api/cloud/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'tools-data' }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { tools?: CloudTool[]; error?: string };
    if (data.error || !Array.isArray(data.tools)) return null;
    return data.tools;
  } catch {
    return null;
  }
}

/**
 * 获取工具列表：云端优先，断网降级 IndexedDB。
 *
 * @returns [tools, isOffline] — tools: 工具数组；isOffline: 是否走了降级
 */
export async function fetchCloudTools(): Promise<{ data: CloudTool[]; isOffline: boolean } | null> {
  // 优先云端
  const cloud = await fetchFromCloud();
  if (cloud && cloud.length > 0) {
    return { data: cloud, isOffline: false };
  }

  // 降级：从 IndexedDB 读（上次同步后的缓存）
  try {
    const cached = await loadTools<CloudTool>();
    if (cached.length > 0) {
      console.log('[降级] 云端不可用，回退到 IndexedDB 缓存（', cached.length, ' 个工具）');
      return { data: cached, isOffline: true };
    }
  } catch (e) {
    console.warn('[降级] IndexedDB 读取也失败:', e);
  }

  return null;
}

/** 根据 id 从云端获取单个工具 */
export async function fetchCloudTool(id: string): Promise<CloudTool | null> {
  const result = await fetchCloudTools();
  if (!result) return null;
  return result.data.find((t) => t.id === id) ?? null;
}

/** 云端工具 → 前端 Tool 类型（Date 化 + 字段归一） */
export function normalizeCloudTool(t: CloudTool) {
  return {
    ...t,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt),
    categories: t.categories || (t.category ? [t.category] : []),
    downloadLinks: t.downloadLinks || (t.downloadLink ? [t.downloadLink] : []),
    screenshotLink: t.screenshotLink || '',
    fullDescription: (t as any).fullDescription || '',
    features: (t as any).features || [],
    usage: (t as any).usage || '',
    screenshots: (t as any).screenshots || [],
  };
}
