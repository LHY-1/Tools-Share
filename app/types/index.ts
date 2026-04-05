export interface Tool {
  id: string;
  name: string;
  description: string; // 简介
  categories: string[];
  imageUrl: string;
  downloadLinks: string[];
  downloadLinkLabels?: string[]; // 下载链接版本标签
  screenshotLink?: string;
  createdAt: Date;
  updatedAt: Date;
  order?: number;
  // 详情页扩展
  fullDescription?: string; // 完整介绍
  features?: string[]; // 功能列表
  screenshots?: string[]; // 截图链接列表
  usage?: string; // 使用说明
}

export interface StoredTool {
  id: string;
  name: string;
  description: string;
  category?: string; // 旧格式：单个分类
  categories?: string[]; // 新格式：分类数组
  imageUrl: string;
  downloadLink?: string; // 旧格式：单个下载链接
  downloadLinks?: string[]; // 新格式：下载链接数组
  downloadLinkLabels?: string[];
  screenshotLink?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  order?: number;
  fullDescription?: string;
  features?: string[];
  screenshots?: string[];
  usage?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface CreateToolInput {
  name: string;
  description: string;
  categories: string[];
  imageUrl: string;
  downloadLinks: string[];
  downloadLinkLabels?: string[];
  screenshotLink?: string;
}

/**
 * 将存储层数据转换为组件 state 使用的 Tool 类型
 * 保证 createdAt / updatedAt 都是 Date 对象
 */
export function toTool(data: StoredTool): Tool {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    categories: data.categories ?? (data.category ? [data.category] : []),
    imageUrl: data.imageUrl,
    downloadLinks: data.downloadLinks ?? (data.downloadLink ? [data.downloadLink] : []),
    downloadLinkLabels: data.downloadLinkLabels,
    screenshotLink: data.screenshotLink,
    createdAt:
      data.createdAt instanceof Date
        ? data.createdAt
        : new Date(data.createdAt),
    updatedAt:
      data.updatedAt instanceof Date
        ? data.updatedAt
        : new Date(data.updatedAt),
    order: data.order,
    fullDescription: data.fullDescription,
    features: data.features,
    screenshots: data.screenshots,
    usage: data.usage,
  };
}
