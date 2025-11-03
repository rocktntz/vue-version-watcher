
# vue-version-watcher v1.2

自动检测 Web 系统版本更新（基于 **ETag + 静态资源错误 + History API**），支持 Vue 或纯原生项目。

## 🚀 特性
- 无需依赖 Vue Router
- 自动监听 `pushState` / `replaceState` / `popstate`
- 同源静态资源错误检测（防止误报）
- ETag 二次确认（防止网络抖动误报）
- 自动使用 Element Plus 弹窗 / 原生 confirm

## 📦 安装
```bash
npm install vue-version-watcher
# 或
pnpm add vue-version-watcher
```

## 💡 使用
```ts
import { setupVersionWatcher } from 'vue-version-watcher';

setupVersionWatcher();
```

在 `.env` 中启用：
```bash
VITE_VERSION_CHECK=true
```

## 🧠 原理
1. 通过 HEAD 请求检测 ETag 或 Last-Modified 变化；
2. 捕获同源 JS/CSS 静态资源错误；
3. 自动弹窗提示刷新。

## 🪪 License
MIT
