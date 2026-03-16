# Progress Against Migration Plan

Reference plan: `.opencode/plans/1773410945896-neon-sailor.md`

## Overall Status

- Migration scaffold is in place and running under Bun.
- Hono-native app composition is established (route modules + middleware + mounted sub-apps).
- Initial auth/version/health domains are implemented.
- Full API parity, protocol integrations, tasks, websockets, and infra cutover are still pending.

## Plan Tracking

### 0) Dependency Research and Lock-In

Status: **Completed**

- Added pinned dependency baseline: `booklore-api-bun/docs/dependencies.md`
- Workspace + lockfile established: `package.json`, `bun.lock`
- Minimal-deps-first approach applied (removed unused packages where possible)

### 0.5) Deep API/Docs Research Stage

Status: **Completed**

- Deep research executed and captured in `booklore-api-bun/docs/research/`
- Research notes added for Bun, Hono, Drizzle/Postgres, JOSE, Zod/OpenAPI, Vitest

### 1) Contract Freeze and Inventory

Status: **In Progress**

- Endpoint inventory automation added: `booklore-api-bun/scripts/generate-endpoint-inventory.ts`
- Generated inventory currently records 360 endpoints: `booklore-api-bun/docs/contracts/endpoint-inventory.md`
- Remaining:
  - golden request/response fixtures from Java runtime
  - route-by-route auth/response contract matrix

### 2) Scaffold Bun + Hono Project

Status: **Completed**

- Bun backend package created: `booklore-api-bun/`
- App bootstrap and composition implemented: `booklore-api-bun/src/index.ts`, `booklore-api-bun/src/app.ts`
- Core middleware in place (request context, logging, CORS, auth)
- Base DB wiring and schema starter in place (Drizzle + Postgres client)
- Test/build/typecheck pipeline works for the new package

### 3) Data and Persistence Parity (Drizzle + PostgreSQL)

Status: **In Progress**

- Postgres connection + Drizzle integration scaffolded: `booklore-api-bun/src/db/client.ts`
- Initial schema placeholder exists: `booklore-api-bun/src/db/schema/users.ts`
- Auth persistence paths implemented directly against existing tables (`users`, `user_permissions`, `refresh_token`)
- Remaining:
  - complete Drizzle schema baseline for production entities
  - migration strategy and generated migrations under `booklore-api-bun/drizzle/`
  - full repository parity and transaction coverage

### 4) Security and Session/Auth Parity

Status: **In Progress**

- Route-level auth middleware added with public path handling, JWT path protection, OPDS/Komga basic auth gates, media token handling: `booklore-api-bun/src/middleware/auth-middleware.ts`
- JWT issue/verify implemented with `jose`: `booklore-api-bun/src/auth/jwt.ts`
- Auth endpoints implemented:
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `GET /api/v1/auth/remote`
  - `POST /api/v1/auth/register` (now implemented)
- Remaining:
  - full parity with Java rate-limits, audit semantics, OIDC-only mode behavior
  - KOReader/Kobo-specific auth flow parity
  - OIDC callback/session/logout endpoints and behavior

### 5) Route-by-Route Domain Implementation

Status: **In Progress (Early)**

- Implemented route groups:
  - healthcheck: `booklore-api-bun/src/routes/healthcheck.ts`
  - version: `booklore-api-bun/src/routes/version.ts`
  - auth: `booklore-api-bun/src/routes/auth.ts`
  - setup: `booklore-api-bun/src/routes/setup.ts`
- Remaining: majority of domains (book/media, metadata, user management, OPDS/Kobo/KOReader/Komga, task APIs, etc.)

### 6) Background Tasks and Scheduling

Status: **Not Started**

- No Bun task scheduler/worker parity implementation yet.

### 7) WebSocket/Eventing Parity

Status: **Not Started**

- No `/ws` Bun implementation yet.

### 8) Build, Container, and CI Cutover

Status: **Not Started**

- Docker/compose/CI still target the Java backend for production workflows.
- Bun workspace exists, but no infra cutover has been applied yet.

## Verification Progress

- `bun run test` in `booklore-api-bun` passes.
- `bunx tsc --noEmit` in `booklore-api-bun` passes.
- `bun run build` in `booklore-api-bun` passes.
- End-to-end parity suite against Java golden fixtures: **not yet implemented**.

## Immediate Next Steps

1. Finish auth parity details (rate limiting, audit hooks, OIDC-related behavior).
2. Migrate `UserController`/setup-related flows next to unblock admin and provisioning workflows.
3. Build golden fixture parity harness and start endpoint-by-endpoint parity tracking.
