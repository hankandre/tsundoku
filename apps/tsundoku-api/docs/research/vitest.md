# Vitest

- Latest stable: `vitest@4.1.0`
- Baseline: integration tests against `app.request(...)` plus selective end-to-end tests

## Recommended defaults
- Run API integration tests with controlled concurrency
- Seed/teardown DB state per test suite
- Keep unit tests isolated from network calls

## Pitfalls
- Flaky tests from shared DB state
- Worker pool errors with excessive parallelism

## Sources
- https://vitest.dev
- https://github.com/vitest-dev/vitest/releases
- https://vitest.dev/guide/common-errors
