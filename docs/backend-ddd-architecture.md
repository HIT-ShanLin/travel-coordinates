# Travel Coordinates Backend Architecture

## 1. Goal

This document defines the backend project layout, layer responsibilities, and dependency rules for the Go backend.

The backend is a DDD-style monolith. HTTP is the short-term transport. gRPC is a long-term transport target. Business code must stay independent from both.

## 2. Root Layout

The repository root uses four first-level directories:

```text
travel-coordinates/
  api/    # OpenAPI and proto contracts
  go/     # Go backend project
  docs/   # product and architecture docs
  web/    # frontend project
```

Rules:

- `api/` contains interface contracts only.
- `go/` contains all backend Go code and backend runtime config.
- `docs/` contains documentation only.
- `web/` contains frontend code only.

## 3. Contract Layout

`api/` owns external API contracts.

```text
api/
  openapi.yaml
  proto/
    place/
      v1/
        place.proto
```

Rules:

- OpenAPI describes the HTTP contract.
- Proto describes the future gRPC contract.
- No Go implementation code belongs in `api/`.
- No business logic belongs in `api/`.

## 4. Go Project Layout

`go/` is the Go module root.

```text
go/
  cmd/
    server/
      main.go

  internal/
    adapter/
      http/
        handler/
        dto/
        router.go
      grpc/
        place/
          server.go
      storage/
        local/
          storage.go
        r2/
          storage.go

    domain/
      place/
        entity.go
        errors.go
        rules.go

    repo/
      place/
        repository.go
        filesystem_repository.go

    service/
      place/
        service.go
        dto.go
        commands.go
        queries.go

    bootstrap/
      config.go
      wiring.go

  pkg/
    logger/
      logger.go

  api/
    openapi.yaml
    proto/

  configs/
    config.yaml

  deployments/
    docker-compose.yaml

  scripts/
    build.sh

  go.mod
  go.sum
  README.md
```

Note: root-level `api/` is the source of API contracts. The optional `go/api/` directory is only for generated or Go-project-local contract artifacts if the team later needs it. Source contracts should stay in root-level `api/`.

## 5. Layer Responsibilities

### 5.1 `cmd`

`cmd/server/main.go` is the executable entry point.

Allowed:

- Call bootstrap wiring.
- Start the server.
- Exit on startup errors.

Forbidden:

- No business logic.
- No route definitions.
- No repository or object storage logic.

### 5.2 `configs`

`configs/` contains backend configuration files.

Allowed:

- `config.yaml`
- Environment-specific config templates if needed.

Forbidden:

- No Go code.
- No secrets committed to git.
- No scattered runtime config under random packages.

### 5.3 `bootstrap`

`bootstrap` is the dependency assembly layer.

`config.go`:

- Reads `configs/config.yaml`.
- Applies environment variable overrides.
- Validates startup configuration.

`wiring.go`:

- Creates repository implementations.
- Creates storage adapters.
- Creates services.
- Creates HTTP or gRPC handlers.
- Connects all dependencies.

Rules:

- `bootstrap` may import concrete packages from all layers.
- `bootstrap` must not contain business rules.
- Dependency injection tools such as `wire` may generate code here later, but they are optional.

### 5.4 `domain`

`domain` contains business concepts and rules.

For the MVP, `place` is the main domain.

Allowed:

- Entities and aggregate behavior.
- Value objects.
- Domain errors.
- Domain validation and invariants.

Forbidden:

- No HTTP or gRPC code.
- No OpenAPI or proto generated types.
- No filesystem, database, R2, or third-party SDK calls.
- No direct calls to `repo`, `adapter`, or `service`.

### 5.5 `service`

`service` contains business use cases.

Examples:

- Create place.
- Update place.
- Delete place.
- Upload photo.
- Delete photo.
- Publish post.
- Delete post.

Allowed:

- Call `domain` to enforce business behavior.
- Call `repo` interfaces for persistence.
- Call storage interfaces for media operations.
- Coordinate use-case workflows.

Forbidden:

- No HTTP request parsing.
- No gRPC request parsing.
- No direct R2 SDK calls.
- No raw filesystem persistence details.

### 5.6 `repo`

`repo` contains persistence contracts and persistence implementations.

Allowed:

