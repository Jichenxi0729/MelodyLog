<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# MelodyLog - 智能音乐收藏管理器

[![React](https://img.shields.io/badge/React-19.2.0-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-purple)](https://vitejs.dev/)

一个现代化的个人音乐收藏管理应用，支持智能匹配歌曲信息、批量导入和可视化浏览。

</div>

## ✨ 特性

### 🎵 智能音乐管理
- **智能匹配** - 自动获取歌曲封面、专辑信息和发行日期
- **批量导入** - 支持文本和CSV格式批量导入歌曲
- **多视图浏览** - 按歌曲、艺术家、专辑等多种方式浏览收藏
- **本地存储** - 所有数据安全保存在浏览器本地存储中

### 🔧 技术特色
- **智能API调用控制** - 可调节的API调用频率，避免限流
- **响应式设计** - 完美适配桌面和移动设备
- **TypeScript支持** - 完整的类型安全保障
- **热重载开发** - 快速迭代的开发体验

### 📱 用户体验
- **直观界面** - 简洁美观的卡片式布局
- **快速搜索** - 实时搜索歌曲、艺术家和专辑
- **一键导出** - 支持将收藏导出为CSV文件
- **进度反馈** - 导入和匹配过程中的实时进度显示

## 🚀 快速开始

### 环境要求
- Node.js 18+
- 网络连接（用于智能匹配功能）

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

3. **启动开发服务器**
```bash
npm run dev
```

4. **打开浏览器**
访问 http://localhost:5173 开始使用

## 📖 使用指南

### 添加歌曲
1. 点击"添加歌曲"按钮
2. 输入歌曲名和艺术家
3. 系统自动匹配歌曲信息
4. 确认并保存到收藏

### 批量导入
1. 点击"导入"按钮
2. 选择导入方式：文本或CSV
3. 启用智能匹配获取详细信息
4. 系统自动处理并导入所有歌曲

### 浏览收藏
- **首页** - 按时间顺序查看所有歌曲
- **艺术家库** - 按艺术家分类浏览
- **专辑视图** - 查看专辑详情
- **歌曲详情** - 查看单首歌曲详细信息

## 🛠️ 技术栈

- **前端框架**: React 19.2.0
- **构建工具**: Vite 6.2.0
- **语言**: TypeScript 5.8.2
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **音乐API**: @suen/music-api

## 📁 项目结构

```
MelodyLog/
├── components/          # React组件
│   ├── SongCard.tsx    # 歌曲卡片组件
│   ├── ImportModal.tsx # 导入弹窗组件
│   └── ...
├── services/           # 服务层
│   └── musicApiAdapter.ts # 音乐API适配器
├── types.ts            # TypeScript类型定义
├── utils/              # 工具函数
│   └── csvExporter.ts  # CSV导出工具
└── App.tsx            # 主应用组件
```

## 🔄 智能匹配功能

### 工作原理
1. **优先国内搜索** - 先尝试国内音乐库精确匹配
2. **国际版备用** - 国内无匹配时使用国际版数据
3. **频率控制** - 300ms延迟避免API限流
4. **错误处理** - 完善的错误处理和降级方案

### 配置选项
- **智能匹配开关** - 可手动控制是否启用智能匹配
- **导入进度显示** - 实时显示导入和匹配进度
- **错误提示** - 详细的错误信息和重试机制

## 🌐 部署

### 本地部署
```bash
npm run build
npm run preview
```

### 云部署
支持部署到 Netlify、Vercel 等平台：
- 配置构建命令：`npm run build`
- 输出目录：`dist`

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
