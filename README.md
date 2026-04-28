<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# MelodyLog - 智能音乐收藏管理器

[![React](https://img.shields.io/badge/React-19.2.0-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-purple)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/PWA-Supported-green)](https://web.dev/progressive-web-apps/)

一个现代化的个人音乐收藏管理应用，支持智能匹配歌曲信息、批量导入、云端同步和可视化浏览。

</div>

## ✨ 特性

### 🎵 核心功能
- **智能匹配** - 自动获取歌曲封面、专辑信息和发行日期（支持国内/国际音乐库）
- **批量导入** - 支持文本和 CSV 格式批量导入歌曲
- **多视图浏览** - 按歌曲、艺术家、专辑等多种方式浏览收藏
- **云端同步** - 基于 Supabase 实现用户数据云端存储和多设备同步
- **用户认证** - 安全的用户登录/注册系统，保护个人音乐数据

### 🔧 技术特色
- **PWA 支持** - 支持离线访问、添加到主屏幕、推送通知
- **智能缓存** - 多级缓存策略，提升加载速度和离线体验
- **响应式设计** - 完美适配桌面和移动设备
- **TypeScript 支持** - 完整的类型安全保障
- **热重载开发** - 快速迭代的开发体验

### 📱 用户体验
- **直观界面** - 简洁美观的卡片式布局
- **快速搜索** - 实时搜索歌曲、艺术家和专辑
- **一键导出** - 支持将收藏导出为 CSV 文件
- **歌词编辑** - 支持查看和编辑歌曲歌词
- **进度反馈** - 导入和匹配过程中的实时进度显示
- **标签管理** - 支持自定义标签分类管理

## 🚀 快速开始

### 环境要求
- Node.js 18+
- 网络连接（用于智能匹配功能）
- Supabase 账号（可选，用于云端同步）

### 安装与运行

1. **克隆仓库**
```bash
git clone https://github.com/Jichenxi0729/MelodyLog.git
cd MelodyLog
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量（可选）**

创建 `.env.local` 文件并配置：
```bash
# Supabase 配置（用于云端同步）
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini API（用于 AI 功能）
GEMINI_API_KEY=your_gemini_api_key
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **打开浏览器**
访问 http://localhost:5173 开始使用

## 📖 使用指南

### 添加歌曲
1. 点击"+"添加歌曲按钮
2. 输入歌曲名和艺术家
3. 系统自动匹配歌曲信息（封面、专辑、发行日期等）
4. 可手动补充歌词、标签、评分等信息
5. 确认并保存到收藏

### 批量导入
1. 点击"导入"按钮
2. 选择导入方式：
   - **文本导入**：每行一首歌（格式：歌曲名 - 艺术家）
   - **CSV 导入**：支持标准 CSV 格式
3. 启用智能匹配获取详细信息
4. 系统自动处理并导入所有歌曲，实时显示进度

### 浏览收藏
- **首页** - 按时间顺序查看所有歌曲，支持搜索和筛选
- **艺术家库** - 按艺术家分类浏览，查看艺术家详情和专辑
- **专辑视图** - 查看专辑详情和曲目列表
- **歌曲详情** - 查看单首歌曲详细信息，编辑歌词和标签

### 用户功能
- **登录/注册** - 创建账号保存个人音乐收藏
- **云端同步** - 登录后自动同步数据到云端
- **个人中心** - 在"我的"页面管理账号和查看统计

## 🛠️ 技术栈

### 前端框架
- **React** 19.2.0 - UI 框架
- **TypeScript** 5.8.2 - 类型安全
- **Vite** 6.2.0 - 构建工具
- **React Router** 7.9.6 - 路由管理

### UI 与样式
- **Tailwind CSS** - 原子化 CSS 框架
- **Lucide React** 0.554.0 - 图标库
- **html2canvas** 1.4.1 - 截图功能

### 后端与服务
- **Supabase** 2.87.1 - 后端即服务（数据库、认证）
- **@suen/music-api** 1.1.16 - 音乐元数据 API
- **lrclib-api** 2.0.4 - 歌词服务

### PWA 与优化
- **vite-plugin-pwa** 1.2.0 - PWA 支持
- **自定义缓存策略** - 多级缓存优化

## 📁 项目结构

```
MelodyLog/
├── components/          # React 组件
│   ├── SongCard.tsx    # 歌曲卡片组件
│   ├── SongDetail.tsx  # 歌曲详情组件
│   ├── ArtistLibrary.tsx   # 艺术家库组件
│   ├── ArtistDetail.tsx    # 艺术家详情组件
│   ├── AlbumLibrary.tsx    # 专辑库组件
│   ├── AlbumDetail.tsx     # 专辑详情组件
│   ├── AddSongModal.tsx    # 添加歌曲弹窗
│   ├── ImportModal.tsx     # 导入弹窗
│   ├── LyricsEditor.tsx    # 歌词编辑器
│   ├── AuthModal.tsx       # 认证弹窗
│   └── MyPage.tsx          # 个人中心
├── services/           # 服务层
│   ├── supabaseService.ts   # Supabase 数据服务
│   ├── authService.ts       # 用户认证服务
│   ├── musicApiAdapter.ts   # 音乐 API 适配器
│   └── lyricsService.ts     # 歌词服务
├── utils/              # 工具函数
│   ├── cacheUtils.ts   # 缓存工具
│   ├── csvExporter.ts  # CSV 导出工具
│   └── tagUtils.ts     # 标签管理工具
├── types.ts            # TypeScript 类型定义
├── App.tsx             # 主应用组件
├── vite.config.ts      # Vite 配置文件
└── index.html          # HTML 入口
```

## 🔄 智能匹配功能

### 工作原理
1. **优先国内搜索** - 先尝试国内音乐库精确匹配
2. **国际版备用** - 国内无匹配时使用国际版数据
3. **频率控制** - 300ms 延迟避免 API 限流
4. **错误处理** - 完善的错误处理和降级方案

### 配置选项
- **智能匹配开关** - 可手动控制是否启用智能匹配
- **导入进度显示** - 实时显示导入和匹配进度
- **错误提示** - 详细的错误信息和重试机制

## 🗄️ 数据库设置

如需使用云端同步功能，需要在 Supabase 中创建数据库表：

1. 创建 songs 表：
```bash
# 在 Supabase SQL 编辑器中运行
cat supabase_create_table.sql
```

2. 配置行级安全策略（RLS）：
```bash
cat supabase_rls_setup.sql
```

3. 可选：创建歌词表和标签字段
```bash
cat supabase_create_lyrics_table.sql
cat supabase_add_tags_field.sql
```

## 🌐 部署

### 本地生产构建
```bash
npm run build
npm run preview
```

### 云平台部署

#### Netlify
1. 连接 GitHub 仓库
2. 配置构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
3. 添加环境变量（Supabase URL、API Keys 等）

参考文档：[NETLIFY_REDEPLOY_GUIDE.md](./NETLIFY_REDEPLOY_GUIDE.md)

#### Vercel
已配置 `vercel.json`，一键部署：
```bash
npm i -g vercel
vercel
```

#### 其他平台
支持任何支持静态站点托管的平台。

参考文档：[PUBLIC_DEPLOYMENT_GUIDE.md](./PUBLIC_DEPLOYMENT_GUIDE.md)、[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🔒 安全性

- **行级安全（RLS）** - Supabase 数据库级别的数据隔离
- **用户认证** - 安全的登录/注册流程
- **环境变量** - 敏感信息通过环境变量管理
- **CORS 配置** - 跨域请求安全控制

参考文档：[SECURITY.md](./SECURITY.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 联系

- 项目主页：https://github.com/Jichenxi0729/MelodyLog
- 问题反馈：请使用 GitHub Issues

---

<div align="center">

**让音乐收藏更智能，让生活更有旋律** 🎶

</div>
