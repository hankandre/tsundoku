# Hono

- Latest stable: `4.12.7`
- Baseline: route modules + scoped middleware + global error formatter

## Recommended defaults
- Keep route handlers thin; push logic into services
- Use middleware for auth/logging/request context
- Use `@hono/zod-openapi` for validated contracts + OpenAPI docs
- Standardize `app.onError` behavior for parity with Java error envelopes

## Pitfalls
- Middleware order mistakes -> document ordering rules
- Route sprawl -> organize by bounded domains/modules

## Sources
- https://hono.dev/docs
- https://hono.dev/docs/guides/best-practices
- https://github.com/honojs/hono/releases
- https://hono.dev/examples/zod-openapi
