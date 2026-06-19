# 认证系统 & MySQL 升级 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MySQL + Redis 基础设施，阿里云短信 JWT 认证，前端登录页，修复前端三个问题

**Architecture:** Go DDD 分层（adapter → service → repo），新增 auth service + MySQL repo + SMS adapter + JWT middleware。前端新增 LoginPage + AuthGuard，全局 fetch 拦截器注入 Token。

**Tech Stack:** Go 1.26 + MySQL 8.4 + Redis 7 + JWT (golang-jwt) + 阿里云短信 SDK + React 19 + TypeScript

## Global Constraints

- 分支: `feat/travel-c-tunnel`
- deploy/docker-compose.yml 统一管理 MySQL + Redis
- sms_codes 仅存 Redis (TTL 5min)，不入 MySQL
- JWT 过期 7 天
- 所有 .env 敏感配置不提交 git
- 前端路由: `/login` (公开), `/` (需登录)

---

### Task 1: 统一 Docker Compose + Redis

**Files:**
- Create: `deploy/docker-compose.yml` (合并 MySQL + Redis)
- Remove: `deploy/mysql/docker-compose.yml` (合并后删除单文件)

- [ ] **Step 1: 创建统一的 docker-compose.yml**

`deploy/docker-compose.yml`:

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: travel-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-travel123}
      MYSQL_DATABASE: travel_coordinates
      MYSQL_USER: travel
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-travel123}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql/init.sql:/docker-entrypoint-initdb.d/01-init.sql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: travel-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

- [ ] **Step 2: 停旧容器，起新环境**

```bash
cd deploy && docker compose up -d
```

- [ ] **Step 3: 验证 MySQL 和 Redis 都正常**

```bash
docker exec travel-mysql mysql -uroot -ptravel123 -e "SHOW TABLES;" travel_coordinates
docker exec travel-redis redis-cli PING
```

- [ ] **Step 4: 提交**

```bash
git add deploy/ && git commit -m "feat: unified docker-compose with MySQL and Redis"
```

---

### Task 2: Go 依赖 + 配置更新

**Files:**
- Modify: `go/go.mod`, `go/go.sum`
- Modify: `go/configs/config.yaml`
- Modify: `go/internal/bootstrap/config.go`

- [ ] **Step 1: 安装 Go 依赖**

```bash
cd go
go get github.com/go-sql-driver/mysql@latest
go get github.com/golang-jwt/jwt/v5@latest
go get github.com/redis/go-redis/v9@latest
go get github.com/aliyun/alibaba-cloud-sdk-go@latest
go get github.com/google/uuid@latest
```

- [ ] **Step 2: 更新 config.yaml**

```yaml
# MySQL
mysql_dsn: "travel:travel123@tcp(127.0.0.1:3306)/travel_coordinates?parseTime=true&charset=utf8mb4"

# Redis
redis_addr: "127.0.0.1:6379"

# JWT
jwt_secret: "change-me-in-production"

# SMS
sms_access_key_id: ""
sms_access_key_secret: ""
sms_sign_name: "云渚科技验证服务"
sms_template_code: "100001"
```

- [ ] **Step 3: 更新 Config struct**

`go/internal/bootstrap/config.go` 追加字段:

```go
type Config struct {
    // ... existing ...
    MySQLDSN          string
    RedisAddr         string
    JWTSecret         string
    SMSAccessKeyID    string
    SMSAccessKeySecret string
    SMSSignName       string
    SMSTemplateCode   string
}
```

在 `LoadConfig()` 中读取对应配置项和 `envOr()` 覆盖。

- [ ] **Step 4: 提交**

```bash
git add go/ && git commit -m "feat: add MySQL, Redis, JWT, SMS dependencies and config"
```

---

### Task 3: MySQL Repository

**Files:**
- Create: `go/internal/repo/place/mysql_repository.go`
- Modify: `go/internal/bootstrap/wiring.go`
- Modify: `go/internal/repo/place/repository.go` (如需要调整接口)

