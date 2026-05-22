import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { migrate } from "drizzle-orm/pglite/migrator";
import { getPgliteDb } from "@tsundoku/db";
import { setDb } from "../src/db.ts";

// Bun:test preload entrypoint (wired up in `apps/api/bunfig.toml`). Runs once
// before any test file loads, so by the time service code calls requireDb()
// the singleton already points at a freshly-migrated pglite instance.
//
// Why pglite: tests used to hit the dev Postgres at localhost:5433 and leak
// rows when a suite crashed mid-cleanup. An in-process WASM Postgres is fully
// isolated — the instance is wiped when the process exits, and there's no
// chance of polluting the user's actual library data.

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "../../../packages/db/drizzle");

const db = await getPgliteDb();
await migrate(db, { migrationsFolder });
setDb(db);
