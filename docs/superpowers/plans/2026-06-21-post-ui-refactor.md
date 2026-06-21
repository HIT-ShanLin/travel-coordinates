# 前端全面重构 + 后端 Geo 接口 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构前端发帖流程为统一体验（图片+时间+位置+文字一次完成），修复移动端定位、图片上传问题，新增后端地点搜索/反向编码接口（带 DB 缓存）.

**Architecture:** 新增 UnifiedPostEditor 替代 PlaceForm，拆分为 PhotoGrid / LocationPicker / PostContent 三个子组件。PlaceDrawer 重构为 MemoryCard 卡片流。Globe 增加地图点击选点和定位修复。后端新增 `/api/geo/suggest` 和 `/api/geo/reverse`，DB 缓存高德 API 结果。

**Tech Stack:** React 19, TypeScript 6, Vite 8, exif-js, react-easy-crop, browser-image-compression, @dnd-kit/core + @dnd-kit/sortable. 后端 Go 1.26, MySQL 8.4.

## Global Constraints

- `api/` 只能放契约文件，Go 代码在 `go/`
- 密钥不进 git，`.env` 在 `.gitignore` 中
- 后端从 `configs/config.yaml` + 环境变量读取配置
- Push 之前 `go test ./...` 必须全绿
- 前端界面使用简体中文
- 短信配额有限，不要随便发送测试短信
- 后端不改动 `/api/places`、`/api/posts` 的 API 签名，只新增 geo 接口

---

### Task 1: 后端 — Geo 缓存 MySQL 表 + 迁移脚本

**Files:**
- Create: `deploy/mysql/02-geo-cache.sql`
- Modify: `deploy/docker-compose.yml`

**Interfaces:**
- Produces: `geo_suggest_cache` 表, `geo_reverse_cache` 表

- [ ] **Step 1: 创建 MySQL 迁移脚本**

```sql
-- deploy/mysql/02-geo-cache.sql
CREATE TABLE IF NOT EXISTS geo_suggest_cache (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    keyword       VARCHAR(200) NOT NULL,
    response_json TEXT         NOT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_keyword (keyword)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS geo_reverse_cache (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    coord_hash    VARCHAR(64)  NOT NULL,
    lat           DOUBLE       NOT NULL,
    lng           DOUBLE       NOT NULL,
    country       VARCHAR(100) DEFAULT '',
    city          VARCHAR(100) DEFAULT '',
    name          VARCHAR(255) DEFAULT '',
    response_json TEXT         NOT NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_coord_hash (coord_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: 挂载迁移脚本到 Docker**

编辑 `deploy/docker-compose.yml`，在 mysql volumes 中增加一行:

```yaml
volumes:
  - mysql_data:/var/lib/mysql
  - ./mysql/init.sql:/docker-entrypoint-initdb.d/01-init.sql
  - ./mysql/02-geo-cache.sql:/docker-entrypoint-initdb.d/02-geo-cache.sql   # 新增
```

- [ ] **Step 3: 执行迁移（重启 MySQL）**

```bash
cd deploy && docker compose down mysql && docker compose up -d mysql
```
Wait for healthy, then verify:
```bash
docker compose exec mysql mysql -utravel -ptravel123 travel_coordinates -e "SHOW TABLES LIKE 'geo_%';"
```
Expected: `geo_suggest_cache`, `geo_reverse_cache`

- [ ] **Step 4: Commit**

```bash
git add deploy/mysql/02-geo-cache.sql deploy/docker-compose.yml
git commit -m "feat: add geo cache tables for place search & reverse geocode"
```

---

### Task 2: 后端 — Geo Handler + Service + Router

**Files:**
- Create: `go/internal/adapter/http/handler/geo_handler.go`
- Create: `go/internal/service/geo/service.go`
- Modify: `go/internal/adapter/http/router.go`
- Modify: `go/internal/bootstrap/wiring.go`

**Interfaces:**
- Consumes: `*sql.DB` (MySQL), 高德 API Key (from config)
- Produces: `GET /api/geo/suggest?q=...`, `GET /api/geo/reverse?lat=...&lng=...`

- [ ] **Step 1: 创建 GeoService（DDD 分层：handler 调 service）**

```go
// go/internal/service/geo/service.go
package geo

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type GeoService struct {
	db       *sql.DB
	amapKey  string
	client   *http.Client
}

type SuggestItem struct {
	Name    string  `json:"name"`
	Country string  `json:"country"`
	City    string  `json:"city"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
}

type ReverseResult struct {
	Country string  `json:"country"`
	City    string  `json:"city"`
	Name    string  `json:"name"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
}

