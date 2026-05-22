> [!WARNING]
> This application is in early-stage development after a stack rewrite. DO NOT USE in production.

## Tsundoku

A fork and rewrite of [Booklore](https://github.com/booklore-app/booklore) on a new stack.

The original Booklore (Gradle / Spring Boot / Angular / MariaDB) lives on the `develop` branch and upstream. This branch is the from-scratch rebuild on:

- **Runtime / package manager:** [Bun](https://bun.sh)
- **API:** [Hono](https://hono.dev)
- **Web:** [SvelteKit](https://svelte.dev) + [Tailwind v4](https://tailwindcss.com)
- **Database:** Postgres + [Drizzle ORM](https://orm.drizzle.team)
- **Monorepo:** [Turborepo](https://turbo.build/repo)

### Layout

```
apps/
  api/        Hono API on Bun (port 6060)
  web/        SvelteKit + Vite + Tailwind v4 (port 5173)
packages/
  shared/     Zod schemas shared by api + web
  db/         Drizzle ORM schema, migrations, client
```

### Getting started

```bash
# Postgres on :5433 — pick one:
docker compose -f compose.dev.yaml up -d         # Docker
podman play kube dev.pod.yaml                    # Podman
#   podman play kube --down dev.pod.yaml         # ...to stop

cp .env.example .env                             # fill in JWT_SECRET, DATABASE_URL
bun install
bun run dev                                      # turbo runs both apps
```

Then open http://localhost:5173.

### Status

The rewrite is structurally complete (auth, libraries, books, shelves, metadata,
readers stream-only, settings, dashboard, stats, scan/upload, OPDS, KOReader sync,
WS event bus, cron). File-format metadata extractors (PDF / EPUB / audiobook /
comic), the full PDF/EPUB reader UIs, and the Kobo sync protocol are not yet
ported — see commit history on this branch for the staged work.
