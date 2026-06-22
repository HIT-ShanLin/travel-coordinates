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
| 后端 | Go 1.26（DDD 分层，`net/http`） |
| 数据库 | MySQL 8.4 |
| 缓存 | Redis 7 |
| 存储（图片） | 本地文件系统 / Cloudflare R2（S3 兼容） |
| 地图数据 | 高德 DistrictSearch + 阿里云 DataV GeoJSON |
| 隧道 | Cloudflare Tunnel（cloudflared） |

---

## 功能

- 🗺️ **交互式地图** — 高德底图，拖拽、缩放、点击下钻
- 📍 **地点标记** — 已访问地点显示为蓝点，选中高亮为金色
- 🔍 **行政区划下钻** — 点击省份 → 城市 → 区县，逐级查看
- 📸 **照片上传** — 支持 Cloudflare R2 或本地存储
- ✍️ **旅行帖子** — 文字 + 可选图片
- 📱 **响应式布局** — 桌面端抽屉面板，移动端底部弹窗
- 📍 **浏览器定位** — 一键获取当前位置填写坐标
- 🔑 **手机验证码登录** — 阿里云短信服务

---

## 项目结构

```
travel-coordinates/
├── api/                          # API 契约（OpenAPI + Proto）
├── go/                           # Go 后端（DDD 风格单体）
│   ├── cmd/server/main.go        # 入口
│   ├── internal/
│   │   ├── bootstrap/            # 启动引导（配置加载 + 依赖组装）
│   │   ├── domain/place/         # 领域实体 + 规则
│   │   ├── service/place/        # 用例编排
│   │   ├── service/auth/         # 认证服务（短信验证码 + JWT）
│   │   ├── repo/place/           # 持久化（MySQL / 文件系统）
│   │   └── adapter/
│   │       ├── http/             # HTTP 路由、handler、中间件、DTO
│   │       ├── grpc/             # gRPC（预留）
│   │       ├── sms/              # 阿里云短信
│   │       └── storage/          # 图片存储（本地 / R2）
│   ├── pkg/                      # 公共工具（JWT、日志）
│   ├── configs/config.yaml       # 配置文件
│   └── .env                      # 环境变量（gitignored）
├── web/                          # React 前端
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/           # 地图、表单、抽屉等组件
│   │   ├── lib/                  # API 调用 + 类型定义
│   │   └── styles.css
│   ├── index.html
│   └── vite.config.ts
├── deploy/                       # 部署配置
│   ├── docker-compose.yml        # MySQL + Redis
│   └── cloudflared/              # Cloudflare Tunnel 配置
└── docs/                         # 设计文档
```

---

## 快速开始

### 前置要求

