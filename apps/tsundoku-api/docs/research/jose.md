# JOSE / JWT / OIDC

- Latest stable: `jose@6.2.1`
- Baseline: centralized JWT middleware with JWKS cache + strict claim checks

## Recommended defaults
- Verify signature, `iss`, `aud`, `exp`, `nbf` for every protected route
- Restrict accepted algorithms explicitly
- Implement JWKS caching with refresh on `kid` miss
- Keep access token lifetimes short

## Pitfalls
- Decoding without verification -> security bug
- Algorithm confusion attacks -> enforce allowed alg list
- Stale JWKS cache -> failed validation during rotation

## Sources
- https://www.npmjs.com/package/jose
- https://workos.com/guide/jwt-validation
- https://workos.com/blog/developers-guide-jwks