func New(db *sql.DB, amapKey string) *GeoService {
	return &GeoService{
		db:      db,
		amapKey: amapKey,
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

func (s *GeoService) Suggest(ctx context.Context, keyword string) ([]SuggestItem, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if keyword == "" {
		return []SuggestItem{}, nil
	}

	// 1. 查缓存
	var cached string
	err := s.db.QueryRowContext(ctx,
		"SELECT response_json FROM geo_suggest_cache WHERE keyword = ?", keyword,
	).Scan(&cached)
	if err == nil {
		var items []SuggestItem
		if err := json.Unmarshal([]byte(cached), &items); err == nil {
			return items, nil
		}
	}

	// 2. 调高德
	items, err := s.callAmapSuggest(ctx, keyword)
	if err != nil {
		return nil, err
	}

	// 3. 写缓存
	data, _ := json.Marshal(items)
	_, _ = s.db.ExecContext(ctx,
		"INSERT INTO geo_suggest_cache (keyword, response_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE response_json = VALUES(response_json)",
		keyword, string(data),
	)

	return items, nil
}

func (s *GeoService) Reverse(ctx context.Context, lat, lng float64) (ReverseResult, error) {
	if err := ctx.Err(); err != nil {
		return ReverseResult{}, err
	}
	hash := fmt.Sprintf("%x", md5.Sum([]byte(fmt.Sprintf("%.6f,%.6f", lat, lng))))

	// 1. 查缓存
	var rr ReverseResult
	var cached string
	err := s.db.QueryRowContext(ctx,
		"SELECT response_json FROM geo_reverse_cache WHERE coord_hash = ?", hash,
	).Scan(&cached)
	if err == nil {
		if err := json.Unmarshal([]byte(cached), &rr); err == nil {
			return rr, nil
		}
	}

	// 2. 调高德
	rr, err = s.callAmapReverse(ctx, lat, lng)
	if err != nil {
		return ReverseResult{}, err
	}

	// 3. 写缓存
	data, _ := json.Marshal(rr)
	_, _ = s.db.ExecContext(ctx,
		"INSERT INTO geo_reverse_cache (coord_hash, lat, lng, country, city, name, response_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
		hash, lat, lng, rr.Country, rr.City, rr.Name, string(data),
	)

	return rr, nil
}

func (s *GeoService) callAmapSuggest(ctx context.Context, keyword string) ([]SuggestItem, error) {
	u := fmt.Sprintf("https://restapi.amap.com/v5/place/text?key=%s&keywords=%s&types=&children=1&page=1&offset=10",
		s.amapKey, url.QueryEscape(keyword))
	return s.doAmapRequest(ctx, u, func(m map[string]any) ([]SuggestItem, error) {
		pois, _ := m["pois"].([]any)
		var items []SuggestItem
		for _, p := range pois {
			poi, _ := p.(map[string]any)
			loc, _ := poi["location"].(string)
			lat, lng := 0.0, 0.0
			if len(loc) > 0 {
				fmt.Sscanf(loc, "%f,%f", &lng, &lat)
			}
			pname, _ := poi["pname"].(string) // 省
			cname, _ := poi["cityname"].(string) // 市
			if cname == "" {
				cname = pname
			}
			name, _ := poi["name"].(string)
			items = append(items, SuggestItem{
				Name: name, Country: pname, City: cname,
				Lat: lat, Lng: lng,
			})
		}
		return items, nil
	})
}

func (s *GeoService) callAmapReverse(ctx context.Context, lat, lng float64) (ReverseResult, error) {
	u := fmt.Sprintf("https://restapi.amap.com/v3/geocode/regeo?key=%s&location=%.6f,%.6f&extensions=base",
		s.amapKey, lng, lat)
	rr, err := s.doAmapRequest(ctx, u, func(m map[string]any) (ReverseResult, error) {
		regeo, _ := m["regeocode"].(map[string]any)
		addr, _ := regeo["addressComponent"].(map[string]any)
		province, _ := addr["province"].(string)
		city, _ := addr["city"].(string)
		if city == "" {
			city = province
		}
		district, _ := addr["district"].(string)
		name := district
		if name == "" {
			name = city
		}
		return ReverseResult{
			Country: province,
			City:    city,
			Name:    name,
			Lat:     lat,
			Lng:     lng,
		}, nil
	})
	return rr, err
}

func (s *GeoService) doAmapRequest(ctx context.Context, u string, parse func(map[string]any) ([]SuggestItem, error)) ([]SuggestItem, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("amap request: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("amap json: %w", err)
	}
	status, _ := result["status"].(string)
	if status != "1" {
		info, _ := result["info"].(string)
		return nil, fmt.Errorf("amap api error: %s", info)
	}
	return parse(result)
}
```

Note: 上面的 `doAmapRequest` 返回类型是 `[]SuggestItem`，反向编码需要不同的 parser。修正设计：将 `doAmapRequest` 重构为泛型 helper 或在 service 中使用不同的 方法。实际实现时用两个独立方法 `callAmapSuggest` 和 `callAmapReverse` 各自完成 HTTP 请求和解析。

- [ ] **Step 2: 创建 GeoHandler**

```go
// go/internal/adapter/http/handler/geo_handler.go
package handler

import (
	"net/http"
	"strconv"

	"travel-coordinates/go/internal/service/geo"
)

type GeoHandler struct {
	service *geo.GeoService
}

func NewGeoHandler(service *geo.GeoService) *GeoHandler {
	return &GeoHandler{service: service}
}

func (h *GeoHandler) Suggest(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusOK, map[string]any{"suggestions": []geo.SuggestItem{}})
		return
	}
	items, err := h.service.Suggest(r.Context(), q)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"suggestions": items})
}

