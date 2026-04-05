/**
 * 云端工具数据读取（客户端专用）
 *
 * 职责：只读 Redis + Blob URL 格式的工具数据。
 * 禁止读取 localStorage / IndexedDB / __local_image:* / data:image/*
 */

import type { StoredTool } from '@/app/types';

export interface CloudTool extends StoredTool {
  createdAt: string;
  updatedAt: string;
}

/** 从 Redis 云端读取所有工具。返回 null 表示网络错误或未初始化。 */
export async function fetchCloudTools(): Promise<CloudTool[] | null> {
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

/** 根据 id 从云端获取单个工具 */
export async function fetchCloudTool(id: string): Promise<CloudTool | null> {
  const tools = await fetchCloudTools();
  if (!tools) return null;
  return tools.find((t) => t.id === id) ?? null;
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
