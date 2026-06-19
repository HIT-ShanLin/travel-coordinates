# 认证系统 & MySQL 升级 设计文档

**日期**: 2026-06-19
**目的**: 将项目从单用户文件存储升级为 MySQL + 用户认证系统，同时修复前端问题

## 1. 背景

当前项目使用 `state.json` 文件存储数据，`user_id` 硬编码为 `0001`。需要引入 MySQL、用户注册登录（阿里云短信验证码 + JWT）、Redis 验证码存储。

## 2. 目标

- MySQL 替代文件存储
- 手机号验证码登录/注册（阿里云短信）
- JWT 鉴权，所有 API 不再使用硬编码 user_id
- 修复前端三个问题：移动端上传、地图 Logo 遮挡、城市内容计数
- 前端新增登录页面

## 3. 架构

```
前端 SPA (:5173 dev / Go 内嵌 prod)
    │ JWT Bearer Token
    ▼
Go 后端 (:8080)
    ├── handler/auth   ← send-code, login, me
    ├── handler/place  ← CRUD (提取JWT user_id)
    ├── middleware/jwt  ← Token 解析
    ├── service/auth    ← 认证逻辑
    ├── service/place   ← 地点逻辑
    ├── adapter/sms     ← 阿里云短信
    ├── adapter/storage ← 文件存储
    └── repo/place      ← MySQL 仓储
    │
    ├── MySQL (:3306)
    └── Redis (:6379)
```

## 4. 数据库

### users
```sql
id VARCHAR(36) PK, phone VARCHAR(20) UNIQUE NOT NULL,
nickname VARCHAR(100) DEFAULT '', avatar_url VARCHAR(500) DEFAULT '',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### sms_codes (仅 Redis 存储，不入 MySQL)
```
key: sms:{phone}, value: code, TTL: 300s
```

### places
```sql
id VARCHAR(36) PK, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
name VARCHAR(255) NOT NULL, latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL,
country VARCHAR(100) DEFAULT '', city VARCHAR(100) DEFAULT '',
travel_date VARCHAR(20) DEFAULT '', note TEXT, place_type VARCHAR(100) DEFAULT '',
created_at TIMESTAMP, updated_at TIMESTAMP
```

### photos
```sql
id VARCHAR(36) PK, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
place_id VARCHAR(36) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
url VARCHAR(500) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### posts
```sql
id VARCHAR(36) PK, user_id VARCHAR(36) NOT NULL REFERENCES users(id),
place_id VARCHAR(36) NOT NULL REFERENCES places(id) ON DELETE CASCADE,
title VARCHAR(255) DEFAULT '', content TEXT,
photo_id VARCHAR(36) REFERENCES photos(id) ON DELETE SET NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

## 5. API

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | /api/auth/send-code | 无 | `{phone}` → 阿里云发短信 → 存 Redis (5min) |
| POST | /api/auth/login | 无 | `{phone, code}` → 验证 → JWT (7天) → 返回 user+token |
| GET | /api/auth/me | JWT | 返回当前用户信息 |
| GET | /api/places | JWT | 列表（按 user_id 过滤） |
| POST | /api/places | JWT | 创建 |
| GET | /api/places/{id} | JWT | 详情 |
| PUT | /api/places/{id} | JWT | 更新 |
| DELETE | /api/places/{id} | JWT | 删除 |
| POST | /api/places/{id}/photos | JWT | 上传照片 |
| DELETE | /api/places/{id}/photos/{pid} | JWT | 删除照片 |
| POST | /api/places/{id}/posts | JWT | 发帖 |
| DELETE | /api/places/{id}/posts/{pid} | JWT | 删帖 |

## 6. 前端

### 路由
- `/login` → LoginPage（手机号 + 验证码）
- `/` → 现有地图主页（AuthGuard 拦截未登录）

### 认证流程
1. 未登录 → 跳转 `/login`
2. 输入手机号 → 点击"发送验证码" → 60s 倒计时
3. 输入验证码 → 点击"登录" → 后端验证成功返回 JWT + user
4. Token 存 localStorage → 跳转首页
5. 所有 fetch 请求自动带 `Authorization: Bearer <token>`

### 修复
- 移动端上传：input 加 `capture="environment"`，改用 button 触发而非 label 包裹
- Logo 遮挡：地图容器 `padding-bottom: 24px`，面板弹起时 AMap logo 下移
- 城市计数：下钻时用 AMap.GeometryUtil.isPointInRing 统计各面内 Place 数

## 7. 基础设施

```
deploy/
├── docker-compose.yml     ← MySQL 8.4 + Redis 7
├── cloudflared/
└── mysql/init.sql
```

环境变量（.env）: ALIBABA_ACCESS_KEY_ID, ALIBABA_ACCESS_KEY_SECRET, ALIBABA_SMS_SIGN_NAME, ALIBABA_SMS_TEMPLATE_CODE, JWT_SECRET, MYSQL_DSN, REDIS_ADDR

## 8. 验证标准

- [ ] 新用户通过手机号 + 验证码注册成功
- [ ] 已注册用户登录成功，获取 JWT
- [ ] 创建地点时 user_id 来自 JWT，非硬编码
- [ ] 移动端上传照片正常
- [ ] 地图 Logo 不遮挡抽屉内容
- [ ] 城市下钻显示该区域内地点数量
