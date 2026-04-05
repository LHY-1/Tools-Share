# Vercel 部署配置指南

## 方式一：使用 Vercel GitHub 集成（推荐）

1. 打开 https://vercel.com/dashboard
2. 选择项目 → Settings → Git
3. 点击 "Connect Git Repository" 选择你的仓库
4. 部署会自动触发

## 方式二：GitHub Actions + Vercel Secrets

### 获取 Vercel Secrets

1. **VERCEL_TOKEN**
   - https://vercel.com/account/tokens
   - Create Token，复制

2. **VERCEL_ORG_ID 和 VERCEL_PROJECT_ID**
   ```bash
   npm i -g vercel
   vercel link
   vercel env pull .env.local
   ```
   或者在 vercel.json 查看

### 添加到 GitHub

1. 打开 https://github.com/LHY-1/Tools-Share/settings/secrets/actions
2. 点击 "New repository secret"
3. 添加：
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

### 当前工作流

`.github/workflows/deploy.yml` 会在推送到 master 时自动：
1. 安装依赖
2. 构建检查
3. 部署到 Vercel

## 注意

- 确保 Playwright 依赖已安装：`npm install playwright`
- 构建可能需要安装浏览器：`npx playwright install chromium`
