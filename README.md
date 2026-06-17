# 旅行坐标 · Travel Coordinates

记录旅行足迹的交互式地图应用。在高德地图上标记去过的地点，上传照片和游记，支持行政区划逐级下钻（国家 → 省 → 市 → 区/县）。

![License](https://img.shields.io/badge/license-MIT-blue)
![Go](https://img.shields.io/badge/Go-1.26-00ADD8)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6)

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Vite 8 |
| 地图引擎 | 高德地图 JS API 2.0 |
| 后端 | Go 1.26（标准库 `net/http`） |
| 存储（数据） | JSON 文件持久化 |
| 存储（图片） | 本地文件系统 / Cloudflare R2（S3 兼容） |
| 地图数据 | 高德 DistrictSearch + 阿里云 DataV GeoJSON |

---

## 功能

- 🗺️ **交互式地图** — 高德底图，拖拽、缩放、点击下钻
- 📍 **地点标记** — 已访问地点显示为蓝点，选中高亮为金色
- 🔍 **行政区划下钻** — 点击省份 → 城市 → 区县，逐级查看
- 📸 **照片上传** — 支持 Cloudflare R2 或本地存储
- ✍️ **旅行帖子** — 文字 + 可选图片
- 📱 **响应式布局** — 桌面端抽屉面板，移动端底部弹窗
- 📍 **浏览器定位** — 一键获取当前位置填写坐标
- 🔑 **无登录** — 单用户模式（userID = 0001）

---

## 项目结构

```
travel-coordinates/
├── api/                          # Go 后端
│   ├── cmd/server/main.go        # 入口
│   ├── internal/
│   │   ├── config.go             # 配置中心（环境变量 → Config 结构体）
│   │   ├── http/server.go        # HTTP 路由 + 处理器
│   │   └── store/
│   │       ├── store.go          # CRUD + JSON 文件持久化
│   │       ├── models.go         # 数据模型
│   │       └── r2.go             # Cloudflare R2 客户端（S3 协议）
│   └── data/                     # 运行时数据（gitignored）
├── web/                          # React 前端
│   ├── src/
│   │   ├── App.tsx               # 根组件（状态、布局、API 调用）
│   │   ├── components/
│   │   │   ├── Globe.tsx         # 高德地图 + 标记 + 下钻
│   │   │   ├── PlaceForm.tsx     # 新增地点表单
│   │   │   └── PlaceDrawer.tsx   # 地点详情（照片/帖子/编辑）
│   │   ├── lib/
│   │   │   ├── api.ts            # HTTP 请求封装
│   │   │   └── types.ts          # TypeScript 类型定义
│   │   └── styles.css            # 全局样式
│   ├── index.html
│   └── vite.config.ts
└── docs/                         # 设计文档
```

---

## 快速开始

### 前置要求

- Go 1.22+
- Node.js 20+
- 高德地图 API Key（[免费申请](https://lbs.amap.com/api/javascript-api/guide/abc/prepare)）

### 1. 配置前端

```bash
cd web
cp .env.example .env
```

编辑 `web/.env`：

```env
VITE_AMAP_KEY=你的高德Key
VITE_AMAP_SECRET=你的高德安全密钥
```

### 2. 配置后端

```bash
cd api
cp .env.example .env
```

编辑 `api/.env`（全部可选，不配使用默认值）：

```env
PORT=8080
TRAVEL_COORDINATES_DATA_DIR=data
```

### 3. 启动开发

```bash
# 终端 1：后端
cd api && go run ./cmd/server

# 终端 2：前端
cd web && npm install && npm run dev
```

打开 http://localhost:5173

> **说明**：Vite 开发服务器自动将 `/api` 请求代理到 `localhost:8080`，无需处理跨域。

---

## 生产部署

```bash
cd web && npm run build
cd ../api && go build -o server ./cmd/server
./server
```

Go 服务会自动检测 `web/dist/` 并托管静态前端文件，访问 http://localhost:8080 即可。

---

## 配置参考

### 前端（`web/.env`）

| 变量 | 必填 | 说明 |
|------|:--:|------|
| `VITE_AMAP_KEY` | ✅ | 高德地图 JS API Key |
| `VITE_AMAP_SECRET` | ✅ | 高德安全密钥 |
| `VITE_API_URL` | | 后端地址，默认为空（同源代理） |

### 后端（`api/.env`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 服务端口 |
| `TRAVEL_COORDINATES_DATA_DIR` | `data` | 数据目录 |
| `TRAVEL_COORDINATES_WEB_DIR` | 自动查找 | 前端构建目录 |
| `R2_ACCOUNT_ID` | | Cloudflare R2 账户 ID |
| `R2_BUCKET` | | R2 存储桶名称 |
| `R2_ACCESS_KEY` | | R2 API Token 公钥 |
| `R2_SECRET_KEY` | | R2 API Token 私钥 |
| `R2_DOMAIN` | | R2 自定义域名（可选） |
| `R2_ENDPOINT` | 自动 | 自定义 S3 端点（可选） |

> 不配置 R2 相关变量时，图片自动存储到本地 `api/data/uploads/`。

---

## API 接口

所有接口以 `userID = 0001` 操作，无需认证。

### 地点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/places` | 列出所有地点 |
| `POST` | `/api/places` | 新增地点 |
| `GET` | `/api/places/{id}` | 获取地点详情 |
| `PUT` | `/api/places/{id}` | 更新地点 |
| `DELETE` | `/api/places/{id}` | 删除地点 |

### 照片

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/places/{id}/photos` | 上传照片（multipart） |
| `DELETE` | `/api/places/{id}/photos/{photoId}` | 删除照片 |

### 帖子

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/places/{id}/posts` | 创建帖子（JSON 或 multipart） |
| `DELETE` | `/api/places/{id}/posts/{postId}` | 删除帖子 |

### 媒体代理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/media/{userID}/{placeID}/{filename}` | R2 图片代理（后端从 R2 取并返回） |

---

## 架构

```
浏览器                         Go 后端
┌──────────┐  fetch()   ┌──────────────────┐
│ React 19 │ ────────→  │ net/http (Go 1.22+)│
│ Vite 8   │ ←────────  │                    │
│ AMap SDK │            │ state.json ←→ 持久化 │
└──────────┘            │ R2 ←→ S3 API      │
                        └──────────────────┘
```

- **数据流**：React 通过 `fetch` 调用 Go API，Go 读写 JSON 文件持久化
- **图片流**：上传 → Go 接收 → 存 R2（或本地）→ 返回 `/api/media/...` 代理 URL → 浏览器读取
- **地图**：高德 SDK 在浏览器端加载，`DistrictSearch` 获取行政区边界，`scatter` 显示地点标记
