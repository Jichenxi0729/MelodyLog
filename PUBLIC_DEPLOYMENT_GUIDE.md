# MelodyLog 公网部署指南

本指南详细介绍如何将 MelodyLog 应用部署到公网上，让其他人能够访问您的应用。

## 部署选项概述

### 1. 静态网站托管服务（推荐初学者）
- **优势**：配置简单、免费额度充足、自动 HTTPS、全球 CDN
- **推荐服务**：Vercel、Netlify、GitHub Pages、Cloudflare Pages

### 2. 容器化部署
- **优势**：环境一致性、易于扩展和管理
- **推荐服务**：Docker + 云服务（AWS ECS、Azure Container Apps、阿里云容器服务）

### 3. 云服务器部署
- **优势**：完全控制、可自定义性高
- **推荐服务**：AWS EC2、Azure VM、阿里云 ECS、腾讯云 CVM

## 方法一：使用 Vercel 部署（最简单）

### 1. 准备工作

1. 创建 GitHub/GitLab/Bitbucket 仓库并上传代码
2. 注册 Vercel 账号（https://vercel.com）

### 2. 部署步骤

1. 在 Vercel 控制台点击 "New Project"
2. 导入您的 Git 仓库
3. 配置部署选项：
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables: 添加 `GEMINI_API_KEY=your_api_key`
4. 点击 "Deploy"
5. 部署完成后，您将获得一个公开的 URL

### 3. 配置 Vercel.json（可选）

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ],
  "build": {
    "env": {
      "NODE_VERSION": "16.x"
    }
  }
}
```

## 方法二：使用 Netlify 部署

### 1. 准备工作

1. 创建 GitHub/GitLab/Bitbucket 仓库并上传代码
2. 注册 Netlify 账号（https://www.netlify.com）

### 2. 部署步骤

1. 在 Netlify 控制台点击 "Add new site" -> "Import an existing project"
2. 连接您的 Git 仓库
3. 配置部署设置：
   - Build Command: `npm run build`
   - Publish directory: `dist`
4. 点击 "Show advanced" -> "Add variable" 添加环境变量：
   - Key: `GEMINI_API_KEY`
   - Value: 您的 API 密钥
5. 点击 "Deploy site"

### 3. 配置 _redirects 文件（处理 SPA 路由）

在 `public` 目录下创建 `_redirects` 文件：

```
/*  /index.html  200
```

## 方法三：使用 Docker 容器化部署

### 1. 创建 Dockerfile

```dockerfile
FROM node:16-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 生产环境
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=build /app/dist ./dist
COPY server.js ./
COPY .env.local* ./

EXPOSE 3000

CMD ["npm", "start"]
```

### 2. 构建和运行 Docker 容器

```bash
# 构建镜像
docker build -t melodylog .

# 运行容器
docker run -p 3000:3000 --env-file .env.local -d melodylog
```

### 3. 部署到云服务

将 Docker 镜像推送到 Docker Hub 或云服务的容器仓库，然后在云服务上部署容器。

## 方法四：云服务器部署（以 AWS EC2 为例）

### 1. 准备云服务器

1. 创建 EC2 实例（推荐 Ubuntu 20.04 LTS）
2. 配置安全组，开放 80、443 和 3000 端口
3. 使用 SSH 连接到服务器

### 2. 服务器配置

```bash
# 更新系统
ssh ubuntu@your_server_ip
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 和 npm
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 Git
sudo apt install -y git

# 克隆代码
git clone https://your-repo-url.git
tcd melodylog

# 安装依赖
npm install

# 配置环境变量
nano .env.local
# 添加 GEMINI_API_KEY=your_api_key
# 添加 PORT=3000

# 构建应用
npm run build

# 安装 PM2 管理进程
sudo npm install -g pm2

# 启动应用
pm start
# 或者使用 PM2
pm start
```

### 3. 配置 Nginx 反向代理

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建 Nginx 配置
sudo nano /etc/nginx/sites-available/melodylog
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name your_domain.com www.your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置并重启 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/melodylog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 配置 HTTPS（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your_domain.com -d www.your_domain.com

# 配置证书自动续期
sudo certbot renew --dry-run
```

## 方法五：使用 GitHub Pages 部署（纯静态版本）

### 1. 修改 Vite 配置

在 `vite.config.ts` 中添加 `base` 配置：

```typescript
export default defineConfig({
  base: '/melodylog/', // 替换为您的仓库名
  // 其他配置...
})
```

### 2. 构建和部署

```bash
# 构建应用
npm run build

# 安装 gh-pages
npm install -g gh-pages

# 部署到 GitHub Pages
gh-pages -d dist
```

## 环境变量配置

对于公网部署，正确配置环境变量非常重要：

### 1. 本地 `.env.local` 文件

```
# 端口配置
PORT=3000

# API 密钥
GEMINI_API_KEY=your_gemini_api_key_here

# 生产环境标志
NODE_ENV=production
```

### 2. 云服务环境变量

所有云服务平台都提供环境变量配置界面，请确保在部署时正确设置 `GEMINI_API_KEY`。

## 性能优化建议

1. **启用压缩**：配置 gzip 或 brotli 压缩
2. **使用 CDN**：将静态资源托管在 CDN 上
3. **缓存策略**：配置合理的缓存头
4. **延迟加载**：实现代码分割和懒加载
5. **图片优化**：压缩和优化图片资源

## 安全注意事项

1. **API 密钥保护**：
   - 永远不要在客户端代码中暴露 API 密钥
   - 使用环境变量管理所有敏感信息
   - 考虑使用服务器端代理处理 API 请求

2. **CORS 配置**：
   - 在生产环境中正确配置 CORS 策略

3. **HTTPS 强制**：
   - 确保所有流量都通过 HTTPS 加密
   - 配置 HSTS 头

## 常见问题排查

1. **路由问题**：
   - 确保配置了 SPA 回退路由（所有未匹配的路由都返回 index.html）

2. **API 密钥错误**：
   - 检查环境变量是否正确设置
   - 验证 API 密钥是否有效且未过期

3. **构建失败**：
   - 检查 Node.js 版本是否兼容
   - 确认所有依赖都正确安装

4. **静态资源加载失败**：
   - 检查 `base` 配置是否正确
   - 确保资源路径使用相对路径

## 监控和维护

1. **日志监控**：配置日志收集和分析
2. **性能监控**：使用工具监控应用性能
3. **自动更新**：配置 CI/CD 流水线实现自动部署

---

选择最适合您需求的部署方法，按照上述步骤操作，您的 MelodyLog 应用将很快可以在公网上访问！