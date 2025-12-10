# MelodyLog 应用部署指南

本指南详细介绍如何使用 Node.js 部署 MelodyLog 应用。

## 项目概述

MelodyLog 是一个基于 React + TypeScript + Vite 开发的音乐库应用，主要功能包括：
- 添加和管理音乐
- 按歌手和专辑浏览
- 搜索音乐
- 导入批量音乐

## 部署准备

### 1. 环境要求

- Node.js 16.x 或更高版本
- npm 或 yarn 包管理器

### 2. 安装依赖

首先安装所有项目依赖，包括新增的部署相关依赖：

```bash
# 安装项目依赖
npm install

# 或者使用专门的部署依赖安装脚本
npm run deploy:setup
```

### 3. 环境变量配置

确保 `.env.local` 文件中包含必要的环境变量：

```
# .env.local 文件示例
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

> 注意：`.env.local` 文件包含敏感信息（如 API 密钥），不应提交到版本控制系统（它已被 `.gitignore` 排除）。在部署到 Netlify 或其他云平台时，需要手动配置这些环境变量。

## 构建与部署

### 1. 构建生产版本

运行构建命令生成优化后的静态文件：

```bash
npm run build
```

构建完成后，静态文件将位于 `dist` 目录中。

### 2. 启动 Node.js 服务器

使用 Express 服务器托管构建后的静态文件：

```bash
npm start
```

服务器将在配置的端口（默认为 3000）启动，您可以通过 http://localhost:3000 访问应用。

## 部署到生产环境

### 方法一：直接部署（简单场景）

1. 将项目文件上传到服务器
2. 安装依赖：`npm install`
3. 构建应用：`npm run build`
4. 启动服务器：`npm start`

### 方法二：使用 PM2 进行生产部署

PM2 可以确保应用在后台持续运行，并在崩溃时自动重启。

1. 全局安装 PM2：
   ```bash
   npm install -g pm2
   ```

2. 使用 PM2 启动应用：
   ```bash
   pm2 start server.js --name melodylog
   ```

3. 配置 PM2 开机自启：
   ```bash
   pm2 startup
   pm2 save
   ```

### 方法三：使用 Netlify 部署

1. **在 Netlify 上配置环境变量**：
   - 登录 Netlify 控制台，选择你的站点
   - 进入 "Site settings" -> "Environment variables"
   - 点击 "Add a variable" 添加以下环境变量：
     - `VITE_SUPABASE_URL`: 你的 Supabase 项目 URL
     - `VITE_SUPABASE_ANON_KEY`: 你的 Supabase 匿名密钥
     - `GEMINI_API_KEY`: 你的 Gemini API 密钥（如果使用）
   - 确保变量名称与 `.env.local` 中的完全一致（包括 `VITE_` 前缀）

2. **部署站点**：
   - 将代码推送到 GitHub 仓库
   - 在 Netlify 中连接你的 GitHub 仓库
   - 配置构建命令：`npm run build`
   - 配置发布目录：`dist`
   - 点击 "Deploy site"

### 方法四：使用 Docker 容器化部署

创建 Dockerfile：

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

构建并运行 Docker 容器：

```bash
docker build -t melodylog .
docker run -p 3000:3000 --env-file .env.local melodylog
```

## 注意事项

1. **静态文件缓存**：生产环境中，考虑配置适当的缓存策略。
2. **安全考虑**：确保敏感信息（如 API 密钥）不会被暴露。
3. **性能优化**：可以考虑使用 CDN 加速静态资源加载。
4. **日志管理**：生产环境中，配置适当的日志记录和监控。

## 常见问题

### 端口被占用

如果端口 3000 已被占用，可以在 `.env.local` 文件中修改 `PORT` 环境变量。

### API 密钥问题

确保 `GEMINI_API_KEY` 环境变量已正确设置，这对于获取音乐元数据是必要的。

### Supabase URL 或密钥缺失

**错误信息**：`Uncaught Error: supabaseUrl is required`

**解决方案**：
1. 检查本地开发环境中 `.env.local` 文件是否包含以下环境变量：
   ```
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```
2. 在 Netlify 或其他云平台部署时，确保在控制台中正确配置了这些环境变量（包括 `VITE_` 前缀）
3. 重新构建和部署项目

### 静态资源加载失败

检查 Express 服务器配置是否正确指向 `dist` 目录中的静态文件。