- Go 1.22+
- Node.js 20+
- Docker + Colima（或 Docker Desktop）
- 高德地图 API Key（[免费申请](https://lbs.amap.com/api/javascript-api/guide/abc/prepare)）
- Cloudflare Tunnel（如需公网访问，[创建 Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)）

### 1. 启动基础设施（MySQL + Redis）

```bash
# 确保 Docker 在运行（Colima 用户）
colima start

# 启动 MySQL 和 Redis
cd deploy
docker compose up -d
```

等待 MySQL 进入 healthy 状态（`docker compose ps` 查看）。

### 2. 配置环境变量

```bash
# 后端（go/.env 已 gitignored，首次需要从模板复制）
cd go
cp .env.example .env
```

编辑 `go/.env`，填写必填项（MySQL DSN / Redis / SMS 等）。

```bash
# 前端
cd web
cp .env.example .env
```

编辑 `web/.env`，填入高德地图 Key：

```env
VITE_AMAP_KEY=你的高德Key
VITE_AMAP_SECRET=你的高德安全密钥
```

### 3. 构建前端

```bash
cd web
npm install
npm run build
```

产物输出到 `web/dist/`，Go 后端会自动检测并托管。

### 4. 启动后端

```bash
cd go
go run ./cmd/server
```

服务监听在 `http://localhost:8080`，同时提供 API 和前端静态文件。

### 5. （可选）启动隧道

```bash
cd deploy/cloudflared
sh run.sh start
```

公网地址：**https://travel.newquadrant.cn**

---

## 开发模式

如果需要前端热更新（HMR），分开启动：

```bash
# 终端 1：后端
cd go && go run ./cmd/server

# 终端 2：前端开发服务器
cd web && npm run dev
```

打开 http://localhost:5173 — Vite 自动将 `/api` 请求代理到 `localhost:8080`。

---

## 生产部署

```bash
# 1. 构建前端
cd web && npm run build

# 2. 编译后端
cd go && go build -o server ./cmd/server

# 3. 运行
./server
```

Go 服务自动检测 `web/dist/` 并托管静态前端，访问 http://localhost:8080 即可。

---

## 配置参考

### 后端（`go/.env`）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_DSN` | 必填 | MySQL 连接串，格式 `user:pass@tcp(host:port)/db?parseTime=true&charset=utf8mb4` |
| `REDIS_ADDR` | `127.0.0.1:6379` | Redis 地址 |
| `JWT_SECRET` | 必填 | JWT 签名密钥（随机字符串） |
| `SMS_ACCESS_KEY_ID` | 必填 | 阿里云短信 AccessKey |
| `SMS_ACCESS_KEY_SECRET` | 必填 | 阿里云短信 Secret |
| `SMS_SIGN_NAME` | `云渚科技验证服务` | 短信签名 |
| `SMS_TEMPLATE_CODE` | `100001` | 短信模板代码 |
| `PORT` | `8080` | 服务端口 |
| `TRAVEL_COORDINATES_DATA_DIR` | `data` | 本地数据目录 |
| `TRAVEL_COORDINATES_WEB_DIR` | 自动查找 | 前端构建目录 |
| `R2_ACCOUNT_ID` | | Cloudflare R2 账户 ID |
| `R2_ACCESS_KEY` | | R2 API Token 公钥 |
| `R2_SECRET_KEY` | | R2 API Token 私钥 |
| `R2_BUCKET` | | R2 存储桶名称 |
| `R2_DOMAIN` | | R2 自定义域名（可选） |
| `R2_ENDPOINT` | 自动 | 自定义 S3 端点（可选） |

> 不配置 R2 相关变量时，图片自动存储到本地 `go/data/uploads/`。

### 前端（`web/.env`）

| 变量 | 必填 | 说明 |
|------|:--:|------|
| `VITE_AMAP_KEY` | ✅ | 高德地图 JS API Key |
| `VITE_AMAP_SECRET` | ✅ | 高德安全密钥 |
| `VITE_API_URL` | | 后端地址，默认为空（同源代理） |

---

## API 接口

所有需认证接口在 Header 中携带 `Authorization: Bearer <token>`（通过短信验证码登录获取 JWT）。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/send-code` | 发送短信验证码 |
| `POST` | `/api/auth/login` | 验证码登录，返回 JWT |

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
┌──────────┐  fetch()   ┌──────────────────────┐
│ React 19 │ ────────→  │ net/http (Go 1.22+)  │
│ Vite 8   │ ←────────  │ DDD 分层             │
│ AMap SDK │            │   ├── adapter/http    │
└──────────┘            │   ├── service         │
                        │   ├── domain          │
                        │   └── repo            │
                        │                      │
                        │ MySQL ←→ 数据持久化    │
                        │ Redis ←→ 缓存/验证码   │
                        │ R2   ←→ 图片存储      │
                        └──────────────────────┘
```

- **数据流**：React 通过 `fetch` 调用 Go API，Go 通过 MySQL repository 读写数据
- **认证**：短信验证码 → JWT → 后续请求带 Token
- **图片流**：上传 → Go 接收 → 存 R2（或本地）→ 返回 `/api/media/...` 代理 URL → 浏览器读取
- **地图**：高德 SDK 在浏览器端加载，`DistrictSearch` 获取行政区边界，`scatter` 显示地点标记
