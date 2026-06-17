# Travel Coordinates MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working MVP for recording travel locations on an interactive globe, with location details, photos, and posts backed by a Go API.

**Architecture:** Build a small frontend app in `web/` and a Go HTTP API in `api/`. The API owns all persistence through JSON files on disk plus an upload directory for images, while the frontend renders the globe, location list/detail panels, and CRUD forms. Authentication is stubbed with a fixed `user_id=0001` so the data model already supports users without blocking the MVP.

**Tech Stack:** React, TypeScript, Vite, Go 1.26, standard library HTTP server, local filesystem storage, PNG/JPEG uploads, basic CSS modules.

---

### Task 1: Create repository skeleton

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `api/go.mod`
- Create: `api/cmd/server/main.go`
- Create: `api/internal/http/server.go`
- Create: `api/internal/store/store.go`
- Create: `api/internal/store/models.go`

- [ ] **Step 1: Create the minimal project files**

```json
{
  "name": "travel-coordinates-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

- [ ] **Step 2: Run the app skeleton build**

Run: `cd web && npm run build`
Expected: FAIL until dependencies and source files exist.

- [ ] **Step 3: Add the Go module and starter server**

```go
package main

import "travel-coordinates/api/internal/http"

func main() {
	http.Run()
}
```

- [ ] **Step 4: Verify the Go server compiles**

Run: `cd api && go build ./...`
Expected: PASS once the starter server and store packages exist.

- [ ] **Step 5: Commit the skeleton**

```bash
git add web api docs/superpowers/plans/2026-06-17-travel-coordinates-mvp.md
git commit -m "chore: add travel coordinates project skeleton"
```

### Task 2: Implement filesystem-backed travel data store

**Files:**
- Create: `api/internal/store/store_test.go`
- Modify: `api/internal/store/store.go`
- Modify: `api/internal/store/models.go`

- [ ] **Step 1: Write failing tests for CRUD and upload bookkeeping**

```go
func TestCreatePlacePersistsAndLoads(t *testing.T) {
	// create store, save a place, reopen store, verify it round-trips
}
```

- [ ] **Step 2: Run the store tests**

Run: `cd api && go test ./internal/store -v`
Expected: FAIL until persistence is implemented.

- [ ] **Step 3: Implement JSON persistence and upload metadata**

```go
type Place struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Photos    []Photo   `json:"photos"`
	Posts     []Post    `json:"posts"`
}
```

- [ ] **Step 4: Run the store tests again**

Run: `cd api && go test ./internal/store -v`
Expected: PASS.

- [ ] **Step 5: Commit the store**

```bash
git add api/internal/store
git commit -m "feat: add filesystem travel store"
```

### Task 3: Expose Go HTTP API for places, photos, and posts

**Files:**
- Create: `api/internal/http/handlers.go`
- Modify: `api/internal/http/server.go`
- Create: `api/internal/http/server_test.go`

- [ ] **Step 1: Write handler tests for place creation and nested uploads**

```go
func TestPostPlaceCreatesPlace(t *testing.T) {
	// POST /api/places with JSON body returns 201 and persisted place
}
```

- [ ] **Step 2: Run the API tests**

Run: `cd api && go test ./internal/http -v`
Expected: FAIL until routing and handlers exist.

- [ ] **Step 3: Implement API routes**

```go
http.HandleFunc("POST /api/places", createPlaceHandler)
http.HandleFunc("GET /api/places", listPlacesHandler)
http.HandleFunc("GET /api/places/{id}", getPlaceHandler)
http.HandleFunc("PUT /api/places/{id}", updatePlaceHandler)
http.HandleFunc("DELETE /api/places/{id}", deletePlaceHandler)
http.HandleFunc("POST /api/places/{id}/photos", uploadPhotoHandler)
http.HandleFunc("DELETE /api/places/{id}/photos/{photoId}", deletePhotoHandler)
http.HandleFunc("POST /api/places/{id}/posts", createPostHandler)
http.HandleFunc("DELETE /api/places/{id}/posts/{postId}", deletePostHandler)
```

- [ ] **Step 4: Run the API tests again**

Run: `cd api && go test ./internal/http -v`
Expected: PASS.

- [ ] **Step 5: Commit the API**

```bash
git add api/internal/http
git commit -m "feat: add travel api endpoints"
```

### Task 4: Build the globe UI and location detail flow

**Files:**
- Create: `web/src/components/Globe.tsx`
- Create: `web/src/components/PlaceDrawer.tsx`
- Create: `web/src/lib/api.ts`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write a frontend interaction test or smoke check**

```ts
// app renders a globe shell and selected place drawer with mock data
```

- [ ] **Step 2: Run the frontend build**

Run: `cd web && npm run build`
Expected: FAIL until components exist and dependencies are installed.

- [ ] **Step 3: Implement the globe shell and detail panel**

```tsx
export function Globe({ places, onSelectPlace }: Props) {
  return <div className="globe-shell" />
}
```

- [ ] **Step 4: Run the frontend build again**

Run: `cd web && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit the frontend shell**

```bash
git add web/src
git commit -m "feat: add globe ui shell"
```

### Task 5: Wire frontend to API and verify end-to-end flow

**Files:**
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/App.tsx`
- Create: `web/src/components/PlaceForm.tsx`
- Create: `web/src/components/UploadDropzone.tsx`

- [ ] **Step 1: Write the end-to-end smoke path**

```ts
// create place -> upload photo -> create post -> reload -> detail panel shows content
```

- [ ] **Step 2: Run the backend and frontend together**

Run: `cd api && go test ./... && go run ./cmd/server`
Expected: API listens on localhost and serves place data.

- [ ] **Step 3: Connect create/edit/delete actions**

```ts
await api.createPlace({ userId: "0001", name, latitude, longitude })
```

- [ ] **Step 4: Verify the full flow manually**

Run: `cd web && npm run build`
Expected: PASS, then open the app and confirm place CRUD plus uploads work against the API.

- [ ] **Step 5: Commit the integration**

```bash
git add web api
git commit -m "feat: wire travel coordinates mvp end to end"
```

### Task 6: Polish startup docs and run final verification

**Files:**
- Create: `README.md`
- Modify: `api/internal/http/server_test.go`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Document local startup commands**

```md
## Run locally

1. `cd api && go run ./cmd/server`
2. `cd web && npm run dev`
```

- [ ] **Step 2: Run the final checks**

Run:
`cd api && go test ./...`
`cd web && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit the finished MVP**

```bash
git add README.md web api
git commit -m "docs: finish travel coordinates mvp"
```
