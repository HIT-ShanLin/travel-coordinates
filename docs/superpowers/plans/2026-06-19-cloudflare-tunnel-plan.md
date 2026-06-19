# Cloudflare Tunnel 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 Cloudflare Tunnel 将本地 Go 后端 (localhost:8080) 暴露到公网 `https://travel.sltechblog.site`

**Architecture:** cloudflared 在本地建立与 Cloudflare 边缘节点的加密隧道，DNS 将 `travel.sltechblog.site` 指向该隧道，流量经 Cloudflare 转发到 `localhost:8080`

**Tech Stack:** cloudflared CLI (Homebrew), Cloudflare DNS, Go HTTP server

## Global Constraints

- tunnel 名称: `travel-coordinates`
- 域名: `travel.sltechblog.site`
- 本地服务: `http://localhost:8080`
- 所有文件放在 `deploy/cloudflared/`
- `deploy/` 目录需加入 git 版本管理
- 具体凭证文件 (`credentials-file`) 不提交到 git

---

### Task 1: 安装 cloudflared

- [ ] **Step 1: 安装 cloudflared**

```bash
brew install cloudflared
```

- [ ] **Step 2: 验证安装**

```bash
cloudflared version
```

预期: 输出版本号，无报错

---

### Task 2: 授权 Cloudflare 账号

- [ ] **Step 1: 登录 Cloudflare**

```bash
cloudflared tunnel login
```

命令会自动打开浏览器 → 选择 `sltechblog.site` 所在账号 → 授权 `cloudflared` 访问 DNS 权限。

- [ ] **Step 2: 验证凭证已保存**

```bash
ls -la ~/.cloudflared/cert.pem
```

预期: 文件存在

---

### Task 3: 创建隧道

**Files:**
- Create: `~/.cloudflared/travel-coordinates.json`

- [ ] **Step 1: 创建隧道**

```bash
cloudflared tunnel create travel-coordinates
```

输出示例:
```
Created tunnel travel-coordinates with id <UUID>
```

该命令自动在 Cloudflare 创建隧道并生成凭证文件 `~/.cloudflared/travel-coordinates.json`。

- [ ] **Step 2: 验证隧道已创建**

```bash
cloudflared tunnel list
```

预期: 输出中包含 `travel-coordinates` 及其 UUID

- [ ] **Step 3: 配置 DNS 路由**

```bash
cloudflared tunnel route dns travel-coordinates travel.sltechblog.site
```

该命令自动在 Cloudflare DNS 添加一条 CNAME 记录: `travel.sltechblog.site → <tunnel-id>.cfargotunnel.com`

- [ ] **Step 4: 验证 DNS 记录**

```bash
cloudflared tunnel route dns travel-coordinates
```

预期: 输出中显示 `travel.sltechblog.site`

---

### Task 4: 编写配置文件

**Files:**
- Create: `deploy/cloudflared/config.yml`
- Create: `deploy/cloudflared/run.sh`
- Modify: `.gitignore`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p deploy/cloudflared
```

- [ ] **Step 2: 编写 config.yml**

`deploy/cloudflared/config.yml`:

```yaml
# Cloudflare Tunnel 配置
# 启动: ./run.sh start
# 停止: ./run.sh stop

tunnel: travel-coordinates
credentials-file: ${HOME}/.cloudflared/travel-coordinates.json

ingress:
  - hostname: travel.sltechblog.site
    service: http://localhost:8080
  - service: http_status:404
```

- [ ] **Step 3: 编写 run.sh**

`deploy/cloudflared/run.sh`:

```bash
#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "${1:-start}" in
  start)
    echo "Starting cloudflared tunnel (travel-coordinates)..."
    echo "  → https://travel.sltechblog.site"
    cloudflared tunnel --config "$SCRIPT_DIR/config.yml" run
    ;;
  stop)
    echo "Stopping cloudflared..."
    pkill -f "cloudflared tunnel.*travel-coordinates" || echo "  already stopped"
    ;;
  status)
    if pgrep -f "cloudflared tunnel.*travel-coordinates" > /dev/null; then
      echo "cloudflared is running"
      echo "  → https://travel.sltechblog.site"
    else
      echo "cloudflared is not running"
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
```

- [ ] **Step 4: 设置 run.sh 可执行权限**

```bash
chmod +x deploy/cloudflared/run.sh
```

- [ ] **Step 5: 更新 .gitignore**

确保 `deploy/cloudflared/` 下的配置文件可提交（凭证在 `~/.cloudflared/` 不在项目内）。当前 `.gitignore` 已忽略 `.env` 等敏感文件，本任务无需额外修改。

- [ ] **Step 6: 提交**

```bash
git add deploy/
git commit -m "feat: add cloudflare tunnel config and run script"
```

---

### Task 5: 启动隧道并验证

- [ ] **Step 1: 确认 Go 后端正在运行**

```bash
curl -s http://localhost:8080/healthz
```

预期: `{"status":"ok"}`

若未运行，先在 `go/` 目录启动:
```bash
go run ./cmd/server/ 2>&1 &
```

- [ ] **Step 2: 启动隧道**

```bash
./deploy/cloudflared/run.sh start
```

前台运行，终端会持续输出日志。建议开新终端或后台运行:
```bash
./deploy/cloudflared/run.sh start &
```

- [ ] **Step 3: 验证公网访问（API）**

```bash
curl -s https://travel.sltechblog.site/healthz
```

预期: `{"status":"ok"}`

- [ ] **Step 4: 验证公网访问（前端）**

```bash
curl -s -o /dev/null -w "%{http_code}" https://travel.sltechblog.site/
```

预期: `200`

- [ ] **Step 5: 移动端验证**

用手机浏览器访问 `https://travel.sltechblog.site`，确认:
- 地图正常加载
- 地点标记可点击
- 抽屉面板正常显示

- [ ] **Step 6: 验证停止命令**

```bash
./deploy/cloudflared/run.sh stop
./deploy/cloudflared/run.sh status
```

预期: `cloudflared is not running`

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: verify cloudflare tunnel works"
```

---

### Task 6: 推送并合并

- [ ] **Step 1: 推送当前分支**

```bash
git push origin feat/travel-c-tunnel
```

- [ ] **Step 2: 创建 PR 合并到 main**

在 GitHub 上创建 Pull Request，将 `feat/travel-c-tunnel` 合并到 `main`。
