# Contributing to Tsundoku

Tsundoku is a fork of [Booklore](https://github.com/booklore-app/booklore) being
rebuilt on a new stack. Until the rebuild reaches feature parity, contribution
priority is on porting Booklore behaviour rather than new features.

## Tech stack

- **Runtime + package manager:** Bun 1.3+
- **Monorepo:** Turborepo
- **API:** Hono 4 on Bun, Drizzle ORM, Postgres
- **Web:** SvelteKit 2 + Svelte 5 (runes), Vite 7, Tailwind v4, shadcn-svelte
- **Validation:** Zod 4, shared schemas in `packages/shared`
- **Auth:** jose (JWT) + openid-client (OIDC)
- **i18n:** svelte-i18n

## Setup

```bash
# Postgres (Docker)
docker compose -f compose.dev.yaml up -d

# Env
cp .env.example .env
# Edit DATABASE_URL + JWT_SECRET

# Install + run
bun install
bun run dev          # turbo runs api (6060) and web (5173)
```

## Common commands

```bash
bun run check        # typecheck every workspace
bun run build        # production build
bun run lint         # placeholder
bun --filter '@tsundoku/db' run db:generate   # create migration SQL from schema
bun --filter '@tsundoku/db' run db:push       # apply schema to DB without migration
```

## Conventions

- New API routes go under `apps/api/src/routes/` and mount in `apps/api/src/app.ts`.
- Persistence logic goes in `apps/api/src/services/`; routes stay thin.
- Drizzle schema lives in `packages/db/src/schema/`; one file per domain group.
- Web pages use SvelteKit conventions: `+page.server.ts` for loaders / actions,
  `+page.svelte` for rendering. Use server `load` over client `onMount` fetches.
- Cross-cutting types live in `packages/shared/src/schemas/` as Zod schemas; the
  inferred TS type is the source of truth for both api and web.
- Match the original Booklore URL contract (`/api/v1/...`) so existing mobile
  apps, OPDS readers, and KOReader/Kobo devices keep working.

## Reporting bugs

Open an issue with a runnable reproduction.
