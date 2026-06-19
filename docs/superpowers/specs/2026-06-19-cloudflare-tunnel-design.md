# Cloudflare Tunnel 设计文档

**日期**: 2026-06-19  
**目的**: 将本地 Go 后端通过 Cloudflare Tunnel 暴露到公网，供移动端访问

## 1. 背景

travel-coordinates 项目运行在 Mac 本地（Go 后端 :8080 + 前端静态文件），无公网 IP。移动端无法直接访问。Cloudflare Tunnel 提供一个安全的反向代理通道，将公网域名流量转发到本地服务。

## 2. 目标

- 移动端浏览器通过 `https://travel.sltechblog.site` 访问项目
- 无需开放路由器端口、无需公网 IP
- 自动 HTTPS 证书（Cloudflare 提供）

## 3. 架构

```
移动端浏览器
    │
    ▼
https://travel.sltechblog.site (Cloudflare DNS → Tunnel)
    │
    ▼
cloudflared 进程 (本地)
    │
    ▼
http://localhost:8080 (Go 后端 → API + 前端静态文件)
```

## 4. 文件结构

```
deploy/
└── cloudflared/
    ├── config.yml    ← 隧道配置
    └── run.sh        ← 启动/停止脚本
```

## 5. 配置文件设计

### `config.yml`

```yaml
tunnel: travel-coordinates
credentials-file: ~/.cloudflared/travel-coordinates.json

ingress:
  - hostname: travel.sltechblog.site
    service: http://localhost:8080
  - service: http_status:404
```

- `tunnel`: 隧道名称，与 `cloudflared tunnel create` 创建的 UUID 隧道关联
- `credentials-file`: Cloudflare 自动生成的凭证文件
- `ingress[0]`: 将 `travel.sltechblog.site` 流量转发到本地 8080
- `ingress[1]`: 兜底规则，未匹配的请求返回 404

### `run.sh`

```bash
#!/bin/sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "${1:-start}" in
  start)
    echo "Starting cloudflared tunnel..."
    cloudflared tunnel --config "$SCRIPT_DIR/config.yml" run
    ;;
  stop)
    echo "Stopping cloudflared..."
    pkill -f "cloudflared tunnel.*travel-coordinates" || echo "not running"
    ;;
  status)
    if pgrep -f "cloudflared tunnel.*travel-coordinates" > /dev/null; then
      echo "cloudflared is running"
    else
      echo "cloudflared is not running"
    fi
    ;;
  *)
    echo "Usage: run.sh {start|stop|status}"
    exit 1
    ;;
esac
```

## 6. 实施步骤

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | `brew install cloudflared` | 安装 CLI 工具 |
| 2 | `cloudflared tunnel login` | 浏览器授权 Cloudflare 账号 |
| 3 | `cloudflared tunnel create travel-coordinates` | 创建隧道，生成 UUID 和凭证 |
| 4 | `cloudflared tunnel route dns travel-coordinates travel.sltechblog.site` | 自动在 Cloudflare DNS 添加 CNAME 记录 |
| 5 | 编写 `deploy/cloudflared/config.yml` | 隧道配置 |
| 6 | 编写 `deploy/cloudflared/run.sh` | 启动脚本 |
| 7 | `./deploy/cloudflared/run.sh start` | 启动隧道 |
| 8 | 移动端访问 `https://travel.sltechblog.site` | 验证可访问 |

## 7. 验证标准

- [ ] `https://travel.sltechblog.site/healthz` 返回 `{"status":"ok"}`
- [ ] `https://travel.sltechblog.site/` 显示旅行坐标前端页面
- [ ] 移动端浏览器可正常访问和交互
- [ ] HTTPS 证书有效（Cloudflare 自动颁发）

## 8. 后续扩展

- 升级为 macOS LaunchAgent，实现开机自启
- 添加健康检查自动重启
- 多服务隧道（如开发/生产环境分流）
