export interface Tool {
  id: string;
  name: string;
  description: string; // 卡片上的说明
  category: string;
  imageUrl: string;
  downloadLink: string;
  createdAt: Date;
  updatedAt: Date;
  order?: number;
  // 详情页内容
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
  category: string;
  imageUrl: string;
  downloadLink: string;
}

