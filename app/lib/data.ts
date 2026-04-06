/**
 * 统一数据访问层
 * 
 * 根据当前模式自动选择数据源：
 * - local 模式：IndexedDB
 * - cloud 模式：Redis
 */

import { Tool, StoredTool } from '../types';
import { getDataMode, DataMode } from './mode';
import { loadTools as loadLocalTools, saveTools as saveLocalTools } from './db';
import { loadCloudTools, saveCloudTools } from './cloud-data';

/**
 * 根据模式加载工具列表
 */
export async function loadToolsByMode(): Promise<Tool[]> {
  const mode = getDataMode();
  
  if (mode === 'local') {
    console.log('[data] Loading from local IndexedDB');
    return loadLocalTools();
  } else {
    console.log('[data] Loading from cloud Redis');
    return loadCloudTools();
  }
}

/**
 * 根据模式保存工具列表
 */
export async function saveToolsByMode(tools: Tool[]): Promise<boolean> {
  const mode = getDataMode();
  
  if (mode === 'local') {
    console.log('[data] Saving to local IndexedDB');
    await saveLocalTools(tools as unknown as StoredTool[]);
    return true;
  } else {
    console.log('[data] Saving to cloud Redis');
    return saveCloudTools(tools);
  }
}

/**
 * 获取单个工具
 */
export async function getToolById(id: string): Promise<Tool | null> {
  const tools = await loadToolsByMode();
  return tools.find(t => t.id === id) || null;
}

/**
 * 添加或更新工具
 */
export async function upsertTool(tool: Tool): Promise<boolean> {
  const tools = await loadToolsByMode();
  const existingIndex = tools.findIndex(t => t.id === tool.id);
  
  if (existingIndex >= 0) {
    tools[existingIndex] = { ...tool, updatedAt: new Date() };
  } else {
    tools.push({ ...tool, createdAt: new Date(), updatedAt: new Date() });
  }
  
  return saveToolsByMode(tools);
}

/**
 * 删除工具
 */
export async function deleteTool(id: string): Promise<boolean> {
  const tools = await loadToolsByMode();
  const filtered = tools.filter(t => t.id !== id);
  return saveToolsByMode(filtered);
}