MySQL repository 实现 `Repository` 接口: `List`, `FindByID`, `Save`, `Delete`，以及 photos/posts 的关联操作。

- [ ] **Step 1: 实现 mysql_repository.go**
- [ ] **Step 2: 更新 wiring.go 使用 MySQL repo**
- [ ] **Step 3: 编译验证 `go build ./...`**
- [ ] **Step 4: 提交**

---

### Task 4: SMS + Redis + JWT 基础设施

**Files:**
- Create: `go/internal/adapter/sms/aliyun.go`
- Create: `go/internal/adapter/http/middleware/jwt.go`
- Create: `go/pkg/jwt/jwt.go`

- [ ] **Step 1: 实现 JWT 工具包** (pkg/jwt/jwt.go — Sign + Verify)
- [ ] **Step 2: 实现阿里云短信适配器** (adapter/sms/aliyun.go)
- [ ] **Step 3: 实现 JWT middleware** (adapter/http/middleware/jwt.go — Extract user_id from Header)
- [ ] **Step 4: 编译验证**
- [ ] **Step 5: 提交**

---

### Task 5: Auth Service + Handler

**Files:**
- Create: `go/internal/service/auth/service.go`
- Create: `go/internal/adapter/http/handler/auth_handler.go`
- Modify: `go/internal/adapter/http/router.go`
- Modify: `go/internal/bootstrap/wiring.go`

- [ ] **Step 1: 实现 auth service** (SendCode, Login, GetMe)
- [ ] **Step 2: 实现 auth handler** (3 个端点)
- [ ] **Step 3: 注册路由** (/api/auth/send-code, /api/auth/login, /api/auth/me)
- [ ] **Step 4: 给 /api/places/* 加 JWT middleware**
- [ ] **Step 5: 修改 place handler 从 context 取 user_id**
- [ ] **Step 6: 编译、启动、curl 测试**
- [ ] **Step 7: 提交**

---

### Task 6: 前端登录页 + Auth

**Files:**
- Create: `web/src/components/LoginPage.tsx`
- Create: `web/src/components/AuthGuard.tsx`
- Create: `web/src/lib/auth.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/main.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: 实现 token 管理模块** (lib/auth.ts)
- [ ] **Step 2: 实现 LoginPage 组件**
- [ ] **Step 3: 实现 AuthGuard 组件**
- [ ] **Step 4: 更新 api.ts 自动注入 Authorization header**
- [ ] **Step 5: 更新 App.tsx 集成 AuthGuard 路由**
- [ ] **Step 6: 添加 login 相关 CSS**
- [ ] **Step 7: npm run build 验证**
- [ ] **Step 8: 提交**

---

### Task 7: 前端修复 + PlaceForm 改版

**Files:**
- Modify: `web/src/components/PlaceForm.tsx`
- Modify: `web/src/components/Globe.tsx`
- Modify: `web/src/components/PlaceDrawer.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: PlaceForm 改为高德搜索选点**
- [ ] **Step 2: 移动端上传修复** (button 触发 input)
- [ ] **Step 3: AMap Logo 遮挡修复** (CSS padding-bottom)
- [ ] **Step 4: 城市下钻地点计数** (isPointInRing)
- [ ] **Step 5: 移除演示数据，显示空状态**
- [ ] **Step 6: npm run build 验证**
- [ ] **Step 7: 提交**

---

### Task 8: 集成测试 + 启动验证

- [ ] **Step 1: docker compose up -d 启动 MySQL + Redis**
- [ ] **Step 2: 启动 Go 后端，确认 /healthz 返回 ok**
- [ ] **Step 3: curl /api/auth/send-code 发送验证码**
- [ ] **Step 4: 查 Redis 确认验证码已存储**
- [ ] **Step 5: curl /api/auth/login 登录获取 JWT**
- [ ] **Step 6: curl /api/places 带 JWT 创建地点**
- [ ] **Step 7: 打开前端，完整流程测试**
- [ ] **Step 8: 推送分支**
