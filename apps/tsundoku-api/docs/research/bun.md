# Bun

- Latest stable: `1.3.10` (verified via `bun pm view` and Bun releases)
- Baseline: use `Bun.serve`, centralized env parsing, and graceful shutdown hooks

## Recommended defaults
- Runtime pinning in CI/container images
- `Bun.serve({ port, fetch: app.fetch })`
- `Bun.password` (Argon2id) for password hashing
- Disable implicit `.env` loading in production when secrets come from platform env

## Pitfalls
- CPU-heavy sync work in request path -> use async APIs/background work
- Multiple runtime versions across environments -> pin Bun version
- Missing shutdown cleanup -> close DB handles on process unload

## Sources
- https://bun.com/docs/runtime
- https://bun.com/docs/runtime/http/server
- https://bun.com/docs/runtime/environment-variables
- https://bun.com/docs/runtime/hashing
- https://github.com/oven-sh/bun/releases
