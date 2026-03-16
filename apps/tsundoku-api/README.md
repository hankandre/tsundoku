# booklore-api-bun

Bun + Hono backend scaffold for the Booklore Java-to-Bun migration.

## Quick start

```bash
bun install
bun run dev
```

The service runs on `BOOKLORE_PORT` (default `6060`).

## Scripts

- `bun run dev` - start server with file watch
- `bun run test` - run Vitest suite
- `bun run inventory` - generate API endpoint inventory from Java controllers
- `bun run db:generate` - generate Drizzle migration files
- `bun run db:migrate` - apply Drizzle migrations

## Notes

- This package is phase-1 scaffold only. It currently implements healthcheck + shared middleware primitives.
- Contract parity endpoints are generated incrementally from `booklore-api`.
