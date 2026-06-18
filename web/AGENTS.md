# Web 前端 · 编码规范

## 技术栈

- React 19 + TypeScript 6
- Vite 8（构建 + 开发服务器）
- 高德地图 JS API 2.0（`@amap/amap-jsapi-loader`）
- 无 CSS 框架 — 手写 `styles.css`
- 无状态管理库 — 纯 React hooks

## 项目结构

```
web/src/
  App.tsx               # 根组件：状态持有、布局、API 调用
  main.tsx              # ReactDOM 入口
  styles.css            # 全局样式（约 250 行）

  components/
    Globe.tsx           # 高德地图 + 标记 + 区域下钻
    PlaceForm.tsx       # 新增地点表单 + 浏览器定位
    PlaceDrawer.tsx     # 地点详情：查看/编辑、照片、帖子

  lib/
    api.ts              # fetch() 封装 + 所有 API 函数
    types.ts            # TypeScript 类型（Place、Photo、Post、PlaceInput）
```

## 编码约定

### 状态管理
- **App.tsx 持有全部状态**：`places`、`selectedPlaceId`、`panel`、`loading`、`error`。
- **子组件纯 props 下传、事件上传**：子组件不持有跨组件共享状态。
- 每次 API 调用返回最新数据 → `setState` → 通过 props 向下流转。

### 组件模式
- **Globe.tsx**：管理高德地图实例生命周期（init → load → render）。用 `useRef` 持有 `containerRef`、`mapRef`、`AMapRef`。`onMount` 调用 `AMapLoader.load()`。`onUnmount` 调用 `map.destroy()`。
- **PlaceForm.tsx**：本地表单状态（`useState`），通过 `onSubmit` 回调提交。定位功能用 `navigator.geolocation`。
- **PlaceDrawer.tsx**：两种模式（查看/编辑），由 `editing` 状态切换。照片上传用 `<input type="file">`。帖子创建支持可选图片。

### API 客户端
- `lib/api.ts`：通用 `request<T>()` 封装。非 FormData 请求自动带 JSON header。处理 204 No Content。
- `VITE_API_URL` 环境变量指定后端地址，默认 `""`（开发时走 Vite 代理）。
- Vite 开发配置将 `/api` 代理到 `http://127.0.0.1:8080`。

### 样式
- 单文件 `styles.css`，类名扁平化（类似 BEM 但更简洁）。
- 亮色主题：背景 `#f0f4f8`，卡片白色，强调色 `#4a90d9`。
- 响应式：桌面端 `.drawer` 右侧滑入，移动端（<768px）`.sheet` 底部弹出。
- 地图容器用 `position: absolute; inset: 0` 撑满父级。

### 高德地图使用
- 通过 `@amap/amap-jsapi-loader` 动态加载（非 CDN script 标签）。
- 安全配置：加载前设置 `window._AMapSecurityConfig`。
- 凭证来自 `VITE_AMAP_KEY` + `VITE_AMAP_SECRET`。
- 区域下钻用 `AMap.DistrictSearch` 插件。
- 标记点用自定义 HTML `content` + CSS 圆点样式。

## 新增组件流程

1. 创建 `web/src/components/NewComponent.tsx`。
2. 定义 `type Props = { ... }` 接口。
3. 命名导出：`export function NewComponent(...)`。
4. 在 `App.tsx` 中引入，通过 props 传数据和回调。
5. 样式加到 `styles.css`，用 `.new-component` 前缀。
6. **禁止默认导出** — 统一使用命名导出。

## 环境变量

- `web/.env.example` — 模板，可提交 git。
- `web/.env` — 本地配置（gitignored）。
- 变量：`VITE_AMAP_KEY`、`VITE_AMAP_SECRET`、`VITE_API_URL`。

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # Vite 开发服务器 (:5173)
npm run build        # 生产构建 → dist/
npm run preview      # 预览构建产物
```

## TypeScript

- `tsconfig.json` 中 `strict: true`。
- 类型定义在 `lib/types.ts`：`Place`、`Photo`、`Post`、`PlaceInput`。
- 除高德 SDK 对象外禁止使用 `any`。
- `as` 断言仅用于已知安全的类型收窄（如 `as [number, number, number]`）。
