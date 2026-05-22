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
