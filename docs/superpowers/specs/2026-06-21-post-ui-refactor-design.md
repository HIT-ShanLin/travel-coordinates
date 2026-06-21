# 前端全面重构设计方案：统一发帖UI与交互逻辑

## 概述

基于 Obsidian 设计文档 `04-用户发帖UI与交互逻辑`，对前端进行全面重构。核心目标：**一次完成发帖**（图片+时间+位置+内容统一提交），移动端定位可用，图片上传完整流畅。

## 架构概览

### 组件树（重构后）

```
App.tsx
├── AuthGuard
│   └── LoginPage                    (不变)
├── Globe.tsx                        (增强：地图点击选点、Pin图优化)
│
├── UnifiedPostEditor.tsx  [新]      替代 PlaceForm，统一发帖
│   ├── PhotoGrid.tsx     [新]      多图网格：排序、裁剪、封面标记、EXIF读取
│   ├── LocationPicker.tsx [新]     位置选择：搜索 + 地图微调 + 定位
│   └── PostContent.tsx   [新]      文字内容 + 时间 + 可见性
│
├── PlaceDrawer.tsx                  (重构：合并照片/帖子为旅行记忆卡片)
│   ├── MemoryCard.tsx    [新]      单条记忆卡片：图片轮播 + 文字 + 时间 + 位置
│   └── PlaceEditor.tsx   [新]      编辑地点基本信息
│
└── SearchBar.tsx                    (增强：支持城市搜索)
```

### 删除的文件

- `web/src/components/PlaceForm.tsx` → 被 UnifiedPostEditor 替代

### 新增的文件

| 文件 | 职责 |
|------|------|
| `web/src/components/UnifiedPostEditor.tsx` | 统一发帖弹窗，管理提交状态机 |
| `web/src/components/PhotoGrid.tsx` | 多图选择、EXIF解析、排序、裁剪、压缩 |
| `web/src/components/LocationPicker.tsx` | 搜索补全 + 地图微调 + 定位按钮 |
| `web/src/components/PostContent.tsx` | 文字内容、日期、标签、可见性 |
| `web/src/components/MemoryCard.tsx` | 旅行记忆卡片组件 |
| `web/src/components/PlaceEditor.tsx` | 地点基本信息编辑表单 |

### 后端新增

| 接口 | 说明 |
|------|------|
| `GET /api/geo/suggest?q=<keyword>` | 地点搜索补全，DB缓存 |
| `GET /api/geo/reverse?lat=...&lng=...` | 反向地理编码，DB缓存 |

---

## 一、UnifiedPostEditor — 统一发帖

### 1.1 PC 端布局：双栏弹窗

- 背景：地图模糊遮罩 (backdrop-filter: blur)
- 模态弹窗 16:9，左栏照片上传，右栏信息填写
- 底部：取消 + 发布按钮

### 1.2 移动端布局：全屏流式

- 顶部操作栏：[←返回] [发布]
- 照片横向滑动墙
- 文字内容区优先（大 textarea）
- LocationPicker、日期、可见性为可点击行

### 1.3 提交状态机

```
用户点[发布]
  → 必填校验（至少1张图 或 有文字内容）
  → 显示进度: "正在创建地点..."
  → POST /api/places → 拿到 place.id
  → 显示进度: "正在上传照片 (1/3)..."
  → 逐个 POST /api/places/{id}/photos (带进度条)
  → 显示进度: "正在发布..."
  → POST /api/places/{id}/posts
  → 成功 → 关闭弹窗 → 地图飞到新Pin → 刷新列表
  → 失败 → Toast提示 + 保留草稿（不清空表单）+ 回滚已创建的地点
```

### 1.4 模式

| 模式 | 说明 |
|------|------|
| `create` | 新建地点+帖子，位置从零填写 |
| `append` | 往已有地点追加记忆，位置默认填入当前地点信息 |

---

## 二、PhotoGrid — 多图上传与管理

### 2.1 状态流转

```
选择文件 → EXIF解析（浏览器端）
         ├─ 有GPS → 自动填位置
         └─ 有拍摄时间 → 自动填日期
       → 加入图片列表（网格预览，最多9张）
       → 用户操作：拖拽排序 / 标封面 / 裁剪 / 删除
       → 发布时统一上传（逐个 POST，进度条 n/m）
```

### 2.2 EXIF 解析

- 使用 `exif-js` 在浏览器端读取
- 读取字段：`GPSLatitude`、`GPSLongitude`、`DateTimeOriginal`
- 多张照片 EXIF 位置不同 → 取第一张有 GPS 的为准
- 用户可手动覆盖自动填充结果

### 2.3 裁剪

- 点击单张图 → 弹出裁剪弹窗（react-easy-crop）
- 圆形裁剪（Pin图显示在圆形气泡里）
- 确认后替换原图（in-memory）

### 2.4 压缩

- 移动端：max 1200px 宽，quality 0.85
- 桌面端：max 1920px 宽，quality 0.9
- 超过 5MB 强制压缩
- 使用 browser-image-compression

### 2.5 封面标记

- 第一张图默认标记为封面（⭐ Pin图）
- 用户可拖拽排序改变顺序
- 加 `+` 按钮继续添加，最多 9 张