func (h *GeoHandler) Reverse(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid lat"))
		return
	}
	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid lng"))
		return
	}
	rr, err := h.service.Reverse(r.Context(), lat, lng)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, rr)
}
```

- [ ] **Step 3: 注册路由**

编辑 `go/internal/adapter/http/router.go`:

在 `New()` 函数中，public routes 后面新增:

```go
// geo (public, for location search)
geoHandler := handler.NewGeoHandler(geoService)
mux.HandleFunc("GET /api/geo/suggest", geoHandler.Suggest)
mux.HandleFunc("GET /api/geo/reverse", geoHandler.Reverse)
```

在 `New()` 函数签名中增加 `geoService *geo.GeoService` 参数:

```go
func New(placeService *place.Service, authService *authsvc.Service, geoService *geo.GeoService, dataDir string, webDir string, jwtSecret string) *Server {
```

- [ ] **Step 4: 更新依赖注入**

编辑 `go/internal/bootstrap/wiring.go`:

在 `BuildHTTPServer` 中，于 Services 区域新增:

```go
// Geo service
geoService := geo.New(db, cfg.AmapKey)
```

在 Config 中新增字段（`config.go`）：

```go
AmapKey string
```

在 `LoadConfig` 中加载:

```go
AmapKey: envOr("AMAP_KEY", values["amap_key"]),
```

更新 `httpadapter.New(...)` 调用增加 `geoService` 参数。

- [ ] **Step 5: 编译验证**

```bash
cd go && go build ./cmd/server
```
Expected: 编译成功

- [ ] **Step 6: 测试 geo 接口**

重启 Go 后端，验证:
```bash
curl "http://localhost:8080/api/geo/suggest?q=茶卡盐湖" | jq
# Expected: { "suggestions": [...] }

curl "http://localhost:8080/api/geo/reverse?lat=36.7901&lng=99.0775" | jq
# Expected: { "country": "青海省", "city": "海西蒙古族藏族自治州", ... }
```

- [ ] **Step 7: Commit**

```bash
git add go/
git commit -m "feat: add geo suggest & reverse geocode endpoints with DB cache"
```

---

### Task 3: 前端 — 安装依赖 + 类型更新

**Files:**
- Modify: `web/package.json`
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/api.ts`

**Interfaces:**
- Produces: `GeoItem`, `MemoryCardData` 类型；`suggestPlaces()`, `reverseGeocode()` API 函数

- [ ] **Step 1: 安装新依赖**

```bash
cd web && npm install exif-js react-easy-crop browser-image-compression @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D @types/exif-js
```

- [ ] **Step 2: 更新 types.ts**

在 `web/src/lib/types.ts` 末尾追加:

```typescript
// --- geo ---

export interface GeoItem {
  name: string
  country: string
  city: string
  lat: number
  lng: number
}

export interface ReverseGeoResult {
  country: string
  city: string
  name: string
  lat: number
  lng: number
}

// --- post draft (unified form state) ---

export interface PostDraft {
  photos: PhotoDraft[]
  location: {
    name: string
    country: string
    city: string
    lat: number
    lng: number
  }
  date: string
  content: string
  tags: string[]
  visibility: 'public'
}

export interface PhotoDraft {
  id: string // temporary client-side id
  file: File
  cropData?: CropData
  isCover: boolean
  exif?: {
    lat?: number
    lng?: number
    date?: string
  }
}

export interface CropData {
  x: number
  y: number
  width: number
  height: number
}

export interface MemoryCardData {
  id: string
  type: 'post' | 'photo'
  photos: string[] // urls
  title?: string
  content?: string
  date: string
  placeName: string
}
```

- [ ] **Step 3: 更新 api.ts 增加 geo 函数**

在 `web/src/lib/api.ts` 末尾追加:

```typescript
import type { GeoItem, ReverseGeoResult } from './types'

export async function suggestPlaces(keyword: string): Promise<GeoItem[]> {
  if (!keyword.trim()) return []
  const data = await request<{ suggestions: GeoItem[] }>(`/api/geo/suggest?q=${encodeURIComponent(keyword)}`)
  return data.suggestions ?? []
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeoResult> {
  return request<ReverseGeoResult>(`/api/geo/reverse?lat=${lat}&lng=${lng}`)
}
```

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/package-lock.json web/src/lib/types.ts web/src/lib/api.ts
git commit -m "chore: add frontend deps (exif-js, crop, compress, dnd-kit) & geo types/api"
```

---

### Task 4: 前端 — LocationPicker 组件

**Files:**
- Create: `web/src/components/LocationPicker.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `suggestPlaces()`, `reverseGeocode()` from `lib/api.ts`; `GeoItem` type
- Produces: `<LocationPicker value={PostDraft['location']} onChange={fn} />` prop

- [ ] **Step 1: 创建 LocationPicker.tsx**

```tsx
// web/src/components/LocationPicker.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import type { GeoItem } from '../lib/types'
import { suggestPlaces, reverseGeocode } from '../lib/api'

interface LocationValue {
  name: string
  country: string
  city: string
  lat: number
  lng: number
}

interface Props {
  value: LocationValue
  onChange: (v: LocationValue) => void
  onOpenMapPicker?: () => void
}

export default function LocationPicker({ value, onChange, onOpenMapPicker }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeoItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const handleInput = useCallback((text: string) => {
    setQuery(text)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!text.trim()) { setSuggestions([]); setOpen(false); return }
      setLoading(true)
      try {
        const items = await suggestPlaces(text)
        setSuggestions(items)
        setOpen(items.length > 0)
      } finally { setLoading(false) }
    }, 300)
  }, [])

  const handleSelect = (item: GeoItem) => {
    onChange({
      name: item.name,
      country: item.country,
      city: item.city,
      lat: item.lat,
      lng: item.lng,
    })
    setQuery(`${item.country} · ${item.name}`)
    setOpen(false)
  }

  const handleLocate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          const rr = await reverseGeocode(latitude, longitude)
          onChange({
            name: rr.name,
            country: rr.country,
            city: rr.city,
            lat: rr.lat,
            lng: rr.lng,
          })
          setQuery(`${rr.country} · ${rr.name}`)
        } catch { /* fallback: just fill coords */ 
          onChange({
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            country: '', city: '',
            lat: latitude, lng: longitude,
          })
          setQuery(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
        }
      },
      (err) => { console.warn('geolocation error:', err.message) },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  useEffect(() => {
    if (value.name) {
      setQuery(`${value.country ? value.country + ' · ' : ''}${value.name}`)
    }
  }, [value.name, value.country])

  const displayText = query || (value.name ? `${value.country ? value.country + ' · ' : ''}${value.name}` : '选择位置')

  return (
    <div className="location-picker">
      <div className="lp-input-row">
        <input
          className="lp-search"
          type="text"
          placeholder="搜索地点..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
        <button type="button" className="lp-btn" onClick={handleLocate} title="使用当前位置">
          📍
        </button>
        {onOpenMapPicker && (
          <button type="button" className="lp-btn" onClick={onOpenMapPicker} title="地图选点">
            🗺️
          </button>
        )}
      </div>
      {open && (
        <ul className="lp-dropdown">
          {loading && <li className="lp-loading">搜索中...</li>}
          {suggestions.map((item, i) => (
            <li key={i} className="lp-item" onClick={() => handleSelect(item)}>
              <span className="lp-name">{item.name}</span>
              <span className="lp-admin">{item.country} · {item.city}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 添加 CSS**

在 `web/src/styles.css` 末尾追加:

```css
/* LocationPicker */
.location-picker { position: relative; }
.lp-input-row { display: flex; gap: 6px; align-items: center; }
.lp-search { flex: 1; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
.lp-btn { width: 40px; height: 40px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.lp-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100; max-height: 240px; overflow-y: auto; list-style: none; padding: 4px 0; margin: 4px 0; }
.lp-item { padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; }
.lp-item:hover { background: #f1f5f9; }
.lp-name { font-weight: 500; font-size: 14px; }
.lp-admin { font-size: 12px; color: #64748b; margin-top: 2px; }
.lp-loading { padding: 10px 12px; color: #94a3b8; font-size: 13px; }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/LocationPicker.tsx web/src/styles.css
git commit -m "feat: add LocationPicker with search autocomplete, GPS locate, map picker trigger"
```

---

### Task 5: 前端 — PhotoGrid 组件

**Files:**
- Create: `web/src/components/PhotoGrid.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `PhotoDraft` type; `exif-js`; `react-easy-crop`; `browser-image-compression`; `@dnd-kit/sortable`
- Produces: `<PhotoGrid photos={PhotoDraft[]} onChange={fn} max={9} />` prop

- [ ] **Step 1: 创建 PhotoGrid.tsx**

```tsx
// web/src/components/PhotoGrid.tsx
import { useCallback, useRef, useState } from 'react'
import type { PhotoDraft, CropData } from '../lib/types'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, horizontalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Cropper from 'react-easy-crop'
import imageCompression from 'browser-image-compression'

// @ts-ignore exif-js has no types
import EXIF from 'exif-js'

interface Props {
  photos: PhotoDraft[]
  onChange: (photos: PhotoDraft[]) => void
  max?: number
  onExifExtracted?: (exif: { lat?: number; lng?: number; date?: string }) => void
}

let idCounter = 0
function genId() { return `photo_${++idCounter}_${Date.now()}` }

export default function PhotoGrid({ photos, onChange, max = 9, onExifExtracted }: Props) {
  const [croppingId, setCroppingId] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cropImageRef = useRef<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const compressFile = async (file: File): Promise<File> => {
    const isMobile = window.innerWidth < 768
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: isMobile ? 1200 : 1920,
      useWebWorker: true,
      initialQuality: isMobile ? 0.85 : 0.9,
    }
    try { return await imageCompression(file, options) }
    catch { return file }
  }

  const extractExif = (file: File) => {
    // @ts-ignore
    EXIF.getData(file, function (this: any) {
      const lat = EXIF.getTag(this, 'GPSLatitude')
      const lng = EXIF.getTag(this, 'GPSLongitude')
      const date = EXIF.getTag(this, 'DateTimeOriginal')
      if (lat != null && lng != null && onExifExtracted) {
        onExifExtracted({ lat, lng, date: date ? date.replace(/:/g, '-').replace(' ', 'T') : undefined })
      } else if (date && onExifExtracted) {
        onExifExtracted({ date: date.replace(/:/g, '-').replace(' ', 'T') })
      }
    })
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const remaining = max - photos.length
    const selected = Array.from(files).slice(0, remaining)
    if (selected.length === 0) return

    const compressed = await Promise.all(selected.map(compressFile))

    const newPhotos: PhotoDraft[] = compressed.map((file) => ({
      id: genId(),
      file,
      isCover: photos.length === 0, // first photo is cover
    }))

    // extract EXIF from first photo only
    if (compressed[0] && photos.length === 0 && !newPhotos[0].exif) {
      extractExif(compressed[0])
    }

    onChange([...photos, ...newPhotos])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemove = (id: string) => {
    const updated = photos.filter((p) => p.id !== id)
    if (updated.length > 0 && photos.find((p) => p.id === id)?.isCover) {
      updated[0].isCover = true
    }
    onChange(updated)
  }

  const handleSetCover = (id: string) => {
    onChange(photos.map((p) => ({ ...p, isCover: p.id === id })))
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = photos.findIndex((p) => p.id === active.id)
    const newIdx = photos.findIndex((p) => p.id === over.id)
    onChange(arrayMove(photos, oldIdx, newIdx))
  }

  const openCrop = (id: string) => {
    const photo = photos.find((p) => p.id === id)
    if (!photo) return
    cropImageRef.current = URL.createObjectURL(photo.file)
    setCroppingId(id)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const handleCropDone = async () => {
    if (!croppedAreaPixels || !croppingId) return
    // In a full implementation, actually crop the image using canvas
    // For MVP: store crop data and apply during upload
    onChange(photos.map((p) =>
      p.id === croppingId
        ? { ...p, cropData: { x: croppedAreaPixels.x, y: croppedAreaPixels.y, width: croppedAreaPixels.width, height: croppedAreaPixels.height } }
        : p
    ))
    if (cropImageRef.current) URL.revokeObjectURL(cropImageRef.current)
    setCroppingId(null)
  }

  const croppingPhoto = photos.find((p) => p.id === croppingId)

  return (
    <div className="photo-grid">
      {croppingId && cropImageRef.current && (
        <div className="crop-overlay">
          <div className="crop-container">
            <Cropper
              image={cropImageRef.current}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, area) => setCroppedAreaPixels(area)}
            />
          </div>
          <div className="crop-actions">
            <button onClick={() => { setCroppingId(null) }}>取消</button>
            <button className="primary-btn" onClick={handleCropDone}>确认裁剪</button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          <div className="pg-list">
            {photos.map((photo) => (
              <SortablePhoto
                key={photo.id}
                photo={photo}
                onRemove={handleRemove}
                onSetCover={handleSetCover}
                onCrop={openCrop}
              />
            ))}
            {photos.length < max && (
              <button
                className="pg-add"
                onClick={() => fileInputRef.current?.click()}
              >
                ＋
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />

      {photos.length === 0 && (
        <div
          className="pg-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        >
          <span className="pg-dropzone-icon">📸</span>
          <p>点击或拖拽照片到这里</p>
          <p className="pg-hint">首张照片将成为地图上的 Pin 图</p>
        </div>
      )}
    </div>
  )
}

function SortablePhoto({ photo, onRemove, onSetCover, onCrop }: {
  photo: PhotoDraft
  onRemove: (id: string) => void
  onSetCover: (id: string) => void
  onCrop: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: photo.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const previewUrl = URL.createObjectURL(photo.file)

  return (
    <div ref={setNodeRef} style={style} className={`pg-item ${photo.isCover ? 'pg-cover' : ''}`}>
      <img src={previewUrl} alt="" className="pg-thumb" />
      <div className="pg-item-actions">
        <button type="button" className="pg-action" onClick={() => onCrop(photo.id)} title="裁剪">✂️</button>
        <button type="button" className="pg-action" onClick={() => handleSetAsCover(photo.id)} title={photo.isCover ? '已设为封面' : '设为封面'}>
          {photo.isCover ? '⭐' : '☆'}
        </button>
        <button type="button" className="pg-action pg-delete" onClick={() => onRemove(photo.id)} title="删除">✕</button>
      </div>
      <div className="pg-drag-handle" {...attributes} {...listeners}>
        ⠿
      </div>
    </div>
  )

  function handleSetAsCover(id: string) {
    if (!photo.isCover) onSetCover(id)
  }
}
```

- [ ] **Step 2: 添加 CSS**

在 `web/src/styles.css` 末尾追加:

```css
/* PhotoGrid */
.photo-grid { margin-bottom: 16px; }
.pg-list { display: flex; gap: 10px; flex-wrap: wrap; }
.pg-item { position: relative; width: 100px; height: 100px; border-radius: 10px; overflow: hidden; border: 2px solid transparent; }
.pg-cover { border-color: #2563eb; }
.pg-thumb { width: 100%; height: 100%; object-fit: cover; }
.pg-item-actions { position: absolute; bottom: 4px; left: 4px; right: 4px; display: flex; gap: 4px; justify-content: center; }
.pg-action { background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 4px; padding: 2px 6px; font-size: 12px; cursor: pointer; }
.pg-delete { background: rgba(220,38,38,0.7); }
.pg-drag-handle { position: absolute; top: 4px; right: 4px; color: #fff; font-size: 14px; cursor: grab; background: rgba(0,0,0,0.4); border-radius: 4px; padding: 0 4px; }
.pg-add { width: 100px; height: 100px; border-radius: 10px; border: 2px dashed #cbd5e1; background: #f8fafc; font-size: 28px; color: #94a3b8; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.pg-dropzone { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 40px 20px; text-align: center; cursor: pointer; background: #f8fafc; }
.pg-dropzone-icon { font-size: 48px; }
.pg-dropzone p { margin: 8px 0 0; color: #64748b; font-size: 14px; }
.pg-hint { font-size: 12px !important; color: #94a3b8 !important; }
.crop-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.8); display: flex; flex-direction: column; }
.crop-container { flex: 1; position: relative; }
.crop-actions { display: flex; justify-content: center; gap: 16px; padding: 16px; }
.crop-actions button { padding: 10px 24px; border-radius: 8px; border: none; font-size: 14px; cursor: pointer; background: rgba(255,255,255,0.2); color: #fff; }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/PhotoGrid.tsx web/src/styles.css
git commit -m "feat: add PhotoGrid with multi-upload, drag sort, crop, compress, EXIF extraction"
```

---

### Task 6: 前端 — PostContent 组件

**Files:**
- Create: `web/src/components/PostContent.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: 创建 PostContent.tsx**

```tsx
// web/src/components/PostContent.tsx
import { useState } from 'react'

interface Props {
  content: string
  onChangeContent: (v: string) => void
  date: string
  onChangeDate: (v: string) => void
  dateAutoLabel?: string // "📥 已根据照片自动填充"
}

export default function PostContent({ content, onChangeContent, date, onChangeDate, dateAutoLabel }: Props) {
  return (
    <div className="post-content">
      <div className="pc-date-row">
        <label className="pc-label">📅 旅行时间</label>
        <input
          type="date"
          className="pc-date-input"
          value={date}
          onChange={(e) => onChangeDate(e.target.value)}
        />
        {dateAutoLabel && <span className="pc-auto-hint">{dateAutoLabel}</span>}
      </div>
      <div className="pc-text-row">
        <label className="pc-label">📝 这一刻的风景</label>
        <textarea
          className="pc-textarea"
          placeholder="写下此刻的感受..."
          rows={4}
          maxLength={500}
          value={content}
          onChange={(e) => onChangeContent(e.target.value)}
        />
        <span className="pc-counter">{content.length}/500</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 添加 CSS**

```css
/* PostContent */
.post-content { display: flex; flex-direction: column; gap: 12px; }
.pc-label { font-size: 13px; font-weight: 500; color: #475569; }
.pc-date-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pc-date-input { padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
.pc-auto-hint { font-size: 12px; color: #22c55e; background: #f0fdf4; padding: 2px 8px; border-radius: 4px; }
.pc-text-row { position: relative; }
.pc-textarea { width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; resize: vertical; min-height: 100px; font-family: inherit; }
.pc-counter { position: absolute; bottom: 8px; right: 8px; font-size: 12px; color: #94a3b8; }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/PostContent.tsx web/src/styles.css
git commit -m "feat: add PostContent with date picker, textarea, EXIF auto-fill hint"
```

---

### Task 7: 前端 — UnifiedPostEditor 组件

**Files:**
- Create: `web/src/components/UnifiedPostEditor.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: PhotoGrid, LocationPicker, PostContent; `createPlace()`, `uploadPhoto()`, `createPost()` from `lib/api.ts`
- Produces: `<UnifiedPostEditor mode="create"|"append" defaultPlaceId?={string} onClose={fn} onSuccess={fn} />`

- [ ] **Step 1: 创建 UnifiedPostEditor.tsx**

```tsx
// web/src/components/UnifiedPostEditor.tsx
import { useState, useCallback } from 'react'
import PhotoGrid from './PhotoGrid'
import LocationPicker from './LocationPicker'
import PostContent from './PostContent'
import type { PhotoDraft } from '../lib/types'
import { createPlace, uploadPhoto, createPost } from '../lib/api'

interface Props {
  mode: 'create' | 'append'
  defaultPlaceId?: string
  defaultLocation?: { name: string; country: string; city: string; lat: number; lng: number }
  onClose: () => void
  onSuccess: () => void
}

type SubmitStep = 'idle' | 'creating_place' | 'uploading_photos' | 'creating_post' | 'done'

export default function UnifiedPostEditor({ mode, defaultPlaceId, defaultLocation, onClose, onSuccess }: Props) {
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [location, setLocation] = useState(
    defaultLocation ?? { name: '', country: '', city: '', lat: 30.0, lng: 120.0 }
  )
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState('')
  const [dateLabel, setDateLabel] = useState<string | undefined>()
  const [step, setStep] = useState<SubmitStep>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  const handleExif = useCallback((exif: { lat?: number; lng?: number; date?: string }) => {
    if (exif.lat != null && exif.lng != null) {
      setLocation((prev) => ({ ...prev, lat: exif.lat!, lng: exif.lng! }))
      import('../lib/api').then(({ reverseGeocode }) => {
        reverseGeocode(exif.lat!, exif.lng!).then((rr) => {
          setLocation({ name: rr.name, country: rr.country, city: rr.city, lat: rr.lat, lng: rr.lng })
        }).catch(() => {})
      })
    }
    if (exif.date) {
      setDate(exif.date.slice(0, 10))
      setDateLabel('📥 已根据照片自动填充')
    }
  }, [])

  const handleSubmit = async () => {
    if (photos.length === 0 && !content.trim()) {
      setError('请至少上传一张照片或填写文字内容')
      return
    }
    setError(null)

    try {
      // Step 1: 创建地点
      setStep('creating_place')
      const name = location.name || `${location.city || ''}·记忆`
      const place = await createPlace({
        name,
        latitude: location.lat,
        longitude: location.lng,
        country: location.country,
        city: location.city,
        travel_date: date,
        note: content,
        place_type: '',
      })

      // Step 2: 如果有照片，逐个上传
      if (photos.length > 0) {
        setStep('uploading_photos')
        setProgress({ current: 0, total: photos.length })
        for (let i = 0; i < photos.length; i++) {
          await uploadPhoto(place.id, photos[i].file)
          setProgress({ current: i + 1, total: photos.length })
        }
      }

      // Step 3: 创建帖子（如果有文字或照片）
      if (content.trim() || photos.length > 0) {
        setStep('creating_post')
        const coverPhoto = photos.find((p) => p.isCover)
        // 取最后一张上传的照片作为帖子图片
        const title = location.name || `${location.city} 旅行记忆`
        if (photos.length > 0) {
          const formData = new FormData()
          formData.append('title', title)
          formData.append('content', content || `📍 ${location.country} · ${location.city || location.name}`)
          formData.append('file', photos[0].file)
          await createPost(place.id, { title, content, file: photos[0].file })
        } else {
          await createPost(place.id, { title, content })
        }
      }

      setStep('done')
      onSuccess()
    } catch (err: any) {
      setError(err.message || '发布失败，请重试')
      setStep('idle')
      // 如果地点已创建但后续失败，回滚
      // (简化版：前端不处理回滚，后端可以后续加GC清理无帖子的空地点)
    }
  }

  const canSubmit = photos.length > 0 || content.trim().length > 0

  return (
    <div className="editor-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {isMobile ? (
        /* 移动端全屏流式 */
        <div className="editor-mobile">
          <div className="editor-mobile-header">
            <button className="ghost-btn" onClick={onClose}>← 返回</button>
            <h2>{mode === 'create' ? '记录足迹' : '添加记忆'}</h2>
            <button className="primary-btn" disabled={!canSubmit || step !== 'idle'} onClick={handleSubmit}>
              {step !== 'idle' ? '发布中...' : '发布'}
            </button>
          </div>
          <div className="editor-mobile-body">
            <PhotoGrid photos={photos} onChange={setPhotos} onExifExtracted={handleExif} />
            <PostContent
              content={content} onChangeContent={setContent}
              date={date} onChangeDate={setDate}
              dateAutoLabel={dateLabel}
            />
            <LocationPicker value={location} onChange={setLocation} />
          </div>
          {error && <div className="editor-error">{error}</div>}
          {step === 'uploading_photos' && (
            <div className="editor-progress">正在上传照片 ({progress.current}/{progress.total})</div>
          )}
        </div>
      ) : (
        /* PC 端双栏弹窗 */
        <div className="editor-desktop">
          <div className="editor-header">
            <h2>{mode === 'create' ? '✨ 记录足迹' : '📝 添加记忆'}</h2>
            <button className="ghost-btn" onClick={onClose}>✕</button>
          </div>
          <div className="editor-body">
            <div className="editor-left">
              <PhotoGrid photos={photos} onChange={setPhotos} onExifExtracted={handleExif} />
            </div>
            <div className="editor-right">
              <LocationPicker value={location} onChange={setLocation} />
              <PostContent
                content={content} onChangeContent={setContent}
                date={date} onChangeDate={setDate}
                dateAutoLabel={dateLabel}
              />
            </div>
          </div>
          <div className="editor-footer">
            {error && <span className="editor-error">{error}</span>}
            {step === 'uploading_photos' && (
              <span className="editor-progress">正在上传照片 ({progress.current}/{progress.total})</span>
            )}
            <div className="editor-footer-btns">
              <button className="ghost-btn" onClick={onClose}>取消</button>
              <button className="primary-btn" disabled={!canSubmit || step !== 'idle'} onClick={handleSubmit}>
                {step !== 'idle' ? '发布中...' : '🚀 立即发布'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 添加 CSS**

```css
/* UnifiedPostEditor */
.editor-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; }
.editor-desktop { width: 800px; max-width: 95vw; max-height: 85vh; background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; }
.editor-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f1f5f9; }
.editor-header h2 { margin: 0; font-size: 18px; }
.editor-body { display: flex; flex: 1; overflow: hidden; }
.editor-left { flex: 1; padding: 20px; overflow-y: auto; border-right: 1px solid #f1f5f9; }
.editor-right { width: 320px; padding: 20px; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
.editor-footer { padding: 12px 20px; border-top: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
.editor-footer-btns { display: flex; gap: 10px; margin-left: auto; }
.editor-error { color: #dc2626; font-size: 13px; }
.editor-progress { font-size: 13px; color: #2563eb; }

/* mobile */
.editor-mobile { width: 100%; height: 100%; background: #fff; display: flex; flex-direction: column; }
.editor-mobile-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
.editor-mobile-header h2 { margin: 0; font-size: 16px; }
.editor-mobile-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/UnifiedPostEditor.tsx web/src/styles.css
git commit -m "feat: add UnifiedPostEditor with dual-pane (PC) and fullscreen flow (mobile)"
```

---

### Task 8: 前端 — PlaceDrawer 重构 (MemoryCard + PlaceEditor)

**Files:**
- Create: `web/src/components/MemoryCard.tsx`
- Create: `web/src/components/PlaceEditor.tsx`
- Modify: `web/src/components/PlaceDrawer.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: `Place` type from `lib/types.ts`; App handlers (unchanged)
- Produces: Refactored PlaceDrawer with MemoryCard list

- [ ] **Step 1: 创建 MemoryCard.tsx**

```tsx
// web/src/components/MemoryCard.tsx
interface MemoryCardData {
  id: string
  type: 'post_with_photo' | 'post_only' | 'photo_only'
  photoUrls: string[]
  title: string
  content: string
  date: string
  placeName: string
}

interface Props {
  card: MemoryCardData
  onEdit?: () => void
  onDelete?: () => void
}

export default function MemoryCard({ card, onEdit, onDelete }: Props) {
  const [activePhoto, setActivePhoto] = useState(0)

  return (
    <div className="memory-card">
      {card.photoUrls.length > 0 && (
        <div className="mc-photos">
          <div
            className="mc-photo-main"
            style={{ backgroundImage: `url(${card.photoUrls[activePhoto]})` }}
          />
          {card.photoUrls.length > 1 && (
            <div className="mc-photo-nav">
              <button
                className="mc-nav-btn"
                onClick={() => setActivePhoto((p) => (p - 1 + card.photoUrls.length) % card.photoUrls.length)}
                disabled={card.photoUrls.length <= 1}
              >‹</button>
              <span className="mc-photo-dots">
                {card.photoUrls.map((_, i) => (
                  <span key={i} className={`mc-dot ${i === activePhoto ? 'active' : ''}`} onClick={() => setActivePhoto(i)} />
                ))}
              </span>
              <button
                className="mc-nav-btn"
                onClick={() => setActivePhoto((p) => (p + 1) % card.photoUrls.length)}
                disabled={card.photoUrls.length <= 1}
              >›</button>
            </div>
          )}
        </div>
      )}
      <div className="mc-meta">
        <div className="mc-place">📍 {card.placeName}</div>
        <div className="mc-date">📅 {card.date}</div>
        {card.content && <div className="mc-content">{card.content}</div>}
        {card.type === 'photo_only' && (
          <p className="mc-add-text-hint">💡 点击编辑为此照片补充文字</p>
        )}
      </div>
      <div className="mc-actions">
        {onEdit && <button className="mini-btn" onClick={onEdit}>编辑</button>}
        {onDelete && <button className="mini-btn mc-delete-btn" onClick={onDelete}>删除</button>}
      </div>
    </div>
  )
}

import { useState } from 'react'
```

Note: 需要将 `useState` import 移到文件顶部，`import { useState } from 'react'`。

- [ ] **Step 2: 创建 PlaceEditor.tsx**

```tsx
// web/src/components/PlaceEditor.tsx
import { useState, useEffect } from 'react'
import type { PlaceInput } from '../lib/types'
import LocationPicker from './LocationPicker'

interface Props {
  initial: PlaceInput & { lat?: number; lng?: number; country?: string; city?: string; name?: string }
  onSave: (input: PlaceInput) => void
  onCancel: () => void
}

export default function PlaceEditor({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial.name || '')
  const [note, setNote] = useState(initial.note || '')
  const [date, setDate] = useState(initial.travel_date || '')
  const [placeType, setPlaceType] = useState(initial.place_type || '')
  const [location, setLocation] = useState({
    name: (initial as any).name || name,
    country: (initial as any).country || '',
    city: (initial as any).city || '',
    lat: (initial as any).lat || initial.latitude || 30,
    lng: (initial as any).lng || initial.longitude || 120,
  })

  const handleSave = () => {
    onSave({
      name,
      note,
      travel_date: date,
      place_type: placeType,
      country: location.country,
      city: location.city,
      latitude: location.lat,
      longitude: location.lng,
    })
  }

  return (
    <div className="place-editor">
      <div className="pe-field">
        <label>地点名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：茶卡盐湖" />
      </div>
      <div className="pe-field">
        <label>位置</label>
        <LocationPicker value={location} onChange={setLocation} />
      </div>
      <div className="pe-field">
        <label>旅行日期</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="pe-field">
        <label>类型</label>
        <input value={placeType} onChange={(e) => setPlaceType(e.target.value)} placeholder="例如：自然风光" />
      </div>
      <div className="pe-field">
        <label>备注</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </div>
      <div className="pe-actions">
        <button className="ghost-btn" onClick={onCancel}>取消</button>
        <button className="primary-btn" onClick={handleSave}>保存</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 重构 PlaceDrawer.tsx**

将现有的 PlaceDrawer 替换为 MemoryCard 列表布局。核心改动：

- 删除独立的「上传照片」、「创建帖子」区块
- 顶部显示地点基本信息（name, country, city）
- 中间为 MemoryCard 列表（根据 place.photos + place.posts 归组生成）
- 底部两个按钮：「+ 添加记忆」（打开 UnifiedPostEditor append 模式）、「编辑地点」（打开 PlaceEditor）
- 保留删除地点功能

*完整代码从现有 PlaceDrawer 改造，保持 handler 接口不变 (onUpdatePlace, onUploadPhoto, onDeletePhoto, onCreatePost, onDeletePost, onDeletePlace)*

- [ ] **Step 4: 添加 CSS**

MemoryCard + PlaceEditor 所需的额外 CSS。

- [ ] **Step 5: Commit**

```bash
git add web/src/components/MemoryCard.tsx web/src/components/PlaceEditor.tsx web/src/components/PlaceDrawer.tsx web/src/styles.css
git commit -m "refactor: PlaceDrawer → MemoryCard list + PlaceEditor, unify post+photo display"
```

---

### Task 9: 前端 — Globe 地图增强 + 全局修正

**Files:**
- Modify: `web/src/components/Globe.tsx`
- Modify: `web/src/lib/auth.ts`
- Modify: `web/src/components/App.tsx` → (new integration in App.tsx handled in Task 10)
- Modify: `web/src/styles.css`

- [ ] **Step 1: Globe 增加地图点击选点**

在 `Globe.tsx` 中:

```tsx
// 在 useEffect 地图初始化后，增加 click 事件监听
map.on('click', (e: any) => {
  const { lng, lat } = e.lnglat
  // 移除旧的临时 marker
  if (tempMarkerRef.current) {
    map.remove(tempMarkerRef.current)
  }
  // 放置临时 marker
  const marker = new AMap.Marker({
    position: [lng, lat],
    anchor: 'center',
    content: `<div class="temp-pin"></div>`,
  })
  map.add(marker)
  tempMarkerRef.current = marker

  // 通知 App 打开编辑器
  if (props.onMapClick) {
    props.onMapClick({ lat, lng })
  }
})
```

新增 prop: `onMapClick?: (pos: { lat: number; lng: number }) => void`

- [ ] **Step 2: 修复移动端定位**

确保定位按钮始终在用户手势中直接调用（非 setTimeout/async 包装）：
```tsx
const handleLocate = () => {
  // 必须直接在事件处理中调用
  navigator.geolocation.getCurrentPosition(
    (pos) => { /* ... */ },
    (err) => { console.warn('定位失败:', err.message) },
    { enableHighAccuracy: true, timeout: 15000 }
  )
}
```

- [ ] **Step 3: 移除 window.fetch 覆盖**

编辑 `web/src/lib/auth.ts`:

删除或注释掉:
```typescript
// 移除：window.fetch 的全局覆盖
// const _fetch = window.fetch
// window.fetch = function(...) { ... }
```

确保 `api.ts` 的 `request()` 独自处理 Authorization 注入。

- [ ] **Step 4: Pin 图样式移到 CSS**

将 Globe 中 `buildPinHTML` 的内联样式抽取到 `styles.css`:

```css
/* Globe markers */
.custom-pin { width: 40px; height: 40px; border-radius: 50%; background-size: cover; background-position: center; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer; }
.custom-pin.active { border-color: #2563eb; transform: scale(1.1); box-shadow: 0 0 0 4px rgba(37,99,235,0.3); }
.temp-pin { width: 24px; height: 24px; border-radius: 50%; background: #2563eb; border: 3px solid #fff; box-shadow: 0 0 0 6px rgba(37,99,235,0.2); animation: pin-pulse 1.5s ease-in-out infinite; }
@keyframes pin-pulse { 0%, 100% { box-shadow: 0 0 0 6px rgba(37,99,235,0.2); } 50% { box-shadow: 0 0 0 14px rgba(37,99,235,0); } }
```

- [ ] **Step 5: 类型清理**

编辑 `web/src/lib/types.ts`:
- `Post.photo_id` → `string | null`
- 移除 PlaceDrawer 中重复定义的 `PlaceDraft`（确保 PlaceDrawer 重构后已不再使用）

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Globe.tsx web/src/lib/auth.ts web/src/styles.css web/src/lib/types.ts
git commit -m "fix: Globe map click pin, fix mobile geolocation, remove window.fetch override, extract CSS"
```

---

### Task 10: 前端 — App.tsx 集成

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: 替换 PlaceForm 为 UnifiedPostEditor**

在 `App.tsx` 中:
- 移除 `import PlaceForm`，添加 `import UnifiedPostEditor`
- 移除 `panel === "add"` 时的 PlaceForm 渲染
- 新增 `editorMode` 状态: `const [editorMode, setEditorMode] = useState<'create' | 'append' | null>(null)`
- 当 `editorMode === 'create'` 时渲染 `<UnifiedPostEditor mode="create" />`
- 当 `editorMode === 'append'` 时渲染 `<UnifiedPostEditor mode="append" defaultPlaceId={selectedPlaceId} defaultLocation={...} />`
- FAB 按钮点击 → `setEditorMode('create')`
- 地图点击选点回调 → 填入默认坐标 → `setEditorMode('create')`

- [ ] **Step 2: 整合 MemoryCard PlaceDrawer**

- PlaceDrawer 的 `onCreatePost` 改为打开 `UnifiedPostEditor mode="append"`
- 删除 App 中不再需要的 `handleUploadPhoto`、`handleCreatePost` props（如果它们现在由 UnifiedPostEditor 内部处理）
- 保留 PlaceDrawer 所需的 `onUpdatePlace`, `onDeletePhoto`, `onDeletePost`, `onDeletePlace`（编辑/删除场景仍需）

- [ ] **Step 3: 更新 SearchBar**

SearchBar 增加城市筛选提示（可选小改进）：
- placeholder 改为 "搜索足迹、地点..."

- [ ] **Step 4: 端到端验证**

启动完整环境:
```bash
cd deploy && docker compose up -d  # 确保 MySQL/Redis 运行
cd go && go run ./cmd/server        # 后端
cd web && npm run dev               # 前端开发模式
```

手动验证:
1. PC 端打开 http://localhost:5173 → 点击 FAB → 看到双栏弹窗
2. 上传照片 → EXIF 自动填充日期/位置
3. 搜索地点 → 下拉选择
4. 地图点击 → 弹出填好坐标的编辑器
5. 发布 → 地点创建 + 图片上传 + 帖子创建全部完成
6. 移动端打开 → 全屏布局 → 定位按钮可用
7. 打开已有地点 → PlaceDrawer 以 MemoryCard 列表展示

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/components/SearchBar.tsx
git commit -m "feat: integrate UnifiedPostEditor, map click, MemoryCard PlaceDrawer"
```

---

### Task 11: 后端 — go test 全部通过 + 清理

- [ ] **Step 1: 运行测试**

```bash
cd go && go test ./... -count=1 2>&1
```

如有失败，根据错误信息修复（新 geo service 可能引入未使用的 import 或类型不匹配）。

- [ ] **Step 2: 构建验证**

```bash
cd go && go build ./cmd/server
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: ensure all tests pass after geo endpoint addition"
```

---

### Task 12: 最终 — 构建验证 + README 更新

- [ ] **Step 1: 前端构建**

```bash
cd web && npm run build 2>&1
```

确保无 TypeScript 错误。

- [ ] **Step 2: 更新 README**

如 README.md 中启动流程或配置有变化，同步更新。

- [ ] **Step 3: 最终提交**

```bash
git add -A && git commit -m "chore: final build verification & docs update"
```
