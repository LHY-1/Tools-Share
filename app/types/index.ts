export interface Tool {
  id: string;
  name: string;
  description: string;
  categories: string[];
  imageUrl: string;
  downloadLinks: string[];
  downloadLinkLabels?: string[];
  screenshotLink?: string;
  createdAt: Date;
  updatedAt: Date;
  order?: number;
  fullDescription?: string;
  features?: string[];
  screenshots?: string[];
  usage?: string;
  // 关联的本地图片 ID（用于导出/导入）
  imageIds?: string[];
}

export interface StoredTool {
  id: string;
  name: string;
  description: string;
  category?: string;
  categories?: string[];
  imageUrl: string;
  downloadLink?: string;
  downloadLinks?: string[];
  downloadLinkLabels?: string[];
  screenshotLink?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  order?: number;
  fullDescription?: string;
  features?: string[];
  screenshots?: string[];
  usage?: string;
  imageIds?: string[];
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
  screenshots?: string[];
}

/** 将存储层数据转换为组件 state 使用的 Tool 类型 */
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
    imageIds: data.imageIds,
  };
}