---

## 三、LocationPicker — 位置选择器

### 3.1 三种选位置方式（共存）

**方式一：搜索自动补全**
- 输入框输入 → 调 `GET /api/geo/suggest?q=xxx`
- 后端查 DB 缓存 → 无则调高德 → 存 DB → 返回
- 下拉列表展示匹配结果（行政区域 + 具体景点）
- 选中后填入国家/城市/坐标

**方式二：地图微调**
- 点击 `🗺️` 按钮弹出半屏地图（复用 Globe mini 模式）
- 地图中央固定十字准星，用户拖动地图选点
- 确认 → `GET /api/geo/reverse?lat=...&lng=...` → 填入

**方式三：定位按钮**
- 点击 `📍` 调 `navigator.geolocation.getCurrentPosition`
- 拿到坐标 → 反向编码 → 填入
- 移动端需要 HTTPS 或 localhost

### 3.2 后端接口

```
GET /api/geo/suggest?q=<keyword>
  → { suggestions: [{ name, country, city, lat, lng }] }
  → DB: geo_suggest_cache (keyword_hash, response_json, created_at)

GET /api/geo/reverse?lat=...&lng=...
  → { country, city, name, lat, lng }
  → DB: geo_reverse_cache (coord_hash, response_json, created_at)
```

缓存策略：高德返回的行政区域数据几乎不变，永久缓存。每次先查 DB，未命中才调高德。

---

## 四、PlaceDrawer 重构 — 旅行记忆卡片

### 4.1 MemoryCard 组件

将同一时间的照片+文字合并展示：

```
┌──────────────────────────────┐
│ 🖼️ [大图轮播，可左右滑]       │
├──────────────────────────────┤
│ 📍 青海 · 茶卡盐湖            │
│ 📅 2026-06-21  19:30         │
│ 💬 文字内容...                │
├──────────────────────────────┤
│ [编辑] [删除]                 │
└──────────────────────────────┘
```

### 4.2 数据映射

当前 API 限制：每个 Post 只有一个 `photo_id`，Photo 不直接关联 Post。

归组策略：
```
一个地点 (Place)
  ├── Post A (有photo_id) + 对应 Photo → MemoryCard #1 (图文)
  ├── Post B (无photo_id)               → MemoryCard #2 (纯文字)
  ├── 未被Post关联的 Photo 1            → MemoryCard #3 (纯图，提示"补充文字")
  └── 未被Post关联的 Photo 2            → MemoryCard #4 (纯图，提示"补充文字")
```

- 帖子有 `photo_id` → 找到对应 Photo → 图文合并为一张卡片
- 帖子无 `photo_id` → 纯文字卡片
- 照片未被任何 Post 引用 → 纯图卡片，点击可追加文字（创建新 Post 关联此图）

### 4.3 「添加记忆」

以 `append` 模式打开 UnifiedPostEditor，位置默认填入当前地点信息。

---

## 五、Globe 地图增强

### 5.1 地图点击选点

- 用户点击地图空白处 → 放置临时 Pin + 十字准星
- 弹出小气泡：「在此创建足迹？」→ 点击确认打开 UnifiedPostEditor
- 位置自动填入点击坐标

### 5.2 定位按钮

- 保留现有地图定位按钮（飞到当前位置 + 蓝色脉冲标记）
- 修复：`navigator.geolocation` 在移动端需要 HTTPS / 用户手势触发
- 确保按钮直接在用户点击事件中调用（不在 setTimeout/async 中）

### 5.3 Pin 图优化

- Pin 显示帖子的首图（圆形裁剪，40px）
- 修复：Globe 内的内联 HTML 样式移到 CSS 文件
- 激活状态：Pin 放大 1.1x + 蓝色光环

---

## 六、全局修正

### 6.1 移除 window.fetch 覆盖

- 删除 `lib/auth.ts` 中的 `window.fetch` 覆盖
- `api.ts` 的 `request()` 已经手动注入 Authorization 头，不需要全局覆盖
- 避免双重注入 + 非 API 请求的 token 泄漏

### 6.2 修复 busy/loading 状态

- UnifiedPostEditor 有自己的 `submitting` 状态
- 不再复用 App 的全局 `loading`

### 6.3 CSS 重构

- 将 Globe 内的内联样式（标记 HTML、簇样式）移到 `styles.css`
- 新增颜色 CSS 自定义属性（减少重复色值）
- 保持现有的毛玻璃效果和动画

### 6.4 类型清理

- 删除 PlaceDrawer 中的 `PlaceDraft` 类型，统一使用 `PlaceInput`
- `Post.photo_id` 改为 `string | null`（更语义化）

---

## 七、技术栈（引入新依赖）

| 包 | 用途 |
|----|------|
| `exif-js` | 浏览器端解析照片 EXIF |
| `react-easy-crop` | 图片裁剪 |
| `browser-image-compression` | 图片压缩 |
| `@dnd-kit/core` + `@dnd-kit/sortable` | 拖拽排序（可选，简单的可以用原生） |

---

## 八、不在范围

- 后端 `/api/places`、`/api/posts` 的 API 改动
- 后端登录/认证流程改动
- 高德地图 SDK 版本升级
- 评论、收藏等社交功能
