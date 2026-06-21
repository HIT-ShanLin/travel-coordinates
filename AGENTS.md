# 旅行坐标 · 项目规范

## 项目概览

旅行日志单仓库项目，包含高德地图交互、地点增删改查、照片上传、行政区划下钻。

```
root/
  api/    → 接口契约（OpenAPI + Proto），不含 Go 代码
  go/     → Go 后端（DDD 风格单体）
  web/    → React 前端（Vite SPA）
  deploy/ → 部署配置（Docker Compose + Cloudflare Tunnel）
  docs/   → 产品与架构文档
```

## 启动项目（验收用）

```bash
# 1. 确保 Docker 运行
colima start

# 2. 启动 MySQL + Redis
cd deploy && docker compose up -d

# 3. 构建前端（如果 web/dist/ 不是最新）
cd web && npm run build

# 4. 启动后端（同时服务 API + 前端静态文件）
cd go && go run ./cmd/server

# 5. 启动隧道（对外暴露）
cd deploy/cloudflared && sh run.sh start
```

- 本地访问：http://localhost:8080
- 公网访问：https://travel.sltechblog.site

查看服务状态：
```bash
cd deploy && docker compose ps              # MySQL / Redis
cd deploy/cloudflared && sh run.sh status   # 隧道
curl -s http://localhost:8080/api/places     # API（需认证返回 401 则说明正常）
```

## 通用规则

1. **`api/` 只能放契约文件** — `openapi.yaml` 和 `proto/` 目录。Go 代码在 `go/`。
2. **传输层不含业务逻辑** — HTTP/gRPC handler 调用 `service`，绝不直接访问 `repo` 或 `domain`。
3. **密钥不进 git** — `.env` 在 `.gitignore` 中，只提交 `.env.example` 模板。
4. **配置集中管理** — 后端从 `configs/config.yaml` + 环境变量读取（通过 `bootstrap/config.go`）。前端使用 `VITE_*` 环境变量。
5. **有改动必须有测试** — 每个 domain 实体、service 用例、HTTP handler 都要有对应测试。Push 之前 `go test ./...` 必须全绿。
6. **手机验证码登录** — 阿里云短信发送验证码，Redis 缓存，验证后返回 JWT。
7. **中文界面** — 前端界面使用简体中文。
8. **短信配额有限** — 不要随便发送测试短信。

## 新增功能流程

1. 先改契约：更新 `api/openapi.yaml`。
2. 实现领域规则：`go/internal/domain/`。
3. 编排服务用例：`go/internal/service/`。
4. 编写 HTTP handler：`go/internal/adapter/http/handler/`。
5. 注册路由：`go/internal/adapter/http/router.go`。
6. 更新前端：`web/src/`。
7. 保持 `go/README.md` 和 `docs/backend-ddd-architecture.md` 同步。

## Commit 规范

- `feat: <描述>` — 新功能
- `fix: <描述>` — 修 bug
- `refactor: <描述>` — 重构（不改行为）
- `docs: <描述>` — 文档
- `chore: <描述>` — 构建、依赖、工具

## 关键文件

| 文件 | 作用 |
|------|------|
| `docs/backend-ddd-architecture.md` | 后端架构规范（DDD 分层、依赖方向） |
| `go/internal/bootstrap/wiring.go` | 依赖组装入口（组合根） |
| `go/internal/bootstrap/config.go` | 配置加载（config.yaml + 环境变量） |
| `go/internal/adapter/http/router.go` | HTTP 路由注册 |
| `web/vite.config.ts` | Vite 配置 + API 代理 |
| `api/openapi.yaml` | HTTP API 契约 |
| `deploy/docker-compose.yml` | MySQL + Redis 容器 |
| `deploy/cloudflared/run.sh` | Cloudflare Tunnel 启停脚本 |
| `README.md` | 项目说明和启动指南 |
