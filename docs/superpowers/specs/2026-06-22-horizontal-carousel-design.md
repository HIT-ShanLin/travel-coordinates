# 双层横向滑动轮播 (Two-Level Horizontal Carousel)

## 概述

将地点切换和帖子浏览改造为双层 CSS Scroll Snap 横向轮播，替代当前基于 React state 的手动触摸处理，消除滑动卡顿，增加地图联动。

## 问题诊断

当前 `PlaceDrawer.tsx` 使用 `onTouchStart/Move/End` + `setSwipeX` 状态驱动 `transform: translateX()`：

```tsx
// 当前：每次 touchmove 触发 setState → 异步渲染 → 视觉延迟
const onTouchMove = (e) => {
  setSwipeX(atStart || atEnd ? dx * 0.2 : dx);
};
```

React 状态更新的异步渲染导致 1-2 帧视觉延迟，用户感知为「必须按住再滑才有效」。**CSS Scroll Snap 是浏览器原生实现，GPU 加速，零 JS 延迟。**

## 架构

```
PlaceDrawer
├── TopBar (地点名 + 关闭按钮 + 计数器)
├── 地点轮播容器 (scroll-snap-type: x mandatory)
│   ├── PlaceCard[0]  ← 左侧 peek 16px
│   │   ├── 帖子轮播容器 (scroll-snap-type: x mandatory)
│   │   │   ├── PostCard[0]  ← 左侧 peek 16px
│   │   │   ├── PostCard[1] (当前)
│   │   │   └── PostCard[2]  ← 右侧 peek 16px
│   │   ├── 帖子进度条 (小圆点)
│   │   └── 底部操作 (添加记忆/删除地点)
│   ├── PlaceCard[1] (当前地点)
│   │   └── ...
│   └── PlaceCard[2]  ← 右侧 peek 16px
├── 地点进度条 (小圆点)
└── 桌面端左右箭头 (hover 浮现)
```

### 嵌套滚动策略

浏览器原生 scroll chaining：
- 用户在帖子区横向滑动 → 内层帖子轮播响应
- 帖子滑到边界后 → 外层地点轮播自动接手
- 内层加 `overscroll-behavior: contain` 防止意外切换地点

## 组件设计

### 1. PlaceCard（地点卡片）

每个 sibling place 渲染为一个 PlaceCard，包含：
- 该地点的所有记忆卡片（MemoryCard 列表）
- 帖子级横向轮播（如果帖子数 > 1）
- 底部操作按钮

```
PlaceCard 宽度 = panel 宽度 - 32px (两端各 16px peek)
```

### 2. PostCarousel（帖子轮播）

内嵌在 PlaceCard 中：
- 每个 post/photo-only 为一张独立卡片
- `scroll-snap-align: center`
- Peek 效果：前后卡片露出 16px

### 3. CarouselContainer（通用轮播容器）

复用组件：
- `overflow-x: auto; scroll-snap-type: x mandatory`
- `scroll-snap-align: center` 子元素
- IntersectionObserver 检测当前可见卡片
- 隐藏滚动条
- 支持触控板和触摸

## 交互行为

### 移动端
- **地点间切换**：手指在卡片区域左右滑动 → CSS Scroll Snap 磁吸
- **帖子间切换**：手指在帖子卡片区域左右滑动 → 嵌套 Scroll Snap
- **纵向滚动**：地点内帖子列表可纵向滚动（帖子卡片内部）

### 桌面端
- **触控板**：双指横向滑动 → Scroll Snap 响应
- **鼠标**：hover 卡片左/右边缘 → 淡入半透明箭头按钮 ⟨ ⟩
- **键盘**：← → 键切换（可选）

### 图网联动 (Map Sync)

当轮播滚动到新地点卡片时（IntersectionObserver 触发）：

1. 地图平滑飞行到新地点坐标：`map.setZoomAndCenter(12, [lng, lat], true, 800)`
2. 旧 pin 缩回普通大小，新 pin 放大高亮
3. 地点进度条同步更新
4. 不重新 fetch 数据（sibling places 已在内存中）

### 帖子切换时的轻量联动

当帖子轮播切换帖子时：
- 如果当前帖子有图片，地图不动（同一地点）
- 地点进度条不变

## CSS 关键样式

```css
/* 地点轮播 */
.place-carousel {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 0 16px; /* 两端留白实现 peek */
}

.place-carousel::-webkit-scrollbar { display: none; }

.place-card {
  flex: 0 0 calc(100% - 32px); /* 露出邻卡 16px */
  scroll-snap-align: center;
  scroll-snap-stop: always;
}

/* 帖子轮播 */
.post-carousel {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  overscroll-behavior: contain; /* 边界不传递到外层 */
}

.post-carousel::-webkit-scrollbar { display: none; }

.post-card-item {
  flex: 0 0 calc(100% - 32px);
  scroll-snap-align: center;
}

/* 桌面箭头 */
.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s;
}
.carousel-container:hover .carousel-arrow { opacity: 1; }
```

## 数据流

```
App.tsx
  ├── siblingPlaces (同城市的地点列表，已加载)
  ├── selectedPlaceId → 由 IntersectionObserver 更新
  ├── onNavigate → setSelectedPlaceId + 触发地图 flyTo
  └── PlaceDrawer
        ├── PlaceCarousel (siblingPlaces)
        │     ├── PlaceCard[0] → PostCarousel (place.posts + photos)
        │     ├── PlaceCard[1] → PostCarousel
        │     └── PlaceCard[n] → PostCarousel
        └── IntersectionObserver → 检测当前可见 PlaceCard
              → 更新 selectedPlaceId → Globe.syncMarkers
```

## 加载策略

- **地点级**：sibling places 数据已在内存中（App.tsx 已加载全部 places）
- **帖子图片**：仅加载当前 PlaceCard ± 1 的图片（`loading="lazy"` + IntersectionObserver）
- **地图标记**：Globe 组件已有 clustering，缩放级别控制标记密度

## 与现有代码的关系

| 文件 | 变更 |
|------|------|
| `PlaceDrawer.tsx` | 重写：移除手动 touch handler，改用 CSS Scroll Snap + IntersectionObserver |
| `PlaceDrawer.tsx` | 新增：PlaceCarousel + PostCarousel 子组件 |
| `MemoryCard.tsx` | 轻微调整：适配帖子卡片独立展示 |
| `App.tsx` | 新增：地图联动回调 `onSwipeToPlace` |
| `Globe.tsx` | 新增：暴露 `panTo` 方法供外部调用 |
| `styles.css` | 新增：轮播容器、箭头、peek 相关样式 |

## 验收标准

- [ ] 移动端：手指滑动地点之间，无需按住等待，即时跟手
- [ ] 移动端：松手后卡片自动磁吸对齐，不会卡在半路
- [ ] 移动端：能看到相邻卡片的边缘（peek 效果）
- [ ] 桌面端：hover 卡片边缘出现箭头，点击可切换
- [ ] 桌面端：触控板双指横向滑动可切换
- [ ] 嵌套滑动：帖子内滑到边界后，自动切换为地点滑动
- [ ] 地图联动：滑动切换地点时，地图平滑飞到新地点
- [ ] pin 联动：当前地点的 pin 高亮，其他恢复普通状态
