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
