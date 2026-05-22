import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

export type Database = PostgresJsDatabase<typeof schema>;

let _client: ReturnType<typeof postgres> | null = null;
let _db: Database | null = null;

export function getDb(url = process.env.DATABASE_URL): Database {
  if (_db) return _db;
  if (!url) throw new Error("DATABASE_URL is not set");

  _client = postgres(url, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false, // Bun + drizzle is happier without prepared statements by default.
  });
  _db = drizzle(_client, { schema });
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_client) await _client.end({ timeout: 5 });
  _client = null;
  _db = null;
}

/**
 * Construct an in-process pglite-backed Drizzle client. Intended for tests:
 * each call returns a fresh instance with no migrations applied — callers
 * (typically `apps/api/test/setup.ts`) run the migrations and inject the
 * result via `apps/api/src/db.ts#setDb`.
 *
 * The `@electric-sql/pglite` dep lives in `apps/api` rather than here so the
 * production bundle never pulls in the WASM Postgres build. We `await import`
 * it lazily for the same reason — if a non-test caller invokes this on a
 * tree where pglite isn't installed, the error surfaces at call-time.
 */
export type PgliteDatabase = ReturnType<
  typeof import("drizzle-orm/pglite").drizzle<typeof schema>
>;

export async function getPgliteDb(): Promise<PgliteDatabase> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const client = new PGlite();
  return drizzlePglite(client, { schema });
}
