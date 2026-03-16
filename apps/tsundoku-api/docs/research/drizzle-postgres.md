# Drizzle + PostgreSQL

- Latest stable:
  - `drizzle-orm@0.45.1`
  - `drizzle-kit@0.31.9`
  - `postgres@3.4.8`

## Recommended defaults
- Keep schema in TypeScript (`src/db/schema/*`)
- Generate SQL migrations with `drizzle-kit`
- Use singleton DB client and explicit transaction boundaries
- Pin exact versions during parity phase

## Pitfalls
- Rewriting applied migrations -> never edit applied migration files
- Per-request DB clients -> connection exhaustion
- Missing transactions for multi-write flows -> partial commit bugs

## Sources
- https://orm.drizzle.team/docs/get-started/postgresql-new
- https://orm.drizzle.team/docs/migrations
- https://orm.drizzle.team/docs/transactions
- https://github.com/drizzle-team/drizzle-orm/releases
- https://github.com/porsager/postgres
