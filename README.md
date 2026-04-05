# Tool Share - Personal Tool Collection Website

一个美观的个人工具分享网站，可以存储和组织您喜欢的工具、链接、图片和文字片段。

## 功能特性

? **丰富的内容类型**
- 文字内容 - 存储笔记、代码片段等
- 图片分享 - 展示图片、截图等
- 链接收藏 - 保存重要的网址

? **美观的用户界面**
- 现代化的卡片设计
- 响应式布局（移动端友好）
- 渐变色背景和流畅动画

? **强大的搜索和过滤**
- 按类型筛选（文字/图片/链接）
- 全文搜索和标签搜索
- 实时结果更新

? **本地数据存储**
- 所有数据存储在浏览器本地
- 无需服务器，完全隐私
- 自动保存所有更改

?? **标签系统**
- 为每个工具添加标签
- 使用标签快速分类组织
- 支持多个标签

## 快速开始

### 安装依赖

\`\`\`bash
npm install
\`\`\`

### 开发模式

\`\`\`bash
npm run dev
\`\`\`

访问 [http://localhost:3000](http://localhost:3000) 查看网站。

### 生产构建

\`\`\`bash
npm run build
npm start
\`\`\`

## 项目结构

```
tool-share/
├── app/
│   ├── components/
│   │   ├── Icons.tsx          # SVG 图标组件
│   │   ├── ToolCard.tsx       # 工具卡片组件
│   │   └── AddToolModal.tsx   # 添加工具模态框
│   ├── types/
│   │   └── index.ts           # TypeScript 类型定义
│   ├── layout.tsx             # 根布局
│   ├── page.tsx               # 主页面
│   └── globals.css            # 全局样式
├── public/                     # 静态资源
├── package.json               # 项目配置
└── tsconfig.json              # TypeScript 配置
```

## 使用说明

### 添加工具

1. 点击页面右上角的 "+ Add Tool" 按钮
2. 选择工具类型（文字/图片/链接）
3. 填写标题、描述和内容
4. 可选：添加标签
5. 点击 "Add Tool" 保存

### 搜索和筛选

- 使用搜索框按标题或描述搜索
- 使用类型按钮筛选特定类型的工具
- 搜索和筛选可以组合使用

### 管理工具

- **复制** - 点击复制图标将工具内容复制到剪贴板
- **删除** - 点击删除图标移除工具（需要确认）

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: React Hooks
- **Markdown 渲染**: React Markdown + Remark GFM
- **图标**: Lucide React
- **部署**: Vercel (推荐)

## 开发指南

### 本地开发

1. 克隆项目
```bash
git clone <repository-url>
cd tool-share
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 访问 http://localhost:3000

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 配置
- 使用 Tailwind CSS 进行样式设计
- 组件使用函数式组件和 Hooks

### 项目架构

- **组件化设计**: 每个功能模块独立组件
- **类型安全**: 完整的 TypeScript 类型定义
- **响应式设计**: 支持移动端和桌面端
- **本地存储**: 数据持久化到浏览器本地存储

## 部署

### Vercel 部署

1. 连接 GitHub 仓库到 Vercel
2. 自动检测 Next.js 项目
3. 一键部署完成

### 其他平台

项目可以部署到任何支持 Node.js 的平台：
- Netlify
- Railway
- 自托管服务器

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 联系方式

如有问题或建议，请通过以下方式联系：
- 提交 GitHub Issue
- 发送邮件至项目维护者
- **存储**: localStorage

## 浏览器兼容性

- Chrome/Edge (最新版本)
- Firefox (最新版本)
- Safari (最新版本)

## 注意事项

- 所有数据存储在浏览器本地存储中
- 清除浏览器缓存会删除所有数据
- 建议定期备份重要数据
- 支持离线使用

## 许可证

MIT

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
