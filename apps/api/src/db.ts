import { getDb, type Database } from "@tsundoku/db";
import { env } from "./env.ts";

// Lazy + swappable. Tests preload a setup file that constructs a pglite-backed
// Drizzle client and calls setDb() before any service code reads requireDb().
// Prod just falls back to the postgres URL from env at first read.
let _db: Database | null = null;
let _initialized = false;

function lazyInit(): Database | null {
  if (_initialized) return _db;
  _initialized = true;
  if (env.DATABASE_URL) _db = getDb(env.DATABASE_URL);
  return _db;
}

export function requireDb(): Database {
  const d = _db ?? lazyInit();
  if (!d) throw new Error("DATABASE_URL is not configured");
  return d;
}

/** Injection point for tests — call before any service code runs. */
export function setDb(d: Database | null): void {
  _db = d;
  _initialized = true;
}
