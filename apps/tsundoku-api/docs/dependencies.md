# Dependency Baseline (Phase 1)

This backend follows a minimal-dependencies-first policy.

## Runtime and Core

| Package | Version | Why |
| --- | --- | --- |
| bun | 1.3.10 | Runtime and package manager baseline for Bun workspace |
| hono | 4.12.7 | HTTP framework and routing |
| zod | 4.3.6 | Runtime schema validation |

## Data Layer

| Package | Version | Why |
| --- | --- | --- |
| drizzle-orm | 0.45.1 | SQL-first ORM layer with TypeScript safety |
| drizzle-kit | 0.31.9 | Schema diff and migration tooling |
| postgres | 3.4.8 | PostgreSQL driver for Drizzle in Bun |

## Security and Observability

| Package | Version | Why |
| --- | --- | --- |
| jose | 6.2.1 | JWT/OIDC/JWKS verification primitives |
| pino | 10.3.1 | Structured JSON logs |

## Testing

| Package | Version | Why |
| --- | --- | --- |
| vitest | 4.1.0 | Unit/integration test runner |
| typescript | 5.9.3 | Typechecking and editor tooling |

## Update policy

- Pin exact versions (`x.y.z`) during migration and parity work.
- Avoid canary/beta releases in phase 1.
- Upgrade in small batches after parity suite is in place.
- Prefer Bun or Hono built-ins before adding new dependencies.
