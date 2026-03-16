# Zod + Hono OpenAPI

- Latest stable:
  - `zod@4.3.6`
  - `@hono/zod-openapi@1.2.2`

## Recommended defaults
- Validate params/query/body at route edge
- Reuse schema definitions for both validation and OpenAPI
- Keep a single Zod version across workspace to avoid instance mismatch

## Pitfalls
- Missing `Content-Type` for JSON body validation
- Validation middleware ordering issues

## Sources
- https://zod.dev/v4
- https://hono.dev/examples/zod-openapi
- https://www.npmjs.com/package/@hono/zod-openapi
