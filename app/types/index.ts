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
