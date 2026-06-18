# 旅行坐标 · 项目规范

## 项目概览

旅行日志单仓库项目，包含高德地图交互、地点增删改查、照片上传、行政区划下钻。

```
root/
  api/    → 接口契约（OpenAPI + Proto），不含 Go 代码
  go/     → Go 后端（DDD 风格单体）
  web/    → React 前端（Vite SPA）
  docs/   → 产品与架构文档
```

## 通用规则

1. **`api/` 只能放契约文件** — `openapi.yaml` 和 `proto/` 目录。Go 代码在 `go/`。
2. **传输层不含业务逻辑** — HTTP/gRPC handler 调用 `service`，绝不直接访问 `repo` 或 `domain`。
3. **密钥不进 git** — `.env` 在 `.gitignore` 中，只提交 `.env.example` 模板。
4. **配置集中管理** — 后端从 `configs/config.yaml` + 环境变量读取（通过 `bootstrap/config.go`）。前端使用 `VITE_*` 环境变量。
5. **有改动必须有测试** — 每个 domain 实体、service 用例、HTTP handler 都要有对应测试。Push 之前 `go test ./...` 必须全绿。
6. **单用户模式** — `userID = "0001"` 硬编码，暂无登录功能。
7. **中文界面** — 前端界面使用简体中文。

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
| `web/vite.config.ts` | Vite 配置 + API 代理 |
| `api/openapi.yaml` | HTTP API 契约 |
| `README.md` | 项目说明和启动指南 |
