# Go 后端 · 编码规范

## 架构

DDD 风格单体。完整规范见 `docs/backend-ddd-architecture.md`。

### 层次调用方向

```
cmd ──→ bootstrap ──→ adapter/http ──→ service ──→ domain
                                           │
                                           ├──→ repo 接口
                                           │
                                           └──→ adapter/storage 接口
```

### 禁止引用

| 层 | 禁止引用 |
|----|---------|
| `domain` | `service`、`repo`、`adapter`、`bootstrap`、`pkg` |
| `service` | `adapter/http`、`adapter/grpc` |
| `repo` | `service`、`adapter/http` |
| `adapter/http` | 禁止绕过 `service` 直接调 `repo` |
| `pkg` | `internal/` 下的任何包 |

## 各包职责

| 包 | 存放内容 |
|----|---------|
| `internal/domain/place/` | 实体、值对象、领域错误、不变量（`rules.go`）。无外部依赖。 |
| `internal/service/place/` | 用例编排。调用 domain + repo + storage。DTO 在 `dto.go`。命令在 `commands.go`。查询在 `queries.go`。 |
| `internal/repo/place/` | `Repository` 接口 + 文件系统实现。负责 domain ↔ 持久化 转换。 |
| `internal/adapter/http/handler/` | HTTP 处理器。解析请求 → 调用 service → 写响应。 |
| `internal/adapter/http/dto/` | HTTP 专用请求/响应类型（与 service DTO 不同时使用）。 |
| `internal/adapter/http/router.go` | 路由注册 + `Server` 结构体。 |
| `internal/adapter/storage/` | `Storage` 接口 + `local` 和 `r2` 实现。 |
| `internal/bootstrap/` | `config.go` 读配置。`wiring.go` 组装依赖图。 |
| `pkg/logger/` | 通用日志工具。禁止引用 `internal/`。 |

## 命名规范

- **实体**：名词，导出结构体。如 `Place`、`Photo`、`Post`。
- **错误**：`var ErrXxx = errors.New(...)` 定义在 `errors.go`。
- **领域方法**：动词方法挂在实体上。如 `Place.AddPhoto()`、`Place.RemovePost()`。
- **Service 方法**：用例动词。如 `CreatePlace()`、`AddPhoto()`、`DownloadMedia()`。
- **Repository**：`List`、`FindByID`、`Save`、`Delete`。
- **Storage**：`Upload`、`Delete`、`DeletePlace`、`Download`。

## 测试规范

- 只用标准库 `testing`，不用第三方测试框架。
- 领域测试：`entity_test.go`、`rules_test.go`。测试所有不变量和边界情况。
- Handler 测试：用 `httptest` + `t.TempDir()` + 本地存储。
- Repo 测试：用 `t.TempDir()` 隔离。
- 测试函数命名：`Test<功能>_<场景>`（仅在需要区分时加场景后缀）。
- 运行：`go test ./... -count=1`。

## 配置

- `configs/config.yaml` — 默认值（可提交到 git）。
- `.env` — 本地覆盖（gitignored）。
- 环境变量优先级最高，覆盖配置文件。
- 统一通过 `bootstrap.LoadConfig()` 读取。禁止在其他包直接调用 `os.Getenv`。

## 新增接口流程

1. 修改根级 `api/openapi.yaml` 契约。
2. 如需领域逻辑：`internal/domain/place/`。
3. 新增 service 方法：`internal/service/place/service.go`。
4. 新增 handler 方法：`internal/adapter/http/handler/place_handler.go`。
5. 注册路由：`internal/adapter/http/router.go`。
6. 新增测试：`handler/place_handler_test.go`。
7. 验证：`go build ./cmd/server && go test ./...`。

## Go Module

- 模块路径：`travel-coordinates/go`
- Go 版本：1.26
- 构建命令：`CGO_ENABLED=0 go build -trimpath -o server ./cmd/server`