- Repository interfaces.
- Filesystem repository implementation.
- Future SQLite, PostgreSQL, or other persistence implementations.
- Conversion between persistence records and domain models.

Forbidden:

- No HTTP or gRPC handling.
- No business orchestration.
- No object storage SDK logic unless it is persistence-specific and explicitly approved.

### 5.7 `adapter`

`adapter` contains external interface adapters.

`adapter/http`:

- Parses HTTP requests.
- Converts HTTP DTOs to service commands.
- Converts service results to HTTP responses.
- Registers HTTP routes.

`adapter/grpc`:

- Converts proto requests to service commands.
- Converts service results to proto responses.
- Exposes gRPC servers.

`adapter/storage`:

- Adapts object storage providers.
- Implements local media storage.
- Implements Cloudflare R2 media storage.

Rules:

- Adapters may call `service`.
- Adapters must not contain business rules.
- Adapters must not bypass `service` to call `repo` directly.

### 5.8 `pkg`

`pkg/` contains reusable backend utilities that are not domain-specific.

Allowed:

- Logger.
- Generic error helpers.
- Generic config helpers if needed.

Forbidden:

- No travel-coordinate business logic.
- No dependency on `internal/service`, `internal/domain`, `internal/repo`, or `internal/adapter`.

## 6. Dependency Direction

The main call direction is:

```text
adapter -> service -> domain
adapter -> service -> repo interface
service -> repo interface
repo implementation -> domain
bootstrap -> all concrete implementations
```

For media operations:

```text
adapter/http
  -> service
  -> domain
  -> repo
  -> adapter/storage interface
  -> adapter/storage/local or adapter/storage/r2
```

Important rule:

- `domain` does not call `repo` or `adapter`.
- `service` coordinates calls to `domain`, `repo`, and storage.
- `adapter` converts protocols and delegates to `service`.
- `repo` persists and restores domain state.

## 7. Allowed Calls

Allowed dependencies:

- `cmd` may call `bootstrap`.
- `bootstrap` may call all layers to assemble the runtime graph.
- `adapter/http` may call `service`.
- `adapter/grpc` may call `service`.
- `service` may call `domain`.
- `service` may call `repo` interfaces.
- `service` may call storage interfaces.
- `repo` implementations may import `domain` models.

## 8. Forbidden Calls

Forbidden dependencies:

- `domain -> service`
- `domain -> repo`
- `domain -> adapter`
- `domain -> bootstrap`
- `service -> adapter/http`
- `service -> adapter/grpc`
- `handler -> repo`
- `handler -> storage`
- `repo -> service`
- `repo -> handler`
- `pkg -> internal`

These rules prevent circular dependencies and keep the business core independent from transport and infrastructure choices.

## 9. Example Flows

Create place:

```text
HTTP POST /places
  -> adapter/http/handler
  -> service/place.CreatePlace
  -> domain/place.NewPlace
  -> repo/place.Repository.Save
```

Upload photo:

```text
HTTP POST /places/{id}/photos
  -> adapter/http/handler
  -> service/place.UploadPhoto
  -> repo/place.Repository.FindByID
  -> adapter/storage.Storage.Save
  -> domain/place.Place.AddPhoto
  -> repo/place.Repository.Save
```

Future gRPC create place:

```text
gRPC PlaceService.CreatePlace
  -> adapter/grpc/place.Server
  -> service/place.CreatePlace
  -> domain/place.NewPlace
  -> repo/place.Repository.Save
```

## 10. Cycle Prevention

Use these rules when adding new code:

- Put business rules in `domain`.
- Put use-case orchestration in `service`.
- Put persistence access in `repo`.
- Put protocol conversion in `adapter`.
- Put dependency creation in `bootstrap`.
- Keep DTOs separate from domain entities.
- Do not import outward from `domain`.
- Do not let handlers skip `service`.

## 11. Refactor Order

When migrating the current backend into this structure:

1. Create the new `go/` skeleton.
2. Move configuration into `go/configs/config.yaml`.
3. Move domain models and rules into `internal/domain`.
4. Move use cases into `internal/service`.
5. Move persistence into `internal/repo`.
6. Move HTTP handling into `internal/adapter/http`.
7. Move local and R2 media logic into `internal/adapter/storage`.
8. Add root-level `api/openapi.yaml` and `api/proto`.
9. Keep tests passing after each migration slice.
